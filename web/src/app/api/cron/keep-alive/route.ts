import { NextResponse } from 'next/server'
import {
  getBoundedTimeoutMs,
  hasValidBearerSecret,
  isConfiguredSupabasePublicKey,
  isConfiguredSupabaseUrl,
  OPERATIONAL_NO_STORE_HEADERS,
  parseHttpsHealthUrl,
} from '@/lib/operational-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ServiceResult = {
  ok: boolean
  message: string
  latencyMs?: number
}

/**
 * Cron autenticado que verifica dependencias sem retornar dados ou detalhes internos.
 * Todas as chamadas possuem timeout e as respostas nunca podem ser armazenadas em cache.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    console.error('[Cron Keep-Alive] configuracao_invalida', {
      code: 'CRON_SECRET_INVALID',
    })
    return NextResponse.json(
      { ok: false, message: 'Servico indisponivel por configuracao incompleta.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  if (!hasValidBearerSecret(request.headers.get('authorization'), cronSecret)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: OPERATIONAL_NO_STORE_HEADERS,
    })
  }

  const results: Record<string, ServiceResult> = {}
  const timeoutMs = getBoundedTimeoutMs(process.env.KEEP_ALIVE_TIMEOUT_MS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseConfigured = isConfiguredSupabaseUrl(supabaseUrl) &&
    isConfiguredSupabasePublicKey(supabasePublicKey)

  if (supabaseConfigured) {
    try {
      const start = Date.now()
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/openapi+json',
          apikey: supabasePublicKey,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
      const latencyMs = Date.now() - start
      await response.body?.cancel()

      results.supabase = {
        ok: response.ok,
        message: response.ok ? 'Supabase ativo.' : 'Supabase indisponivel.',
        latencyMs,
      }
    } catch (error: unknown) {
      console.error('[Cron Keep-Alive] dependencia_falhou', {
        dependency: 'supabase_database',
        type: error instanceof Error ? error.name : 'UnknownError',
      })
      results.supabase = { ok: false, message: 'Supabase indisponivel.' }
    }
  } else {
    results.supabase = {
      ok: false,
      message: 'Supabase indisponivel por configuracao invalida.',
    }
  }

  const configuredVpsUrl = process.env.VPS_HEALTH_URL
  const vpsUrl = parseHttpsHealthUrl(configuredVpsUrl)
  if (configuredVpsUrl && !vpsUrl) {
    console.error('[Cron Keep-Alive] configuracao_invalida', {
      code: 'VPS_HEALTH_URL_INVALID',
    })
    results.vps = {
      ok: false,
      message: 'VPS indisponivel por configuracao invalida.',
    }
  } else if (vpsUrl) {
    try {
      const start = Date.now()
      const response = await fetch(vpsUrl, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
      const latencyMs = Date.now() - start
      await response.body?.cancel()

      results.vps = {
        ok: response.ok,
        message: response.ok ? 'VPS ativo.' : 'VPS indisponivel.',
        latencyMs,
      }
    } catch (error: unknown) {
      console.error('[Cron Keep-Alive] dependencia_falhou', {
        dependency: 'vps',
        type: error instanceof Error ? error.name : 'UnknownError',
      })
      results.vps = { ok: false, message: 'VPS indisponivel.' }
    }
  }

  if (supabaseConfigured) {
    try {
      const start = Date.now()
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        cache: 'no-store',
        headers: { apikey: supabasePublicKey },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
      const latencyMs = Date.now() - start
      await response.body?.cancel()

      results.supabase_api = {
        ok: response.ok,
        message: response.ok ? 'API Supabase ativa.' : 'API Supabase indisponivel.',
        latencyMs,
      }
    } catch (error: unknown) {
      console.error('[Cron Keep-Alive] dependencia_falhou', {
        dependency: 'supabase_api',
        type: error instanceof Error ? error.name : 'UnknownError',
      })
      results.supabase_api = { ok: false, message: 'API Supabase indisponivel.' }
    }
  } else {
    results.supabase_api = {
      ok: false,
      message: 'API Supabase indisponivel por configuracao invalida.',
    }
  }

  const allOk = Object.values(results).every((result) => result.ok)

  return NextResponse.json(
    {
      ok: allOk,
      message: allOk ? 'Todos os servicos ativos.' : 'Alguns servicos com problemas.',
      timestamp: new Date().toISOString(),
      services: results,
    },
    {
      status: allOk ? 200 : 503,
      headers: OPERATIONAL_NO_STORE_HEADERS,
    },
  )
}
