import { NextResponse } from 'next/server'
import { checkIpRateLimit } from '@/lib/ip-rate-limit'
import {
  hasValidBearerSecret,
  OPERATIONAL_NO_STORE_HEADERS,
} from '@/lib/operational-health'
import {
  getSecurityTelemetrySnapshot,
  recordSecurityEvent,
} from '@/lib/security-telemetry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET(request: Request) {
  const rateLimit = checkIpRateLimit(request, 'health_security', 20, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests' },
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
      { ok: false, error: 'Security telemetry unavailable due to missing secret configuration.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  if (!hasValidBearerSecret(request.headers.get('authorization'), cronSecret)) {
    recordSecurityEvent({
      event: 'cron_auth_failed',
      status: 401,
      layer: 'cron',
      scope: 'health_security',
      code: 'CRON_UNAUTHORIZED',
    })
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: OPERATIONAL_NO_STORE_HEADERS,
    })
  }

  return NextResponse.json(
    {
      ok: true,
      service: 'vetdorim-web',
      ...getSecurityTelemetrySnapshot(),
    },
    {
      status: 200,
      headers: OPERATIONAL_NO_STORE_HEADERS,
    },
  )
}
