import { createClient } from '@/lib/supabase/server'
import {
  ApiUnsupportedMediaTypeError,
  ApiPayloadTooLargeError,
  ApiValidationError,
  assertAllowedKeys,
  readJsonObject,
  requiredText,
  safeErrorSummary,
} from '@/lib/api-validation'
import { authorizeClinicAccess } from '@/lib/server-authorization'
import {
  authorizationFailureJson,
  privateApiJson,
} from '@/lib/server-api-response'
import { isUuid } from '@/lib/identifiers'
import { mapReserveLaudoUploadError } from '@/lib/lab/laudo-reservation'

function badRequest(error: string) {
  return privateApiJson({ ok: false, error, code: 'VALIDATION' }, { status: 400 })
}

/**
 * AUDIT-001 Fase 2 (Tarefa 2.5) — reserva server-side do path canonico de
 * upload de laudo. Fecha o gap descoberto na Tarefa 2.2: o browser NUNCA mais
 * escolhe/gera o storage_path (nem insere direto em laudos_pdf); apenas
 * recebe o path ja reservado por private.reserve_laudo_upload e faz o upload
 * (upsert: false) diretamente para o Storage, autorizado pelas policies
 * aditivas de storage.objects (migration 20260718120000).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const authorization = await authorizeClinicAccess(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)

    const body = await readJsonObject(request)
    assertAllowedKeys(body, ['pet_id'])
    const petId = requiredText(body.pet_id, 'Paciente', 36)
    if (!isUuid(petId)) return badRequest('Paciente invalido')

    const { data, error } = await supabase.rpc('reserve_laudo_upload', { p_pet_id: petId })
    const reservation = data?.[0]

    if (error || !reservation) {
      console.error('[POST /api/laudos/reserve]', { code: error?.code ?? 'UNKNOWN' })
      const mapped = mapReserveLaudoUploadError(error?.message)
      return privateApiJson(
        { ok: false, error: mapped.error, code: mapped.code },
        { status: mapped.status },
      )
    }

    return privateApiJson(
      {
        ok: true,
        laudoId: reservation.laudo_id,
        storagePath: reservation.storage_path,
        bucket: reservation.storage_bucket,
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof ApiPayloadTooLargeError) {
      return privateApiJson(
        { ok: false, error: err.message, code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 },
      )
    }
    if (err instanceof ApiUnsupportedMediaTypeError) {
      return privateApiJson(
        { ok: false, error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' },
        { status: 415 },
      )
    }
    if (err instanceof ApiValidationError) return badRequest(err.message)
    console.error('[POST /api/laudos/reserve] Unexpected error:', safeErrorSummary(err))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
