import { NextResponse } from 'next/server'
import {
  hasValidBearerSecret,
  OPERATIONAL_NO_STORE_HEADERS,
} from '@/lib/operational-health'
import { checkIpRateLimit } from '@/lib/ip-rate-limit'
import { recordSecurityEvent } from '@/lib/security-telemetry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Guarda de compatibilidade do antigo cron de descarte.
 *
 * O endpoint permanece para que um agendamento antigo ainda ativo falhe de
 * forma segura: autentica a chamada e confirma que nenhuma mutação ocorreu.
 * Não consulta banco, não usa service role e não remove objetos. O prazo e o
 * workflow de retenção/purge dependem de aprovação humana (ADR-003).
 */
export async function GET(request: Request) {
  const rateLimit = checkIpRateLimit(request, 'cron_cleanup_storage', 10, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
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
    return NextResponse.json(
      { ok: false, message: 'CRON_SECRET não configurado.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  if (!hasValidBearerSecret(request.headers.get('authorization'), cronSecret)) {
    recordSecurityEvent({
      event: 'cron_auth_failed',
      status: 401,
      layer: 'cron',
      scope: 'cron_cleanup_storage',
      code: 'CRON_UNAUTHORIZED',
    })
    return new NextResponse('Unauthorized', { status: 401, headers: OPERATIONAL_NO_STORE_HEADERS })
  }

  return NextResponse.json(
    {
      ok: true,
      message: 'Preservação ativa; nenhum PDF foi removido.',
      policy: 'preservation_hold_pending_retention_policy',
      deleted: 0,
    },
    { status: 200, headers: OPERATIONAL_NO_STORE_HEADERS },
  )
}
