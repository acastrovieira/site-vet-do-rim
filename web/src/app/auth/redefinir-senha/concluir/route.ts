import type { NextRequest } from 'next/server'
import {
  expiredRecoveryCookieOptions,
  isRecoveryDestination,
  RECOVERY_COOKIE_NAME,
  RECOVERY_COOKIE_VALUE,
} from '@/lib/auth-recovery'
import { privateApiJson } from '@/lib/server-api-response'
import { authorizeServerRoles } from '@/lib/server-authorization'
import { roleHome } from '@/lib/route-authorization'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function completionJson(body: unknown, status: number) {
  const response = privateApiJson(body, {
    status,
    headers: { 'Referrer-Policy': 'no-referrer' },
  })

  response.cookies.set(
    RECOVERY_COOKIE_NAME,
    '',
    expiredRecoveryCookieOptions(process.env.NODE_ENV === 'production'),
  )
  return response
}

/**
 * Consome o marcador HttpOnly depois da troca de senha e resolve o destino
 * somente a partir do papel revalidado no servidor.
 */
export async function POST(request: NextRequest) {
  const marker = request.cookies.get(RECOVERY_COOKIE_NAME)?.value
  if (marker !== RECOVERY_COOKIE_VALUE) {
    return completionJson(
      { ok: false, error: 'Recuperacao nao autorizada', code: 'RECOVERY_NOT_AUTHORIZED' },
      403,
    )
  }

  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) {
    return completionJson(
      { ok: false, error: 'Origem nao autorizada', code: 'ORIGIN_NOT_ALLOWED' },
      403,
    )
  }

  try {
    const supabase = await createClient()
    const authorization = await authorizeServerRoles(supabase, ['admin', 'vet', 'tutor'])
    if (!authorization.ok) {
      return completionJson(
        { ok: false, error: 'Nao foi possivel concluir a recuperacao', code: authorization.code },
        authorization.status,
      )
    }

    const redirectTo = roleHome(authorization.role)
    if (!isRecoveryDestination(redirectTo)) {
      return completionJson(
        { ok: false, error: 'Destino de recuperacao invalido', code: 'INVALID_RECOVERY_DESTINATION' },
        500,
      )
    }

    return completionJson({ ok: true, redirectTo }, 200)
  } catch {
    return completionJson(
      { ok: false, error: 'Nao foi possivel concluir a recuperacao', code: 'RECOVERY_COMPLETION_UNAVAILABLE' },
      503,
    )
  }
}
