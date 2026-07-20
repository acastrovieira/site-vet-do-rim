import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ApiValidationError, safeErrorSummary } from '@/lib/api-validation'
import { authorizeClinicAccess } from '@/lib/server-authorization'
import {
  authorizationFailureJson,
  privateApiJson,
} from '@/lib/server-api-response'
import { isUuid } from '@/lib/identifiers'
import { mapAbandonLaudoUploadError } from '@/lib/lab/laudo-reservation'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * AUDIT-001 Fase 2 (Tarefa 2.5) — compensacao deterministica de uma reserva
 * de upload de laudo que nunca foi concluida (falha de upload ou desistencia
 * explicita). DECISAO registrada na migration 20260718120000: a RPC
 * private.abandon_laudo_upload NUNCA apaga storage.objects via SQL (isso
 * deixaria o objeto binario orfao no backend de armazenamento, sem trilha
 * alcancavel); ela apenas marca o laudo como 'abandonado' com trilha
 * auditavel (abandoned_at/abandoned_by) e devolve bucket/path. A remocao do
 * objeto (quando existir) e feita AQUI, com um cliente service_role, usando a
 * API de Storage do Supabase — nunca SQL direto em storage.objects.
 *
 * Falha na remocao do objeto NAO bloqueia a resposta de sucesso: a linha ja
 * foi marcada 'abandonado' pela RPC antes desta chamada, entao ha trilha
 * auditavel (status + timestamps + storage_path) mesmo se a limpeza do
 * Storage precisar ser reconciliada depois — nunca um DELETE silencioso sem
 * evidencia.
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

    if (outcome.storage_path) {
      try {
        const serviceClient = createServiceClient()
        const { data: removed, error: removeError } = await serviceClient.storage
          .from(outcome.storage_bucket ?? 'laudos')
          .remove([outcome.storage_path])

        if (removeError) {
          storageCleanup = 'unconfirmed'
          console.error('[POST /api/laudos/:id/abandon] storage cleanup failed', {
            name: removeError.name,
          })
        } else if (removed?.length === 1) {
          storageCleanup = 'removed'
        } else {
          // Nenhum objeto correspondia ao path (upload nunca chegou a
          // acontecer) — resultado esperado na maioria dos abandons.
          storageCleanup = 'not_found'
        }
      } catch (cleanupErr) {
        storageCleanup = 'unconfirmed'
        console.error('[POST /api/laudos/:id/abandon] storage cleanup threw', safeErrorSummary(cleanupErr))
      }
    }

    return privateApiJson({ ok: true, disposition: outcome.disposition, storageCleanup })
  } catch (err) {
    if (err instanceof ApiValidationError) {
      return privateApiJson({ ok: false, error: err.message, code: 'VALIDATION' }, { status: 400 })
    }
    console.error('[POST /api/laudos/:id/abandon] Unexpected error:', safeErrorSummary(err))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
