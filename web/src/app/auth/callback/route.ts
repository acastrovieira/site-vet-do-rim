import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Callback OAuth/Email do Supabase Auth.
 * Troca o `code` por sessão e redireciona para a área correta pelo role:
 *   - vet / admin → /lab
 *   - tutor       → /portal
 * O parâmetro `next` pode sobrescrever o destino (apenas caminhos relativos).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? ''

  // Segurança: aceita apenas caminhos relativos para prevenir open redirect
  const explicitNext = rawNext.startsWith('/') ? rawNext : ''

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Se o usuário foi redirecionado com ?next= explícito, respeita
      if (explicitNext) {
        return NextResponse.redirect(`${origin}${explicitNext}`)
      }

      // Caso contrário: redireciona por role
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

  // Erro: redireciona para login com mensagem
  return NextResponse.redirect(`${origin}/auth/login?error=callback`)
}
