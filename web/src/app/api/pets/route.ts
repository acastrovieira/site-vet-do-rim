import { createClient } from '@/lib/supabase/server'
import {
  ApiUnsupportedMediaTypeError,
  ApiPayloadTooLargeError,
  ApiValidationError,
  assertAllowedKeys,
  optionalNumber,
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
import { isUuid } from '@/lib/identifiers'

const ESPECIES = new Set(['canino', 'felino', 'equino', 'bovino', 'suino', 'ave', 'roedor', 'reptil', 'outro'])
const STATUS = new Set(['ativo', 'em_tratamento', 'alta', 'inativo', 'obito'])

function badRequest(error: string) {
  return privateApiJson({ ok: false, error, code: 'VALIDATION' }, { status: 400 })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const authorization = await authorizeClinicAccess(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)

    const body = await readJsonObject(request)
    assertAllowedKeys(body, [
      'nome',
      'tutor_id',
      'especie',
      'raca',
      'idade_anos',
      'idade_meses',
      'peso_atual',
      'status_paciente',
    ])

    const nome = requiredText(body.nome, 'Nome', 120)
    const tutorId = requiredText(body.tutor_id, 'Tutor', 36)
    const especie = requiredText(body.especie, 'Especie', 32).toLowerCase()
    const raca = optionalText(body.raca, 'Raca', 120)
    const idadeAnos = optionalNumber(body.idade_anos, 'Idade em anos', 0, 40, { integer: true })
    const idadeMeses = optionalNumber(body.idade_meses, 'Idade em meses', 0, 11, { integer: true })
    const pesoAtual = optionalNumber(body.peso_atual, 'Peso atual', 0.01, 250)
    const statusPaciente = body.status_paciente === undefined || body.status_paciente === null
      ? 'ativo'
      : requiredText(body.status_paciente, 'Status', 32).toLowerCase()

    if (!isUuid(tutorId)) return badRequest('Tutor invalido')
    if (!ESPECIES.has(especie)) return badRequest('Especie invalida')
    if (!STATUS.has(statusPaciente)) return badRequest('Status invalido')

    // Fase 1.5 (ADR-001): quando ja existe contexto de clinica, o tutor
    // precisa pertencer a mesma clinica antes do insert (defesa em
    // profundidade alem da FK composta `fk_pets_tutor_same_clinic`, que ainda
    // esta NOT VALID nesta fase). Tutor de outra clinica -> 404, nunca 403,
    // para nao confirmar a existencia do registro (ADR §6.2).
    if (authorization.clinicId) {
      const { data: tutorRow, error: tutorLookupError } = await supabase
        .from('tutores')
        .select('id')
        .eq('id', tutorId)
        .eq('clinic_id', authorization.clinicId)
        .maybeSingle()

      if (tutorLookupError) {
        console.error('[POST /api/pets] Tutor lookup failed', {
          code: tutorLookupError.code ?? 'UNKNOWN',
        })
        return privateApiJson(
          { ok: false, error: 'Nao foi possivel confirmar o tutor.', code: 'DATABASE' },
          { status: 500 },
        )
      }
      if (!tutorRow) {
        return privateApiJson(
          { ok: false, error: 'Tutor nao encontrado.', code: 'NOT_FOUND' },
          { status: 404 },
        )
      }
    }

    const { data, error } = await supabase
      .from('pets')
      .insert({
        nome,
        tutor_id: tutorId,
        especie,
        raca,
        idade_anos: idadeAnos,
        idade_meses: idadeMeses,
        peso_atual: pesoAtual,
        status_paciente: statusPaciente,
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
      console.error('[POST /api/pets]', {
        code: error?.code ?? 'UNKNOWN',
      })

      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      const isConstraint = error?.code === '23503' || error?.code === '23514' || error?.code === '22P02'
      return privateApiJson(
        {
          ok: false,
          error: isRLS
            ? 'Permissao insuficiente para criar paciente.'
            : isConstraint
              ? 'Dados invalidos para criar paciente.'
              : 'Nao foi possivel criar o paciente.',
          code: isRLS ? 'RLS_DENIED' : isConstraint ? 'VALIDATION' : 'DATABASE',
        },
        { status: isRLS ? 403 : isConstraint ? 400 : 500 }
      )
    }

    return privateApiJson({ ok: true, id: data.id }, { status: 201 })
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
    console.error('[POST /api/pets] Unexpected error:', safeErrorSummary(err))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
