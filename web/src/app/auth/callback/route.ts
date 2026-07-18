import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isRoleAuthorizedForRedirect,
  parseAppRole,
  roleHome,
  safeInternalRedirectPath,
} from '@/lib/route-authorization'
import {
  isVerifiedRecoveryExchange,
  RECOVERY_COOKIE_NAME,
  RECOVERY_COOKIE_VALUE,
  recoveryCookieOptions,
} from '@/lib/auth-recovery'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AUTH_REDIRECT_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Expires: '0',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
} as const

function authRedirect(
  request: Request,
  path: string,
  recoveryVerified = false,
) {
  const response = NextResponse.redirect(new URL(path, request.url), {
    headers: AUTH_REDIRECT_HEADERS,
  })
  if (recoveryVerified) {
    response.cookies.set(
      RECOVERY_COOKIE_NAME,
      RECOVERY_COOKIE_VALUE,
      recoveryCookieOptions(process.env.NODE_ENV === 'production'),
    )
  } else {
    response.cookies.set(RECOVERY_COOKIE_NAME, '', {
      ...recoveryCookieOptions(process.env.NODE_ENV === 'production'),
      maxAge: 0,
    })
  }
  return response
}

/**
 * Callback OAuth/email do Supabase Auth.
 * Handles both PKCE codes and recovery token hashes without exposing tokens,
 * provider errors or profile details in responses/logs.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const explicitNext = safeInternalRedirectPath(searchParams.get('next'))

  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })

    return !error
      ? authRedirect(request, '/auth/redefinir-senha', true)
      : authRedirect(request, '/auth/recuperar-senha?error=link_expirado')
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const exchangeRedirectType = 'redirectType' in data
        ? data.redirectType
        : null
      if (isVerifiedRecoveryExchange(exchangeRedirectType)) {
        return authRedirect(request, '/auth/redefinir-senha', true)
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        return authRedirect(request, '/auth/login?error=callback')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const role = parseAppRole(profile?.role)

      if (profileError || !role) {
        return authRedirect(request, '/auth/login?error=profile')
      }

      const destination = explicitNext && isRoleAuthorizedForRedirect(explicitNext, role)
        ? explicitNext
        : roleHome(role)
      return authRedirect(request, destination)
    }

    if (type === 'recovery' || explicitNext === '/auth/redefinir-senha') {
      return authRedirect(request, '/auth/recuperar-senha?error=link_expirado')
    }
  }

  return authRedirect(request, '/auth/login?error=callback')
}
