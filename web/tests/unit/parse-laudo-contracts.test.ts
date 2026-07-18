import assert from 'node:assert/strict'
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
