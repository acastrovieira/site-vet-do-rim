import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  mapAbandonLaudoUploadError,
  mapReserveLaudoUploadError,
} from '../../src/lib/lab/laudo-reservation.ts'

// AUDIT-001 Fase 2 (Tarefa 2.5) — contratos da reserva server-side de upload
// de laudo + compensacao deterministica de Storage (P1-3). Fecha o gap
// descoberto na Tarefa 2.2: private.claim_laudo_ia (migration
// 20260718110000) exige storage_path canonico
// clinics/{clinic_id}/laudos/{laudo_id}/original.pdf, mas ate a migration
// 20260718120000 o LaudoUploader gravava {user_id}/{timestamp}_{nome} via
// insert direto no browser.

test('mapReserveLaudoUploadError maps every controlled message to a stable public response', () => {
  assert.deepEqual(mapReserveLaudoUploadError('pet_not_found'), {
    status: 404,
    error: 'Paciente nao encontrado.',
    code: 'NOT_FOUND',
  })
  assert.equal(mapReserveLaudoUploadError('tenant_not_ready').status, 409)
  assert.equal(mapReserveLaudoUploadError('tenant_not_ready').code, 'TENANT_NOT_READY')
  assert.equal(mapReserveLaudoUploadError('reservation_limit_exceeded').status, 429)
  assert.equal(mapReserveLaudoUploadError('reservation_limit_exceeded').code, 'RESERVATION_LIMIT')
  assert.equal(mapReserveLaudoUploadError('unauthenticated').status, 401)
  assert.equal(mapReserveLaudoUploadError('invalid_request').status, 400)

  // Mensagens desconhecidas (ou ausentes) nunca vazam detalhe de banco —
  // sempre caem no fallback generico 500/DATABASE.
  const fallback = mapReserveLaudoUploadError('some raw postgres detail leaked')
  assert.equal(fallback.status, 500)
  assert.equal(fallback.code, 'DATABASE')
  assert.doesNotMatch(fallback.error, /postgres|raw/i)

  const nullish = mapReserveLaudoUploadError(null)
  assert.equal(nullish.status, 500)
  assert.equal(mapReserveLaudoUploadError(undefined).status, 500)
})

test('mapAbandonLaudoUploadError maps every controlled message to a stable public response', () => {
  assert.equal(mapAbandonLaudoUploadError('laudo_not_found').status, 404)
  assert.equal(mapAbandonLaudoUploadError('laudo_not_found').code, 'NOT_FOUND')
  assert.equal(mapAbandonLaudoUploadError('tenant_not_ready').status, 409)
  assert.equal(mapAbandonLaudoUploadError('invalid_laudo_state').status, 409)
  assert.equal(mapAbandonLaudoUploadError('invalid_laudo_state').code, 'STATE_CONFLICT')
  assert.equal(mapAbandonLaudoUploadError('unauthenticated').status, 401)
  assert.equal(mapAbandonLaudoUploadError('invalid_request').status, 400)

  const fallback = mapAbandonLaudoUploadError('unexpected internal detail')
  assert.equal(fallback.status, 500)
  assert.equal(fallback.code, 'DATABASE')
  assert.doesNotMatch(fallback.error, /internal detail/i)
})

test('POST /api/laudos/reserve authorizes, validates pet_id and never inserts laudos_pdf directly', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../src/app/api/laudos/reserve/route.ts'),
    'utf8',
  )

  assert.match(source, /authorizeClinicAccess\(supabase, \['vet', 'admin'\]\)/)
  assert.match(source, /assertAllowedKeys\(body, \['pet_id'\]\)/)
  assert.match(source, /if \(!isUuid\(petId\)\) return badRequest/)
  assert.match(source, /\.rpc\('reserve_laudo_upload', \{ p_pet_id: petId \}\)/)
  assert.match(source, /mapReserveLaudoUploadError\(error\?\.message\)/)

  // O contrato exige que o browser nunca escolha/gere o storage_path nem
  // insira diretamente em laudos_pdf: a rota so repassa o que a RPC devolve.
  assert.doesNotMatch(source, /\.from\('laudos_pdf'\)\.insert/)
  assert.doesNotMatch(source, /Date\.now\(\)/)
})

test('POST /api/laudos/:id/abandon authorizes, validates the id and uses the service client only for Storage cleanup', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../src/app/api/laudos/[id]/abandon/route.ts'),
    'utf8',
  )

  assert.match(source, /authorizeClinicAccess\(supabase, \['vet', 'admin'\]\)/)
  assert.match(source, /if \(!isUuid\(id\)\)/)
  assert.match(source, /\.rpc\('abandon_laudo_upload', \{ p_laudo_id: id \}\)/)
  assert.match(source, /mapAbandonLaudoUploadError\(error\?\.message\)/)

  // Decisao 1b documentada: a remocao do objeto de Storage acontece aqui
  // (service client), nunca via SQL direto em storage.objects.
  assert.match(source, /createServiceClient/)
  assert.match(source, /serviceClient\.storage/)
  assert.match(source, /\.remove\(\[outcome\.storage_path\]\)/)
  assert.doesNotMatch(source, /DELETE FROM storage\.objects/i)

  // Falha na limpeza de Storage nao pode bloquear a resposta de sucesso —
  // a trilha ja existe na linha marcada 'abandonado' pela RPC.
  const cleanupCatchIndex = source.indexOf("storageCleanup = 'unconfirmed'")
  const successReturnIndex = source.indexOf('ok: true, disposition: outcome.disposition')
  assert.ok(cleanupCatchIndex >= 0)
  assert.ok(successReturnIndex > cleanupCatchIndex)
})

test('LaudoUploader reserves server-side before uploading, never inserts laudos_pdf directly, and abandons on upload failure', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../src/components/lab/LaudoUploader.tsx'),
    'utf8',
  )

  // O insert direto no browser (o gap fechado por esta tarefa) nao existe mais.
  assert.doesNotMatch(source, /\.from\('laudos_pdf'\)\.insert/)
  assert.doesNotMatch(source, /\$\{user\.id\}\/\$\{Date\.now\(\)\}/)
  assert.doesNotMatch(source, /Date\.now\(\)/)

  // A reserva server-side acontece ANTES do upload ao Storage.
  const reserveFetchIndex = source.indexOf("fetch('/api/laudos/reserve'")
  const uploadCallIndex = source.indexOf('.upload(storagePath, pdfFile,')
  assert.ok(reserveFetchIndex >= 0, 'reserve fetch call is present')
  assert.ok(uploadCallIndex > reserveFetchIndex, 'upload happens after the reserve call')

  // Falha de upload aciona a desistencia deterministica (abandon), nunca um
  // storage.remove manual no browser.
  const uploadErrorGuardIndex = source.indexOf('if (uploadError) {')
  const abandonCallIndex = source.indexOf('await abandonReservation(reservedLaudoId)')
  assert.ok(uploadErrorGuardIndex >= 0)
  assert.ok(abandonCallIndex > uploadErrorGuardIndex)
  assert.ok(abandonCallIndex < source.indexOf("throw new LaudoUserError(GENERIC_UPLOAD_ERROR)", uploadErrorGuardIndex))

  // O mutex anti-duplo-envio e o guard existente (incluindo cleanupBlocked)
  // continuam presentes e inalterados.
  assert.match(source, /if \(!pdfFile \|\| laudoId \|\| cleanupBlocked \|\| operationInFlightRef\.current\) return/)
  assert.match(source, /operationInFlightRef\.current = true/)

  // upsert continua desabilitado no upload direto ao Storage.
  assert.match(source, /upsert: false/)
})
