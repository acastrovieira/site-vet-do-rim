import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ApiCsrfError,
  ApiPayloadTooLargeError,
  ApiUnsupportedMediaTypeError,
  ApiValidationError,
  assertSameOriginMutation,
  readJsonObject,
  safeErrorSummary,
} from '@/lib/api-validation'
import { authorizeClinicAccess } from '@/lib/server-authorization'
import { authorizationFailureJson, privateApiJson } from '@/lib/server-api-response'
import { isUuid } from '@/lib/identifiers'
import { mapRecordPetDeathError, parsePetDeathPayload } from '@/lib/lab/pet-death'
import { CLINICAL_RATE_LIMIT_SCOPES, consumeClinicalRateLimit } from '@/lib/server-rate-limit'
import { recordSecurityEvent } from '@/lib/security-telemetry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

function badRequest(error: string) {
  return privateApiJson({ ok: false, error, code: 'VALIDATION' }, { status: 400 })
}

/**
 * Executa o registro transacional auditável de óbito via RPC `record_pet_death`.
 * Atualiza `pets`, encerra `triagens` abertas, marca opt-out em `follow_ups`
 * pendentes e insere evento imutável em `pet_death_events`.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    if (!isUuid(id)) {
      return badRequest('ID de paciente inválido.')
    }

    const supabase = await createClient()
    const authorization = await authorizeClinicAccess(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)

    assertSameOriginMutation(request)

    if (
      !authorization.clinicId
      || !authorization.membershipRole
      || !['vet', 'clinic_admin'].includes(authorization.membershipRole)
    ) {
      return privateApiJson(
        { ok: false, error: 'Clínica ativa não confirmada para registro clínico.', code: 'CLINIC_REQUIRED' },
        { status: 403 },
      )
    }

    const rateLimit = await consumeClinicalRateLimit(supabase, CLINICAL_RATE_LIMIT_SCOPES.petsMutation)
    if (rateLimit.state === 'limited') {
      return privateApiJson(
        { ok: false, error: 'Muitas operações em sequência. Aguarde e tente novamente.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }
    if (rateLimit.state === 'unavailable') {
      return privateApiJson(
        { ok: false, error: 'Não foi possível validar o limite da operação.', code: 'RATE_LIMIT_UNAVAILABLE' },
        { status: 503 },
      )
    }

    const body = await readJsonObject(request)
    const payload = parsePetDeathPayload(body)

    const { data: pet, error: petLookupError } = await supabase
      .from('pets')
      .select('id, nome, status_paciente')
      .eq('id', id)
      .eq('clinic_id', authorization.clinicId)
      .maybeSingle()

    if (petLookupError) {
      const isRLS = petLookupError.code === '42501'
        || petLookupError.message?.toLowerCase().includes('row-level')
      if (isRLS) {
        recordSecurityEvent({
          event: 'rls_denied',
          status: 403,
          layer: 'api',
          scope: '/api/pets/:id/obito',
          code: 'RLS_DENIED',
        })
      }
      console.error('[POST /api/pets/:id/obito] Pet lookup failed', {
        code: petLookupError.code ?? 'UNKNOWN',
      })
      return privateApiJson(
        {
          ok: false,
          error: isRLS ? 'Permissão insuficiente para acessar paciente.' : 'Não foi possível confirmar o paciente.',
          code: isRLS ? 'RLS_DENIED' : 'DATABASE',
        },
        { status: isRLS ? 403 : 500 },
      )
    }

    if (!pet) {
      return privateApiJson(
        { ok: false, error: 'Paciente não encontrado.', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    if (pet.status_paciente === 'obito') {
      return privateApiJson(
        { ok: false, error: 'O óbito deste paciente já foi registrado anteriormente.', code: 'STATE_CONFLICT' },
        { status: 409 },
      )
    }

    if (payload.confirm_pet_name.trim() !== pet.nome.trim()) {
      return badRequest('Confirme digitando exatamente o nome do paciente.')
    }

    const serviceClient = createServiceClient()
    const { data: rpcRows, error: rpcError } = await serviceClient.rpc('record_pet_death', {
      p_clinic_id: authorization.clinicId,
      p_actor_user_id: authorization.userId,
      p_pet_id: id,
      p_data_obito: payload.data_obito,
      p_motivo: payload.motivo,
      p_observacoes: payload.observacoes,
    })

    const outcome = rpcRows?.[0]
    if (rpcError || !outcome) {
      console.error('[POST /api/pets/:id/obito] RPC failed', {
        code: rpcError?.code ?? 'UNKNOWN',
      })
      const mapped = mapRecordPetDeathError(rpcError?.message)
      if (rpcError?.code === '42501' || mapped.code === 'FORBIDDEN') {
        recordSecurityEvent({
          event: 'rls_denied',
          status: 403,
          layer: 'api',
          scope: '/api/pets/:id/obito',
          code: 'RLS_DENIED',
        })
      }
      return privateApiJson(
        { ok: false, error: mapped.error, code: mapped.code },
        { status: mapped.status },
      )
    }

    return privateApiJson({
      ok: true,
      id: outcome.pet_id,
      eventId: outcome.event_id,
      dataObito: outcome.data_obito,
      triagensEncerradas: outcome.triagens_encerradas,
      followUpsCancelados: outcome.follow_ups_cancelados,
    })
  } catch (err) {
    if (err instanceof ApiCsrfError) {
      return privateApiJson({ ok: false, error: err.message, code: 'CSRF_REJECTED' }, { status: 403 })
    }
    if (err instanceof ApiPayloadTooLargeError) {
      return privateApiJson({ ok: false, error: err.message, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    if (err instanceof ApiUnsupportedMediaTypeError) {
      return privateApiJson({ ok: false, error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415 })
    }
    if (err instanceof ApiValidationError) return badRequest(err.message)
    console.error('[POST /api/pets/:id/obito] Unexpected error:', safeErrorSummary(err))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
