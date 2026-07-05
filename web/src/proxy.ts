import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { requirePublicEnv } from '@/lib/env'

/**
 * Proxy de autenticação — Next.js 16.2+ renomeou middleware para proxy.
 * Arquivo: proxy.ts | Função: proxy (era middleware)
 *
 * Protege rotas do SaaS (/lab, /portal, /admin) exigindo sessão válida.
 * Rotas públicas (/, /blog, /ferramentas, /auth) são sempre acessíveis.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: Não escreva lógica aqui entre createServerClient e getUser.
  // getUser() é necessário para atualizar o token de sessão automaticamente.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Defesa: code/token_hash pousou em página errada ─────────────────────────
  // Acontece quando o Site URL no Supabase aponta para a raiz em vez de /auth/callback.
  // Redireciona qualquer ?code= ou ?token_hash= para o callback correto.
  const pathname = request.nextUrl.pathname
  const code      = request.nextUrl.searchParams.get('code')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')

  if ((code || tokenHash) && pathname !== '/auth/callback') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  // Rotas protegidas — requer autenticação
  const protectedRoutes = ['/lab', '/portal', '/dashboard', '/admin']
  const isProtected = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    // Já autenticado tentando acessar login/cadastro — Server Component decide
    if (pathname === '/auth/login' || pathname === '/auth/cadastro') {
      return supabaseResponse
    }

    // Tutor tentando acessar área de vet
    if (pathname.startsWith('/lab') || pathname.startsWith('/admin')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'tutor') {
        const url = request.nextUrl.clone()
        url.pathname = '/portal'
        return NextResponse.redirect(url)
      }
    }

    // Vet tentando acessar área de tutor
    if (pathname.startsWith('/portal')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'vet' || profile?.role === 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/lab'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
