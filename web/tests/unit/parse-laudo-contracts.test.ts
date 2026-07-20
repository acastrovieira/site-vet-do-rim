import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  assertJsonMatchesSchema,
  containClinicalInference,
  getCorsHeaders,
  isIsoCivilDate,
  MAX_PROVIDER_RESPONSE_BYTES,
  readBoundedJsonResponse,
  readRequestBody,
} from '../../../supabase/functions/parse-laudo/contracts.ts'

const inferenceSchema = {
  type: 'object',
  properties: {
    valor: { type: ['number', 'null'] },
    interpretacao_ia: {
      type: 'object',
      properties: {
        resumo: { type: 'string' },
        alertas: { type: 'array', items: { type: 'string' } },
        estadiamento_iris_sugerido: { type: ['string', 'null'] },
      },
      required: ['resumo', 'alertas', 'estadiamento_iris_sugerido'],
      additionalProperties: false,
    },
  },
  required: ['valor', 'interpretacao_ia'],
  additionalProperties: false,
}

test('parse-laudo CORS echoes only an explicit allowlisted origin', () => {
  const allowed = ['https://vetdorim.example']

  assert.equal(
    getCorsHeaders(allowed[0], allowed)['Access-Control-Allow-Origin'],
    allowed[0],
  )
  assert.equal(
    getCorsHeaders('https://attacker.example', allowed)['Access-Control-Allow-Origin'],
    undefined,
  )
  assert.equal(getCorsHeaders(null, allowed)['Access-Control-Allow-Origin'], undefined)
})

test('parse-laudo request body is bounded, JSON-only and rejects unknown keys', async () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const valid = new Request('https://edge.example/parse-laudo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ laudoId: id }),
  })

  assert.deepEqual(await readRequestBody(valid), { laudoId: id })

  const wrongMediaType = new Request('https://edge.example/parse-laudo', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ laudoId: id }),
  })
  assert.equal(await readRequestBody(wrongMediaType), null)

  const unknownKey = new Request('https://edge.example/parse-laudo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ laudoId: id, status: 'concluido' }),
  })
  assert.equal(await readRequestBody(unknownKey), null)

  const oversized = new Request('https://edge.example/parse-laudo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ laudoId: 'x'.repeat(5 * 1024) }),
  })
  assert.equal(await readRequestBody(oversized), null)
})

test('parse-laudo bounds provider envelopes before parsing JSON', async () => {
  const parsed = await readBoundedJsonResponse(new Response('{"ok":true}', {
    headers: { 'Content-Type': 'application/json' },
  }))
  assert.deepEqual(parsed, { ok: true })

  await assert.rejects(() => readBoundedJsonResponse(new Response('not-json')))
  await assert.rejects(() => readBoundedJsonResponse(new Response('{}', {
    headers: { 'Content-Length': String(MAX_PROVIDER_RESPONSE_BYTES + 1) },
  })))
})

test('parse-laudo validates provider output locally and removes clinical staging', () => {
  const valid = {
    valor: 1.2,
    interpretacao_ia: {
      resumo: 'Achado transcrito do laudo.',
      alertas: ['Revisar com o medico-veterinario.'],
      estadiamento_iris_sugerido: '3',
    },
  }

  assert.doesNotThrow(() => assertJsonMatchesSchema(valid, inferenceSchema))
  const contained = containClinicalInference(valid, inferenceSchema)
  assert.equal(
    (contained.interpretacao_ia as Record<string, unknown>).estadiamento_iris_sugerido,
    null,
  )
  assert.equal(valid.interpretacao_ia.estadiamento_iris_sugerido, '3')

  assert.throws(() => assertJsonMatchesSchema({ ...valid, injected: true }, inferenceSchema))
  assert.throws(() => assertJsonMatchesSchema({ ...valid, valor: '1.2' }, inferenceSchema))
  assert.throws(() => assertJsonMatchesSchema({
    ...valid,
    interpretacao_ia: { ...valid.interpretacao_ia, resumo: 'x'.repeat(17 * 1024) },
  }, inferenceSchema))

  assert.equal(isIsoCivilDate('2024-02-29'), true)
  assert.equal(isIsoCivilDate('2026-02-29'), false)
  assert.equal(isIsoCivilDate('29/02/2024'), false)

  const datedSchema = {
    ...inferenceSchema,
    properties: {
      ...inferenceSchema.properties,
      data_coleta: { type: ['string', 'null'] },
      data_resultado: { type: ['string', 'null'] },
    },
    required: [...inferenceSchema.required, 'data_coleta', 'data_resultado'],
  }
  assert.doesNotThrow(() => containClinicalInference({
    ...valid,
    data_coleta: '2024-02-29',
    data_resultado: null,
  }, datedSchema))
  assert.throws(() => containClinicalInference({
    ...valid,
    data_coleta: '2026-02-29',
    data_resultado: null,
  }, datedSchema), /data civil invalida/)
  assert.throws(() => containClinicalInference({
    ...valid,
    data_coleta: null,
    data_resultado: '2026-04-31',
  }, datedSchema), /data civil invalida/)
})

// AUDIT-001 Fase 2 (Tarefas 2.2/2.3): parse-laudo/index.ts e um arquivo Deno —
// nao e importado/executado no test runner do Node (sem Deno no sandbox; a
// validacao Deno roda no CI). Por isso este contrato e estatico/textual sobre
// o fonte, no mesmo espirito do teste existente em production-safety.test.ts,
// mas focado especificamente no contrato das RPCs transacionais
// (supabase/migrations/20260718110000_laudo_claim_finalize_refund.sql) e na
// proveniencia da IA gravada por finalize_laudo_ia.
test('parse-laudo edge function calls claim/finalize/refund RPCs and never the old quota/status pattern', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../../supabase/functions/parse-laudo/index.ts'),
    'utf8',
  )
  const dbTypes = readFileSync(
    resolve(import.meta.dirname, '../../../supabase/functions/parse-laudo/database.types.ts'),
    'utf8',
  )

  // Presenca das tres RPCs transacionais (claim reserva cota ANTES da chamada
  // externa; finalize grava resultado+proveniencia+consumo; refund compensa).
  assert.match(source, /\.rpc\("claim_laudo_ia",/)
  assert.match(source, /\.rpc\("finalize_laudo_ia",/)
  assert.match(source, /\.rpc\("refund_laudo_ia",/)

  // Ausencia total do padrao antigo: SELECT de cota, update manual de status/
  // erro_ia/resultado_ia e increment_ai_quota no fim do fluxo feliz.
  assert.doesNotMatch(source, /increment_ai_quota/)
  assert.doesNotMatch(source, /ai_quota_used|ai_quota_limit/)
  assert.doesNotMatch(source, /\.update\(\{\s*status:/)
  assert.doesNotMatch(source, /\.in\("status", \["pendente", "erro"\]\)/)

  // idempotency_key e gerada uma vez por requisicao (nao reaproveitada entre
  // chamadas nem lida do body do cliente).
  assert.match(source, /const idempotencyKey = crypto\.randomUUID\(\)/)
  assert.equal(source.match(/crypto\.randomUUID\(\)/g)?.length, 1)
  assert.doesNotMatch(source, /body\??\.idempotencyKey|idempotencyKey:\s*body/)

  // refund_laudo_ia nunca e chamado antes de activeClaim existir: a unica
  // chamada a refund no arquivo fica dentro do bloco guardado por
  // `if (supabase && activeClaim)`.
  const guardIndex = source.indexOf('if (supabase && activeClaim)')
  const refundIndex = source.indexOf('.rpc("refund_laudo_ia",')
  assert.ok(guardIndex >= 0 && refundIndex > guardIndex)
  assert.equal(source.match(/\.rpc\("refund_laudo_ia",/g)?.length, 1)

  // PROMPT_VERSION versionado localmente e presente na proveniencia gravada
  // por finalize_laudo_ia.
  assert.match(source, /const PROMPT_VERSION = "2026-07-18\.1"/)
  assert.match(source, /p_provenance: provenance/)
  assert.match(source, /prompt_version: PROMPT_VERSION/)
  assert.match(source, /pdf_sha256: input\.pdfSha256/)
  assert.match(source, /pdf_bytes: input\.pdfBytes/)
  assert.match(source, /schema_name: HEMOGRAMA_SCHEMA\.name/)
  assert.match(source, /schema_version: HEMOGRAMA_SCHEMA\.version/)

  // Todo error_code enviado a refund vem de um classificador tipado (nunca de
  // string livre), e a allowlist fechada da migration 20260718110000 esta
  // espelhada em database.types.ts.
  assert.match(source, /p_error_code: classified\.code/)
  const allowlist = [
    'provider_timeout',
    'provider_rate_limited',
    'provider_unavailable',
    'provider_rejected',
    'storage_missing',
    'invalid_pdf',
    'invalid_provider_response',
    'invalid_result_schema',
    'result_too_large',
    'worker_crashed',
    'internal_processing_error',
    'attempts_exhausted',
  ]
  for (const code of allowlist) {
    assert.match(dbTypes, new RegExp(`"${code}"`))
  }
  // Nenhum error_code fora da allowlist deve ser produzido pelo classificador:
  // todo `new ProviderFailure(..., "codigo", true|false)` no arquivo usa um dos
  // 12 codigos (o token imediatamente antes do retryable boolean).
  const providerFailureCodes = [...source.matchAll(/"([a-z_]+)"\s*,\s*(?:true|false)/g)]
    .map((match) => match[1])
  assert.ok(providerFailureCodes.length > 0)
  for (const code of providerFailureCodes) {
    assert.ok(allowlist.includes(code), `error_code fora da allowlist: ${code}`)
  }
})
