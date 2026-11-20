import { NextResponse } from 'next/server'
import {
  getReadinessChecks,
  isReady,
  OPERATIONAL_NO_STORE_HEADERS,
} from '@/lib/operational-health'
import { checkIpRateLimit } from '@/lib/ip-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET(request: Request) {
  const rateLimit = checkIpRateLimit(request, 'health_readiness', 60, 60_000)
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

  const checks = getReadinessChecks()
  const ready = isReady(checks)

  return NextResponse.json(
    {
      ok: ready,
      status: ready ? 'ready' : 'not_ready',
      service: 'vetdorim-web',
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: ready ? 200 : 503,
      headers: OPERATIONAL_NO_STORE_HEADERS,
    },
  )
}
