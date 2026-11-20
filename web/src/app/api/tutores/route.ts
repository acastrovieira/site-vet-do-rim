import { createClient } from '@/lib/supabase/server'
import {
  ApiCsrfError,
  ApiUnsupportedMediaTypeError,
  ApiPayloadTooLargeError,
  ApiValidationError,
  assertAllowedKeys,
  assertSameOriginMutation,
  optionalText,
  readJsonObject,
  requiredText,
  safeErrorSummary,
} from '@/lib/api-validation'
import { authorizeClinicAccess } from '@/lib/server-authorization'
import {
  authorizationFailureJson,
  privateApiJson,
} from '@/lib/server-api-response'
import { CLINICAL_RATE_LIMIT_SCOPES, consumeClinicalRateLimit } from '@/lib/server-rate-limit'
import { recordSecurityEvent } from '@/lib/security-telemetry'

const UF_RE = /^[A-Z]{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidCpf(value: string): boolean {
  if (!/^[\d.\-\s]+$/.test(value)) return false
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum1 = 0
  for (let i = 0; i < 9; i += 1) {
    sum1 += Number(digits[i]) * (10 - i)
  }
  const check1 = (sum1 * 10) % 11 === 10 ? 0 : (sum1 * 10) % 11
  if (check1 !== Number(digits[9])) return false

  let sum2 = 0
  for (let i = 0; i < 10; i += 1) {
    sum2 += Number(digits[i]) * (11 - i)
  }
  const check2 = (sum2 * 10) % 11 === 10 ? 0 : (sum2 * 10) % 11
  return check2 === Number(digits[10])
}

function validateOptionalCpf(value: string | null): string | null {
  if (!value) return null
  if (!isValidCpf(value)) {
    throw new ApiValidationError('CPF inválido.')
  }
  return value.replace(/\D/g, '')
}

function badRequest(error: string) {
  return privateApiJson({ ok: false, error, code: 'VALIDATION' }, { status: 400 })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const authorization = await authorizeClinicAccess(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)

    assertSameOriginMutation(request)

    const rateLimit = await consumeClinicalRateLimit(supabase, CLINICAL_RATE_LIMIT_SCOPES.tutoresMutation)
    if (rateLimit.state === 'limited') {
      return privateApiJson(
        { ok: false, error: 'Muitas operações em sequência. Aguarde e tente novamente.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }
    if (rateLimit.state === 'unavailable') {
      return privateApiJson(
        { ok: false, error: 'Não foi possível validar o limite da operação.', code: 'RATE_LIMIT_UNAVAILABLE' },
        { status: 503 },
      )
    }

    const body = await readJsonObject(request)
    assertAllowedKeys(body, [
      'nome',
      'telefone',
      'whatsapp',
      'email',
      'cpf',
      'endereco',
      'cep',
      'cidade',
      'estado',
      'notas',
      'lgpd_aceito',
    ])

    if (body.lgpd_aceito !== undefined && typeof body.lgpd_aceito !== 'boolean') {
      throw new ApiValidationError('Consentimento LGPD inválido.')
    }

    const nome = requiredText(body.nome, 'Nome', 120)
    const telefone = requiredText(body.telefone, 'Telefone', 32)
    const email = optionalText(body.email, 'Email', 254)
    const cpf = validateOptionalCpf(optionalText(body.cpf, 'CPF', 32))
    const cep = optionalText(body.cep, 'CEP', 16)
    const endereco = optionalText(body.endereco, 'Endereco', 255)
    const cidade = optionalText(body.cidade, 'Cidade', 120)
    const estado = optionalText(body.estado, 'Estado', 2)?.toUpperCase() ?? null

    if (email && !EMAIL_RE.test(email)) return badRequest('Email invalido')
    if (estado && !UF_RE.test(estado)) return badRequest('Estado invalido')

    const { data, error } = await supabase
      .from('tutores')
      .insert({
        nome,
        telefone,
        email,
        cpf,
        cep,
        endereco,
        cidade,
        estado,
        // Só registra consentimento quando o tutor aceitou explicitamente.
        lgpd_aceito_em: body.lgpd_aceito === true ? new Date().toISOString() : null,
        // clinic_id/created_by nunca vem do body (assertAllowedKeys ja
        // bloqueia campos extras); so gravamos quando ha contexto de clinica
        // resolvido no servidor (ver server-clinic-context.ts).
        ...(authorization.clinicId
          ? { clinic_id: authorization.clinicId, created_by: authorization.userId }
          : {}),
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[POST /api/tutores]', {
        code: error?.code ?? 'UNKNOWN',
      })

      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      if (isRLS) {
        recordSecurityEvent({
          event: 'rls_denied',
          status: 403,
          layer: 'api',
          scope: '/api/tutores',
          code: 'RLS_DENIED',
        })
      }
      const isConflict = error?.code === '23505'
      const isConstraint = error?.code === '23503' || error?.code === '23514' || error?.code === '22P02'
      return privateApiJson(
        {
          ok: false,
          error: isRLS
            ? 'Permissao insuficiente para criar tutor.'
            : isConflict
              ? 'Tutor ja cadastrado com estes dados.'
              : isConstraint
                ? 'Dados invalidos para criar tutor.'
                : 'Nao foi possivel criar o tutor.',
          code: isRLS ? 'RLS_DENIED' : isConflict ? 'CONFLICT' : isConstraint ? 'VALIDATION' : 'DATABASE',
        },
        { status: isRLS ? 403 : isConflict ? 409 : isConstraint ? 400 : 500 }
      )
    }

    return privateApiJson({ ok: true, id: data.id }, { status: 201 })
  } catch (err) {
    if (err instanceof ApiCsrfError) {
      return privateApiJson(
        { ok: false, error: err.message, code: 'CSRF_REJECTED' },
        { status: 403 },
      )
    }
    if (err instanceof ApiPayloadTooLargeError) {
      return privateApiJson(
        { ok: false, error: err.message, code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 },
      )
    }
    if (err instanceof ApiUnsupportedMediaTypeError) {
      return privateApiJson(
        { ok: false, error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' },
        { status: 415 },
      )
    }
    if (err instanceof ApiValidationError) return badRequest(err.message)
    console.error('[POST /api/tutores] Unexpected error:', safeErrorSummary(err))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
