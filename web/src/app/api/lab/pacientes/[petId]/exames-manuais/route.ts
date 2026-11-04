import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ApiPayloadTooLargeError,
  ApiUnsupportedMediaTypeError,
  ApiValidationError,
  readJsonObject,
  safeErrorSummary,
} from '@/lib/api-validation'
import { authorizeClinicAccess } from '@/lib/server-authorization'
import { authorizationFailureJson, privateApiJson } from '@/lib/server-api-response'
import { isUuid } from '@/lib/identifiers'
import { parseManualLabEntryPayload } from '@/lib/lab/manual-entry'
import { buildReviewedLocalResult } from '@/lib/lab/local-extraction/reviewed-result'
import type { Json } from '@/types/database'
import { CLINICAL_RATE_LIMIT_SCOPES, consumeClinicalRateLimit } from '@/lib/server-rate-limit'

interface Params {
  params: Promise<{ petId: string }>
}

function validationError(message: string, status = 400) {
  return privateApiJson({ ok: false, error: message, code: 'VALIDATION' }, { status })
}

function formatAge(years: number | null, months: number | null) {
  const parts: string[] = []
  if (years !== null) parts.push(`${years} ano${years === 1 ? '' : 's'}`)
  if (months !== null) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`)
  return parts.join(' e ')
}

/**
 * Lançamento manual de exame laboratorial — sem PDF, sem OCR e sem IA.
 * Persiste o resultado diretamente como concluído após validação estrita de
 * sessão, clínica, paciente e itens laboratoriais.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { petId } = await params
    if (!isUuid(petId)) return validationError('Paciente invalido')

    const supabase = await createClient()
    const authorization = await authorizeClinicAccess(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)

    const rateLimit = await consumeClinicalRateLimit(supabase, CLINICAL_RATE_LIMIT_SCOPES.localExtraction)
    if (rateLimit.state === 'limited') {
      return privateApiJson(
        { ok: false, error: 'Muitos lançamentos em sequência. Aguarde e tente novamente.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }
    if (rateLimit.state === 'unavailable') {
      return privateApiJson(
        { ok: false, error: 'Não foi possível validar o limite de lançamento.', code: 'RATE_LIMIT_UNAVAILABLE' },
        { status: 503 },
      )
    }

    if (
      !authorization.clinicId
      || !authorization.membershipRole
      || !['vet', 'clinic_admin'].includes(authorization.membershipRole)
    ) {
      return privateApiJson(
        { ok: false, error: 'Clinica ativa nao confirmada', code: 'CLINIC_REQUIRED' },
        { status: 403 },
      )
    }

    const body = await readJsonObject(request, 48 * 1024)
    const payload = parseManualLabEntryPayload(body)

    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('id, tutor_id, nome, especie, raca, idade_anos, idade_meses, peso_atual, clinic_id')
      .eq('id', petId)
      .eq('clinic_id', authorization.clinicId)
      .maybeSingle()

    if (petError) {
      console.error('[POST /api/lab/pacientes/:petId/exames-manuais] pet lookup failed', { code: petError.code })
      return privateApiJson({ ok: false, error: 'Nao foi possivel verificar o paciente', code: 'LOOKUP_FAILED' }, { status: 503 })
    }
    if (!pet) {
      return privateApiJson({ ok: false, error: 'Paciente nao encontrado', code: 'PET_NOT_FOUND' }, { status: 404 })
    }

    const { data: tutor } = await supabase
      .from('tutores')
      .select('nome')
      .eq('id', pet.tutor_id)
      .eq('clinic_id', authorization.clinicId)
      .maybeSingle()

    const result = buildReviewedLocalResult(payload, {
      name: pet.nome,
      species: pet.especie,
      breed: pet.raca ?? '',
      age: formatAge(pet.idade_anos, pet.idade_meses),
      weightKg: pet.peso_atual,
      tutor: tutor?.nome ?? '',
    })

    const service = createServiceClient()
    const laudoId = crypto.randomUUID()
    // chk_laudos_pdf_origem_storage (20260830000000): lançamento manual exige
    // origem 'manual' e nenhum arquivo; o default 'pdf_ia' exigiria storage_path.
    const { error: insertError } = await service
      .from('laudos_pdf')
      .insert({
        id: laudoId,
        pet_id: pet.id,
        vet_id: authorization.userId,
        clinic_id: authorization.clinicId,
        created_by: authorization.userId,
        storage_path: null,
        origem_resultado: 'manual',
        nome_arquivo: payload.laboratory ? `Lançamento manual - ${payload.laboratory}` : 'Lançamento manual',
        tipo_exame: 'laboratorial_manual',
        status: 'concluido',
        resultado_ia: result as unknown as Json,
        erro_ia: null,
      })

    if (insertError) {
      console.error('[POST /api/lab/pacientes/:petId/exames-manuais] insert failed', { code: insertError.code })
      return privateApiJson(
        { ok: false, error: 'Nao foi possivel salvar o exame manual', code: 'INSERT_FAILED' },
        { status: 503 },
      )
    }

    const { error: populateError } = await (service as unknown as {
      rpc: (fn: string, args: { p_laudo_id: string }) => Promise<{ error: { code?: string } | null }>
    }).rpc('populate_exam_result_items', { p_laudo_id: laudoId })
    if (populateError) {
      console.warn('[POST /api/lab/pacientes/:petId/exames-manuais] populate_exam_result_items warning', {
        code: populateError.code,
      })
    }

    return privateApiJson({ ok: true, id: laudoId, data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiPayloadTooLargeError) {
      return privateApiJson({ ok: false, error: error.message, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    if (error instanceof ApiUnsupportedMediaTypeError) {
      return privateApiJson({ ok: false, error: error.message, code: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415 })
    }
    if (error instanceof ApiValidationError) return validationError(error.message)
    console.error('[POST /api/lab/pacientes/:petId/exames-manuais] unexpected', safeErrorSummary(error))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
