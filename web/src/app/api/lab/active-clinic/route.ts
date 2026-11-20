import {
  ACTIVE_CLINIC_COOKIE_NAME,
  activeClinicCookieOptions,
  expiredActiveClinicCookieOptions,
} from '@/lib/active-clinic-cookie'
import {
  ApiCsrfError,
  ApiPayloadTooLargeError,
  ApiUnsupportedMediaTypeError,
  ApiValidationError,
  assertAllowedKeys,
  assertSameOriginMutation,
  readJsonObject,
  requiredText,
  safeErrorSummary,
} from '@/lib/api-validation'
import { isUuid } from '@/lib/identifiers'
import { checkIpRateLimit } from '@/lib/ip-rate-limit'
import { recordSecurityEvent } from '@/lib/security-telemetry'
import {
  authorizationFailureJson,
  privateApiJson,
} from '@/lib/server-api-response'
import { authorizeServerRoles } from '@/lib/server-authorization'
import { createClient } from '@/lib/supabase/server'

function badRequest(error: string) {
  return privateApiJson({ ok: false, error, code: 'VALIDATION' }, { status: 400 })
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return privateApiJson(
    {
      ok: false,
      error: 'Muitas alteracoes de clinica em sequencia. Aguarde e tente novamente.',
      code: 'RATE_LIMITED',
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )
}

function handleMutationException(routeLabel: string, err: unknown) {
  if (err instanceof ApiCsrfError) {
    return privateApiJson({ ok: false, error: err.message, code: 'CSRF_REJECTED' }, { status: 403 })
  }
  if (err instanceof ApiPayloadTooLargeError) {
    return privateApiJson({ ok: false, error: err.message, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  }
  if (err instanceof ApiUnsupportedMediaTypeError) {
    return privateApiJson({ ok: false, error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415 })
  }
  if (err instanceof ApiValidationError) {
    return badRequest(err.message)
  }

  console.error(`[${routeLabel}]`, safeErrorSummary(err))
  return privateApiJson(
    { ok: false, error: 'Erro interno ao processar a clinica ativa', code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const authorization = await authorizeServerRoles(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)

    assertSameOriginMutation(request)

    const rateLimit = checkIpRateLimit(request, 'active_clinic_switch', 30, 60_000)
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.retryAfterSeconds)

    const body = await readJsonObject(request)
    assertAllowedKeys(body, ['clinic_id'])
    const clinicId = requiredText(body.clinic_id, 'Clínica', 36)
    if (!isUuid(clinicId)) return badRequest('Clínica inválida')

    const { data: membership, error: membershipError } = await supabase
      .from('clinic_memberships')
      .select('clinic_id, role')
      .eq('user_id', authorization.userId)
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .maybeSingle()

    if (membershipError) {
      recordSecurityEvent({
        event: 'authorization_unavailable',
        status: 503,
        layer: 'authz',
        scope: 'active_clinic_switch',
        code: 'AUTHORIZATION_UNAVAILABLE',
      })
      return privateApiJson(
        { ok: false, error: 'Não foi possível validar a clínica solicitada', code: 'AUTHORIZATION_UNAVAILABLE' },
        { status: 503 },
      )
    }

    if (!membership) {
      return privateApiJson(
        { ok: false, error: 'Clínica não encontrada', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, nome')
      .eq('id', membership.clinic_id)
      .eq('status', 'active')
      .maybeSingle()

    if (clinicError) {
      recordSecurityEvent({
        event: 'authorization_unavailable',
        status: 503,
        layer: 'authz',
        scope: 'active_clinic_switch',
        code: 'AUTHORIZATION_UNAVAILABLE',
      })
      return privateApiJson(
        { ok: false, error: 'Não foi possível validar a clínica solicitada', code: 'AUTHORIZATION_UNAVAILABLE' },
        { status: 503 },
      )
    }

    if (!clinic) {
      return privateApiJson(
        { ok: false, error: 'Clínica não encontrada', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    const response = privateApiJson({
      ok: true,
      id: clinic.id,
      clinicId: clinic.id,
      clinicName: clinic.nome,
      membershipRole: membership.role,
    })
    response.cookies.set(
      ACTIVE_CLINIC_COOKIE_NAME,
      clinic.id,
      activeClinicCookieOptions(process.env.NODE_ENV === 'production'),
    )
    return response
  } catch (err) {
    return handleMutationException('POST /api/lab/active-clinic', err)
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const authorization = await authorizeServerRoles(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)

    assertSameOriginMutation(request)

    const rateLimit = checkIpRateLimit(request, 'active_clinic_clear', 30, 60_000)
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.retryAfterSeconds)

    const response = privateApiJson({ ok: true })
    response.cookies.set(
      ACTIVE_CLINIC_COOKIE_NAME,
      '',
      expiredActiveClinicCookieOptions(process.env.NODE_ENV === 'production'),
    )
    return response
  } catch (err) {
    return handleMutationException('DELETE /api/lab/active-clinic', err)
  }
}
