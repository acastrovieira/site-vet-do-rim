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
 * Cron autenticado que mantém o Supabase ativo com uma query real no banco.
 *
 * O Supabase (plano gratuito) pausa projetos após 7 dias sem atividade de
 * banco de dados. Pings HTTP ao /rest/v1/ ou /auth/v1/health NÃO contam como
 * atividade — é necessário executar uma query real (SELECT) no banco.
 *
 * Este endpoint executa um SELECT via REST com a service role key para
 * garantir que o Supabase registre a atividade e não pause o projeto.
 *
 * Todas as chamadas possuem timeout e as respostas nunca são armazenadas em cache.
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
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseConfigured = isConfiguredSupabaseUrl(supabaseUrl) &&
    isConfiguredSupabasePublicKey(supabasePublicKey)

  // ──────────────────────────────────────────────────────────────
  // 1. Query real no banco (previne pausa no Supabase Free Tier)
  //
  // O Supabase só registra "atividade" quando há uma operação real
  // no banco de dados. Fazer ping HTTP ao /rest/v1/ não é suficiente.
  // Usamos a service role key para SELECT em profiles (limit=1).
  // ──────────────────────────────────────────────────────────────
  if (supabaseConfigured && supabaseServiceKey) {
    try {
      const start = Date.now()
      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=id&limit=1`,
        {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(timeoutMs),
        },
      )
      const latencyMs = Date.now() - start
      await response.body?.cancel()

      if (response.ok) {
        results.supabase_db = {
          ok: true,
          message: 'Banco de dados ativo. Atividade registrada.',
          latencyMs,
        }
      } else {
        console.error('[Cron Keep-Alive] dependencia_falhou', {
          dependency: 'supabase_db_query',
          status: response.status,
        })
        results.supabase_db = {
          ok: false,
          message: `Banco indisponivel (HTTP ${response.status}).`,
          latencyMs,
        }
      }
    } catch (error: unknown) {
      console.error('[Cron Keep-Alive] dependencia_falhou', {
        dependency: 'supabase_db_query',
        type: error instanceof Error ? error.name : 'UnknownError',
      })
      results.supabase_db = { ok: false, message: 'Banco de dados indisponivel.' }
    }
  } else if (supabaseConfigured && !supabaseServiceKey) {
    // Service key ausente: faz fallback para ping HTTP (não previne pausa, mas monitora)
    console.warn('[Cron Keep-Alive] SUPABASE_SERVICE_ROLE_KEY ausente — usando ping HTTP como fallback. Configure a service role key para prevenir pausa do Supabase.')
    results.supabase_db = {
      ok: false,
      message: 'SUPABASE_SERVICE_ROLE_KEY nao configurada. Query real impossivel.',
    }
  } else {
    results.supabase_db = {
      ok: false,
      message: 'Supabase indisponivel por configuracao invalida.',
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 2. Ping HTTP ao REST API (verifica conectividade da API)
  // ──────────────────────────────────────────────────────────────
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

      results.supabase_api = {
        ok: response.ok,
        message: response.ok ? 'API REST Supabase ativa.' : 'API REST Supabase indisponivel.',
        latencyMs,
      }
    } catch (error: unknown) {
      console.error('[Cron Keep-Alive] dependencia_falhou', {
        dependency: 'supabase_rest_api',
        type: error instanceof Error ? error.name : 'UnknownError',
      })
      results.supabase_api = { ok: false, message: 'API REST Supabase indisponivel.' }
    }
  } else {
    results.supabase_api = {
      ok: false,
      message: 'API Supabase indisponivel por configuracao invalida.',
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3. Ping ao Auth API
  // ──────────────────────────────────────────────────────────────
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

      results.supabase_auth = {
        ok: response.ok,
        message: response.ok ? 'Auth Supabase ativo.' : 'Auth Supabase indisponivel.',
        latencyMs,
      }
    } catch (error: unknown) {
      console.error('[Cron Keep-Alive] dependencia_falhou', {
        dependency: 'supabase_auth',
        type: error instanceof Error ? error.name : 'UnknownError',
      })
      results.supabase_auth = { ok: false, message: 'Auth Supabase indisponivel.' }
    }
  } else {
    results.supabase_auth = {
      ok: false,
      message: 'Auth Supabase indisponivel por configuracao invalida.',
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 4. VPS opcional
  // ──────────────────────────────────────────────────────────────
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
