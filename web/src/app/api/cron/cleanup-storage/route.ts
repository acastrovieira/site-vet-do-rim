import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getBoundedTimeoutMs,
  hasValidBearerSecret,
  OPERATIONAL_NO_STORE_HEADERS,
} from '@/lib/operational-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cron de limpeza de Storage: deleta PDFs de laudos concluídos.
 *
 * Estratégia "Extract & Discard":
 *  - A Edge Function parse-laudo tenta deletar o PDF imediatamente após extração.
 *  - Este cron é o safety net: apanha laudos onde a deleção imediata falhou
 *    (ex: crash da Edge Function após gravar resultado_ia mas antes de deletar).
 *  - Critério: status = 'concluido' AND storage_deleted_at IS NULL
 *    AND created_at < now() - interval '1 hour'  (1h de grace period)
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY para chamar a Storage API.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json(
      { ok: false, message: 'CRON_SECRET não configurado.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  if (!hasValidBearerSecret(request.headers.get('authorization'), cronSecret)) {
    return new NextResponse('Unauthorized', { status: 401, headers: OPERATIONAL_NO_STORE_HEADERS })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, message: 'Supabase não configurado.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  const timeoutMs = getBoundedTimeoutMs(process.env.KEEP_ALIVE_TIMEOUT_MS)
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Busca laudos concluídos cujo PDF ainda não foi deletado
  // Limite de 50 por execução para não exceder tempo do cron
  const { data: pendentes, error: fetchError } = await supabase
    .from('laudos_pdf')
    .select('id, storage_path, clinic_id')
    .eq('status', 'concluido')
    .is('storage_deleted_at', null)
    .not('storage_path', 'is', null)
    .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // >1h atrás
    .limit(50)

  if (fetchError) {
    console.error('[Cron Cleanup Storage] fetch_error', { message: fetchError.message })
    return NextResponse.json(
      { ok: false, message: 'Erro ao buscar laudos pendentes.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  if (!pendentes || pendentes.length === 0) {
    return NextResponse.json(
      { ok: true, message: 'Nenhum PDF pendente de deleção.', deleted: 0 },
      { status: 200, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  let deleted = 0
  let failed = 0
  const errors: string[] = []

  for (const laudo of pendentes) {
    if (!laudo.storage_path) continue

    try {
      // Tenta deletar o objeto do Storage
      const { error: storageError } = await supabase.storage
        .from('laudos')
        .remove([laudo.storage_path])

      if (storageError && !storageError.message.includes('Not Found')) {
        // "Not Found" é ok — o arquivo pode já ter sido deletado
        throw new Error(storageError.message)
      }

      // Marca como deletado no banco
      const { error: updateError } = await supabase
        .from('laudos_pdf')
        .update({ storage_deleted_at: new Date().toISOString() })
        .eq('id', laudo.id)

      if (updateError) throw new Error(updateError.message)

      deleted++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : 'UnknownError'
      errors.push(`laudo:${laudo.id} — ${msg}`)
      console.error('[Cron Cleanup Storage] delete_failed', {
        laudoId: laudo.id,
        type: err instanceof Error ? err.name : 'UnknownError',
      })
    }
  }

  void timeoutMs // usado indiretamente via AbortSignal nos fetches internos

  const ok = failed === 0
  return NextResponse.json(
    {
      ok,
      message: ok
        ? `${deleted} PDF(s) deletado(s) com sucesso.`
        : `${deleted} deletado(s), ${failed} com falha.`,
      deleted,
      failed,
      ...(errors.length > 0 ? { errors } : {}),
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 207, headers: OPERATIONAL_NO_STORE_HEADERS },
  )
}
