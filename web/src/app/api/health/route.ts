import { NextResponse } from 'next/server'
import { OPERATIONAL_NO_STORE_HEADERS } from '@/lib/operational-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
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
