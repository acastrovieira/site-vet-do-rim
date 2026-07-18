import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { requirePublicEnv } from '@/lib/env'
import {
  isRoleAuthorized,
  parseAppRole,
  requiredRoles,
  requiresAuthentication,
  roleHome,
} from '@/lib/route-authorization'

const AUTH_NO_STORE = 'private, no-store, no-cache, max-age=0, must-revalidate'

function markAuthResponsePrivate(response: NextResponse) {
  response.headers.set('Cache-Control', AUTH_NO_STORE)
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  return response
}

function redirectPreservingSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const response = NextResponse.redirect(url)
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  return markAuthResponsePrivate(response)
}

/**
 * Proxy de autenticação — Next.js 16.2+ renomeou middleware para proxy.
 * Arquivo: proxy.ts | Função: proxy (era middleware)
 *
 * Protege rotas do SaaS (/lab, /portal, /admin) exigindo sessão válida.
 * Rotas públicas (/, /blog, /ferramentas, /auth) são sempre acessíveis.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const code = request.nextUrl.searchParams.get('code')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')

  // Defesa: um código PKCE/token de recuperação pode cair na raiz se o Site URL
  // estiver incorreto. O callback fará a troca; não é preciso consultar Auth aqui.
  if ((code || tokenHash) && pathname !== '/auth/callback') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return markAuthResponsePrivate(NextResponse.redirect(url))
  }

  const isProtected = requiresAuthentication(pathname)
  // Rotas públicas e APIs com autenticação própria não pagam uma chamada remota
  // a Auth. Liveness/readiness também permanecem independentes da sessão.
  if (!isProtected) return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([name, value]) =>
            supabaseResponse.headers.set(name, value)
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

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return markAuthResponsePrivate(response)
  }

  const roles = requiredRoles(pathname)
  if (roles) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = parseAppRole(profile?.role)
    if (profileError || !role) {
      return redirectPreservingSession(request, supabaseResponse, '/auth/login')
    }

    if (!isRoleAuthorized(pathname, role)) {
      return redirectPreservingSession(request, supabaseResponse, roleHome(role))
    }
  }

  return markAuthResponsePrivate(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
