import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ApiCsrfError,
  ApiValidationError,
  assertSameOriginMutation,
  safeErrorSummary,
} from '@/lib/api-validation'
import { authorizeClinicAccess } from '@/lib/server-authorization'
import {
  authorizationFailureJson,
  privateApiJson,
} from '@/lib/server-api-response'
import { isUuid } from '@/lib/identifiers'
import { mapAbandonLaudoUploadError } from '@/lib/lab/laudo-reservation'
import { CLINICAL_RATE_LIMIT_SCOPES, consumeClinicalRateLimit } from '@/lib/server-rate-limit'
import { recordSecurityEvent } from '@/lib/security-telemetry'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * AUDIT-001 Fase 2 (Tarefa 2.5) — compensacao deterministica de uma reserva
 * de upload de laudo que nunca foi concluida (falha de upload ou desistencia
 * explicita). A RPC apenas marca 'abandonado' e devolve bucket/path; a remocao
 * no Storage e feita com service_role SOMENTE apos validar que o caminho e
 * estritamente canonico para a clinica ativa do chamador.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    if (!isUuid(id)) {
      return privateApiJson({ ok: false, error: 'Laudo invalido', code: 'VALIDATION' }, { status: 400 })
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
        { ok: false, error: 'Clinica ativa nao confirmada', code: 'CLINIC_REQUIRED' },
        { status: 403 },
      )
    }

    const rateLimit = await consumeClinicalRateLimit(supabase, CLINICAL_RATE_LIMIT_SCOPES.abandon)
    if (rateLimit.state === 'limited') {
      return privateApiJson(
        { ok: false, error: 'Muitas solicitações em sequência. Aguarde e tente novamente.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }
    if (rateLimit.state === 'unavailable') {
      return privateApiJson(
        { ok: false, error: 'Não foi possível validar o limite da operação.', code: 'RATE_LIMIT_UNAVAILABLE' },
        { status: 503 },
      )
    }

    const { data, error } = await supabase.rpc('abandon_laudo_upload', { p_laudo_id: id })
    const outcome = data?.[0]

    if (error || !outcome) {
      console.error('[POST /api/laudos/:id/abandon]', { code: error?.code ?? 'UNKNOWN' })
      const mapped = mapAbandonLaudoUploadError(error?.message)
      return privateApiJson(
        { ok: false, error: mapped.error, code: mapped.code },
        { status: mapped.status },
      )
    }

    let storageCleanup: 'removed' | 'not_found' | 'unconfirmed' | 'skipped' = 'skipped'
    const expectedBucket = 'laudos'
    const expectedPath = `clinics/${authorization.clinicId}/laudos/${id}/original.pdf`

    if (outcome.storage_path) {
      if (
        outcome.storage_path !== expectedPath
        || (outcome.storage_bucket ?? expectedBucket) !== expectedBucket
      ) {
        storageCleanup = 'unconfirmed'
        recordSecurityEvent({
          event: 'extraction_storage_mismatch',
          status: 409,
          layer: 'api',
          scope: '/api/laudos/:id/abandon',
          code: 'PATH_MISMATCH',
        })
        console.error('[POST /api/laudos/:id/abandon] storage path contract mismatch', {
          code: 'PATH_MISMATCH',
        })
      } else {
        try {
          const serviceClient = createServiceClient()
          const { data: removed, error: removeError } = await serviceClient.storage
            .from(outcome.storage_bucket ?? expectedBucket)
            .remove([outcome.storage_path])

          if (removeError) {
            storageCleanup = 'unconfirmed'
            console.error('[POST /api/laudos/:id/abandon] storage cleanup failed', {
              name: removeError.name,
            })
          } else if (removed?.length === 1) {
            storageCleanup = 'removed'
          } else {
            storageCleanup = 'not_found'
          }
        } catch (cleanupErr) {
          storageCleanup = 'unconfirmed'
          console.error('[POST /api/laudos/:id/abandon] storage cleanup threw', safeErrorSummary(cleanupErr))
        }
      }
    }

    return privateApiJson({ ok: true, disposition: outcome.disposition, storageCleanup })
  } catch (err) {
    if (err instanceof ApiCsrfError) {
      return privateApiJson({ ok: false, error: err.message, code: 'CSRF_REJECTED' }, { status: 403 })
    }
    if (err instanceof ApiValidationError) {
      return privateApiJson({ ok: false, error: err.message, code: 'VALIDATION' }, { status: 400 })
    }
    console.error('[POST /api/laudos/:id/abandon] Unexpected error:', safeErrorSummary(err))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
