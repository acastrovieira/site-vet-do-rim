import { createClient } from '@/lib/supabase/server'
import {
  ApiUnsupportedMediaTypeError,
  ApiPayloadTooLargeError,
  ApiValidationError,
  assertAllowedKeys,
  optionalText,
  readJsonObject,
  requiredText,
  safeErrorSummary,
} from '@/lib/api-validation'
import type { Database } from '@/types/database'
import { authorizeClinicAccess } from '@/lib/server-authorization'
import {
  authorizationFailureJson,
  privateApiJson,
} from '@/lib/server-api-response'
import { isUuid } from '@/lib/identifiers'

interface Params {
  params: Promise<{ id: string }>
}

type TutorUpdate = Database['public']['Tables']['tutores']['Update']

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

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    if (!isUuid(id)) {
      return badRequest('ID de tutor invalido')
    }

    const supabase = await createClient()
    const authorization = await authorizeClinicAccess(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)

    const body = await readJsonObject(request)
    assertAllowedKeys(body, [
      'nome',
      'telefone',
      'email',
      'cpf',
      'cep',
      'endereco',
      'cidade',
      'estado',
    ])

    const updates: TutorUpdate = {}

    if (body.nome !== undefined) {
      updates.nome = requiredText(body.nome, 'Nome', 120)
    }

    if (body.telefone !== undefined) {
      updates.telefone = requiredText(body.telefone, 'Telefone', 32)
    }

    for (const field of ['email', 'cpf', 'cep', 'endereco', 'cidade', 'estado'] as const) {
      if (body[field] !== undefined) {
        const maxLength = field === 'email'
          ? 254
          : field === 'endereco'
            ? 255
            : field === 'cidade'
              ? 120
              : field === 'estado'
                ? 2
                : field === 'cep'
                  ? 16
                  : 32
        const parsedValue = optionalText(body[field], field, maxLength)
        const value = field === 'estado'
          ? parsedValue?.toUpperCase() ?? null
          : field === 'cpf'
            ? validateOptionalCpf(parsedValue)
            : parsedValue
        if (field === 'email' && value && !EMAIL_RE.test(value)) return badRequest('Email invalido')
        if (field === 'estado' && value && !UF_RE.test(value)) return badRequest('Estado invalido')
        updates[field] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('Nenhum campo para atualizar')
    }

    let updateQuery = supabase
      .from('tutores')
      .update(updates)
      .eq('id', id)

    // Fase 1.5 (ADR-001): filtra por clinica ativa quando ha contexto
    // resolvido. UUID de outro tenant nao pode ser confirmado nem alterado —
    // a ausencia de linha correspondente vira 404 abaixo (nunca 403).
    if (authorization.clinicId) {
      updateQuery = updateQuery.eq('clinic_id', authorization.clinicId)
    }

    const { data, error } = await updateQuery
      .select('id')
      .single()

    if (error || !data) {
      console.error('[PATCH /api/tutores/:id]', {
        code: error?.code ?? 'UNKNOWN',
      })

      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      const isNotFound = error?.code === 'PGRST116'
      return privateApiJson(
        {
          ok: false,
          error: isRLS
            ? 'Permissao insuficiente para atualizar tutor.'
            : isNotFound
              ? 'Tutor nao encontrado.'
              : 'Nao foi possivel atualizar o tutor.',
          code: isRLS ? 'RLS_DENIED' : isNotFound ? 'NOT_FOUND' : 'DATABASE',
        },
        { status: isRLS ? 403 : isNotFound ? 404 : 500 }
      )
    }

    return privateApiJson({ ok: true, id: data.id })
  } catch (err) {
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
    console.error('[PATCH /api/tutores/:id] Unexpected error:', safeErrorSummary(err))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
