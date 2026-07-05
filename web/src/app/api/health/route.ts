import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function hasUsablePublicEnv(value: string | undefined) {
  return Boolean(value && !value.includes('dummy-') && !value.includes('PROJECT_REF'))
}

export function GET() {
  const supabaseUrlOk = hasUsablePublicEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKeyOk = hasUsablePublicEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const ok = supabaseUrlOk && supabaseAnonKeyOk

  return NextResponse.json(
    {
      ok,
      service: 'vetdorim-web',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      checks: {
        next: true,
        supabasePublicUrlConfigured: supabaseUrlOk,
        supabaseAnonKeyConfigured: supabaseAnonKeyOk,
      },
    },
    {
      status: ok ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
