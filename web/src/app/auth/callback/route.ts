import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Callback OAuth/Email do Supabase Auth.
 * Trata dois fluxos:
 *   1. code  → login/cadastro normal → redireciona por role
 *   2. token_hash + type=recovery → reset de senha → /auth/redefinir-senha
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type')
  const rawNext   = searchParams.get('next') ?? ''

  // Segurança: aceita apenas caminhos relativos
  const explicitNext = rawNext.startsWith('/') ? rawNext : ''

  // ── Fluxo 1: recuperação de senha (token_hash) ─────────────────────────────
  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })

    if (!error) {
      return NextResponse.redirect(`${origin}/auth/redefinir-senha`)
    }

    return NextResponse.redirect(`${origin}/auth/recuperar-senha?error=link_expirado`)
  }

  // ── Fluxo 2: confirmação de email (code) ────────────────────────────────────
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Recuperação de senha via PKCE (type=recovery ou next=/auth/redefinir-senha)
      if (type === 'recovery' || explicitNext === '/auth/redefinir-senha') {
        return NextResponse.redirect(`${origin}/auth/redefinir-senha`)
      }

      if (explicitNext) {
        return NextResponse.redirect(`${origin}${explicitNext}`)
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single() as { data: { role: string } | null; error: Error | null }

        const destination = profile?.role === 'tutor' ? '/portal' : '/lab'
        return NextResponse.redirect(`${origin}${destination}`)
      }

      return NextResponse.redirect(`${origin}/lab`)
    }
  }

  // ── Erro: redireciona para login com mensagem ───────────────────────────────
  return NextResponse.redirect(`${origin}/auth/login?error=callback`)
}
