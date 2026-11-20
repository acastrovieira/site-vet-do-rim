import {
  hasValidBearerSecret,
  OPERATIONAL_NO_STORE_HEADERS,
} from '@/lib/operational-health'
import { privateApiJson } from '@/lib/server-api-response'
import { createServiceClient } from '@/lib/supabase/service'
import { checkIpRateLimit } from '@/lib/ip-rate-limit'
import { recordSecurityEvent } from '@/lib/security-telemetry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const rateLimit = checkIpRateLimit(request, 'cron_purge_claim_events', 10, 60_000)
  if (!rateLimit.allowed) {
    return privateApiJson(
      { ok: false, message: 'Too many requests' },
      {
        status: 429,
        headers: {
          ...OPERATIONAL_NO_STORE_HEADERS,
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      },
    )
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    return privateApiJson(
      { ok: false, message: 'CRON_SECRET não configurado.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  if (!hasValidBearerSecret(request.headers.get('authorization'), cronSecret)) {
    recordSecurityEvent({
      event: 'cron_auth_failed',
      status: 401,
      layer: 'cron',
      scope: 'cron_purge_claim_events',
      code: 'CRON_UNAUTHORIZED',
    })
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
