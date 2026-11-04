import {
  hasValidBearerSecret,
  OPERATIONAL_NO_STORE_HEADERS,
} from '@/lib/operational-health'
import { privateApiJson } from '@/lib/server-api-response'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    return privateApiJson(
      { ok: false, message: 'CRON_SECRET não configurado.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  if (!hasValidBearerSecret(request.headers.get('authorization'), cronSecret)) {
    return privateApiJson(
      { ok: false, message: 'Unauthorized' },
      { status: 401, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  try {
    const service = createServiceClient()
    const { data, error } = await (
      service as unknown as {
        rpc: (fn: string) => Promise<{
          data: number | null
          error: { code?: string; message?: string } | null
        }>
      }
    ).rpc('purge_old_claim_events')

    if (error) {
      console.error('[GET /api/cron/purge-claim-events]', {
        code: error.code ?? 'UNKNOWN',
      })
      return privateApiJson(
        { ok: false, message: 'Não foi possível executar o expurgo de eventos de claim.' },
        { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
      )
    }

    return privateApiJson({
      ok: true,
      purgedCount: data ?? 0,
      timestamp: new Date().toISOString(),
    })
  } catch {
    console.error('[GET /api/cron/purge-claim-events] Unexpected failure')
    return privateApiJson(
      { ok: false, message: 'Serviço indisponível para expurgo de eventos de claim.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }
}
