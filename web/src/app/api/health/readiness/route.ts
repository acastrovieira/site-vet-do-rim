import { NextResponse } from 'next/server'
import {
  getReadinessChecks,
  isReady,
  OPERATIONAL_NO_STORE_HEADERS,
} from '@/lib/operational-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
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
