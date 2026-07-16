import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Endpoint acionado por cronjob para manter os serviços ativos.
 * 
 * Serviços monitorados:
 * 1. Supabase — query simples para evitar pausa no plano free (7 dias inatividade)
 * 2. VPS — ping via HTTP GET (se URL configurada)
 * 
 * Pode ser chamado por:
 * - Vercel Cron (vercel.json) — 1x/dia no plano Hobby
 * - Cron externo (cron-job.org, UptimeRobot) — frequência customizável
 */
export async function GET(request: Request) {
  // Validar autorização do Vercel Cron (evita chamadas arbitrárias)
  const authHeader = request.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const results: Record<string, { ok: boolean; message: string; latencyMs?: number }> = {}

  // ── 1. Supabase Keep-Alive ──────────────────────────────────────────
  try {
    const start = Date.now()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('tutores')
      .select('id')
      .limit(1)

    const latency = Date.now() - start

    if (error) {
      console.error('[Cron Keep-Alive] Supabase erro:', error)
      results.supabase = { ok: false, message: error.message, latencyMs: latency }
    } else {
      results.supabase = {
        ok: true,
        message: `Supabase ativo (${data?.length ?? 0} registro${data?.length !== 1 ? 's' : ''})`,
        latencyMs: latency,
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[Cron Keep-Alive] Supabase falha:', msg)
    results.supabase = { ok: false, message: msg }
  }

  // ── 2. VPS Keep-Alive (se configurado) ─────────────────────────────
  const vpsUrl = process.env.VPS_HEALTH_URL
  if (vpsUrl) {
    try {
      const start = Date.now()
      const vpsRes = await fetch(vpsUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10s timeout
      })
      const latency = Date.now() - start

      results.vps = {
        ok: vpsRes.ok,
        message: vpsRes.ok
          ? `VPS ativo (HTTP ${vpsRes.status})`
          : `VPS respondeu com HTTP ${vpsRes.status}`,
        latencyMs: latency,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error('[Cron Keep-Alive] VPS falha:', msg)
      results.vps = { ok: false, message: `VPS indisponível: ${msg}` }
    }
  }

  // ── 3. Supabase Edge Functions warmup (opcional) ────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      const start = Date.now()
      // Apenas checa se o endpoint do Supabase está respondendo
      const healthRes = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        signal: AbortSignal.timeout(5000),
      })
      const latency = Date.now() - start

      results.supabase_api = {
        ok: healthRes.ok || healthRes.status === 400, // 400 = sem tabela especificada, mas API está ativa
        message: `API REST ativa (HTTP ${healthRes.status})`,
        latencyMs: latency,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      results.supabase_api = { ok: false, message: msg }
    }
  }

  const allOk = Object.values(results).every((r) => r.ok)

  return NextResponse.json({
    ok: allOk,
    message: allOk ? 'Todos os serviços ativos.' : 'Alguns serviços com problemas.',
    timestamp: new Date().toISOString(),
    services: results,
  }, { status: allOk ? 200 : 503 })
}
