import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de autenticação do Next.js.
 * Protege rotas do SaaS (/lab, /portal, /admin) exigindo sessão válida.
 * Rotas públicas (/, /blog, /ferramentas, /auth) são sempre acessíveis.
 *
 * IMPORTANTE: proxy.ts foi removido — Next.js 16+ reconhece AMBOS como middleware,
 * causando conflito de build. Todo o código vive aqui.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Redirecionamento pós-login baseado em role
  // Garante que tutor não acessa /lab e vet não acessa /portal
  if (user) {
    const pathname = request.nextUrl.pathname

    // Já autenticado tentando acessar login/cadastro — deixa o Server Component decidir
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
    /*
     * Aplica o middleware em todas as rotas EXCETO:
     * - arquivos estáticos (_next/static, _next/image, *.ico, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
