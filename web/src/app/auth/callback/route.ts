import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIpRateLimit } from '@/lib/ip-rate-limit'
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

type NonRecoveryEmailOtpType = 'signup' | 'email_change' | 'magiclink' | 'invite' | 'email'

const ALLOWED_EMAIL_OTP_TYPES: ReadonlySet<string> = new Set<NonRecoveryEmailOtpType>([
  'signup',
  'email_change',
  'magiclink',
  'invite',
  'email',
])

/**
 * Revalida sessao e papel no servidor e resolve o destino pos-autenticacao.
 * `allowConfirmedWithoutSession` cobre a primeira confirmacao de troca de
 * e-mail (double confirm), em que ainda nao ha sessao ativa.
 */
async function resolveSessionRedirect(
  request: Request,
  supabase: Awaited<ReturnType<typeof createClient>>,
  explicitNext: string | null,
  allowConfirmedWithoutSession = false,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return allowConfirmedWithoutSession
      ? authRedirect(request, '/auth/login?notice=email_confirmado')
      : authRedirect(request, '/auth/login?error=callback')
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

/**
 * Callback OAuth/email do Supabase Auth.
 * Handles PKCE codes and e-mail token hashes (recovery, signup, email change,
 * magic link, invite) without exposing tokens, provider errors or profile
 * details in responses/logs.
 */
export async function GET(request: Request) {
  const rateLimit = checkIpRateLimit(request, 'auth_callback', 20, 60_000)
  if (!rateLimit.allowed) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: {
        ...AUTH_REDIRECT_HEADERS,
        'Retry-After': String(rateLimit.retryAfterSeconds),
      },
    })
  }

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

  if (tokenHash && type && ALLOWED_EMAIL_OTP_TYPES.has(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as NonRecoveryEmailOtpType,
    })

    if (error) {
      return authRedirect(request, '/auth/login?error=callback')
    }
    return resolveSessionRedirect(request, supabase, explicitNext, type === 'email_change')
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

      return resolveSessionRedirect(request, supabase, explicitNext)
    }

    if (type === 'recovery' || explicitNext === '/auth/redefinir-senha') {
      return authRedirect(request, '/auth/recuperar-senha?error=link_expirado')
    }
  }

  return authRedirect(request, '/auth/login?error=callback')
}
