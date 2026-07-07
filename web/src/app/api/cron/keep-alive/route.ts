import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Endpoint acionado por cronjob para manter a base de dados do Supabase ativa (evitando pause no plano free).
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

  try {
    const supabase = await createClient()

    // Realiza uma consulta simples na tabela 'tutores' para sinalizar atividade ao banco
    const { data, error } = await supabase
      .from('tutores')
      .select('id')
      .limit(1)

    if (error) {
      console.error('[Cron Keep-Alive] Erro ao consultar banco:', error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Supabase acordado com sucesso.',
      timestamp: new Date().toISOString(),
      active: true,
    })
  } catch (err: any) {
    console.error('[Cron Keep-Alive] Falha crítica:', err)
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    )
  }
}
