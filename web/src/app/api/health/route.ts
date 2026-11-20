import { NextResponse } from 'next/server'
import { OPERATIONAL_NO_STORE_HEADERS } from '@/lib/operational-health'
import { checkIpRateLimit } from '@/lib/ip-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET(request: Request) {
  const rateLimit = checkIpRateLimit(request, 'health_liveness', 60, 60_000)
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

  return NextResponse.json(
    {
      ok: true,
      status: 'alive',
      service: 'vetdorim-web',
      timestamp: new Date().toISOString(),
      checks: { runtime: true },
    },
    {
      status: 200,
      headers: OPERATIONAL_NO_STORE_HEADERS,
    }
  )
}
