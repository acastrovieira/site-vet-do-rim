import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Callback OAuth/Email do Supabase Auth.
 * Troca o `code` por sessão e redireciona para o destino correto.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/lab'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Erro: redireciona para login com mensagem
  return NextResponse.redirect(`${origin}/auth/login?error=callback`)
}
