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
import {
  buildReviewedLocalResult,
  parseReviewedLocalExtractionPayload,
} from '@/lib/lab/local-extraction/reviewed-result'
import type { Json } from '@/types/database'
import { CLINICAL_RATE_LIMIT_SCOPES, consumeClinicalRateLimit } from '@/lib/server-rate-limit'

interface Params {
  params: Promise<{ id: string }>
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
 * Persiste somente valores extraídos no dispositivo e explicitamente
 * conferidos pelo usuário. Não chama IA, não consome cota e não gera
 * interpretação clínica. O service role é usado apenas no UPDATE final,
 * após prova de sessão, papel, membership, pet, path canônico e objeto.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    if (!isUuid(id)) return validationError('Laudo invalido')

    const supabase = await createClient()
    const authorization = await authorizeClinicAccess(supabase, ['vet', 'admin'])
    if (!authorization.ok) return authorizationFailureJson(authorization)
    const rateLimit = await consumeClinicalRateLimit(supabase, CLINICAL_RATE_LIMIT_SCOPES.localExtraction)
    if (rateLimit.state === 'limited') {
      return privateApiJson(
        { ok: false, error: 'Muitas extrações em sequência. Aguarde e tente novamente.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }
    if (rateLimit.state === 'unavailable') {
      return privateApiJson(
        { ok: false, error: 'Não foi possível validar o limite de extração.', code: 'RATE_LIMIT_UNAVAILABLE' },
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
    const payload = parseReviewedLocalExtractionPayload(body)

    const { data: laudo, error: laudoError } = await supabase
      .from('laudos_pdf')
      .select('id, pet_id, vet_id, clinic_id, storage_path, status')
      .eq('id', id)
      .maybeSingle()

    if (laudoError) {
      console.error('[POST /api/laudos/:id/results-local] laudo lookup failed', { code: laudoError.code })
      return privateApiJson({ ok: false, error: 'Nao foi possivel verificar o laudo', code: 'LOOKUP_FAILED' }, { status: 503 })
    }
    if (!laudo || laudo.clinic_id !== authorization.clinicId) {
      return privateApiJson({ ok: false, error: 'Laudo nao encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (authorization.membershipRole !== 'clinic_admin' && laudo.vet_id !== authorization.userId) {
      return privateApiJson({ ok: false, error: 'Acesso negado', code: 'FORBIDDEN' }, { status: 403 })
    }
    if (laudo.status !== 'pendente') {
      return privateApiJson(
        { ok: false, error: 'Este laudo nao esta mais pendente', code: 'STATE_CONFLICT' },
        { status: 409 },
      )
    }

    const expectedPath = `clinics/${authorization.clinicId}/laudos/${id}/original.pdf`
    if (laudo.storage_path !== expectedPath) {
      return privateApiJson({ ok: false, error: 'Caminho do laudo invalido', code: 'PATH_MISMATCH' }, { status: 409 })
    }

    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('id, tutor_id, nome, especie, raca, idade_anos, idade_meses, peso_atual, clinic_id')
      .eq('id', laudo.pet_id)
      .eq('clinic_id', authorization.clinicId)
      .maybeSingle()
    if (petError || !pet) {
      return privateApiJson({ ok: false, error: 'Paciente nao encontrado', code: 'PET_NOT_FOUND' }, { status: 404 })
    }

    const { data: tutor } = await supabase
      .from('tutores')
      .select('nome')
      .eq('id', pet.tutor_id)
      .eq('clinic_id', authorization.clinicId)
      .maybeSingle()

    const service = createServiceClient()
    const folder = `clinics/${authorization.clinicId}/laudos/${id}`
    const { data: objects, error: storageError } = await service.storage
      .from('laudos')
      .list(folder, { limit: 2, search: 'original.pdf' })
    if (storageError || !objects?.some((object) => object.name === 'original.pdf')) {
      return privateApiJson(
        { ok: false, error: 'O PDF ainda nao foi confirmado no armazenamento', code: 'PDF_NOT_FOUND' },
        { status: 409 },
      )
    }

    const result = buildReviewedLocalResult(payload, {
      name: pet.nome,
      species: pet.especie,
      breed: pet.raca ?? '',
      age: formatAge(pet.idade_anos, pet.idade_meses),
      weightKg: pet.peso_atual,
      tutor: tutor?.nome ?? '',
    })

    const { data: updated, error: updateError } = await service
      .from('laudos_pdf')
      .update({
        resultado_ia: result as unknown as Json,
        status: 'concluido',
        erro_ia: null,
        tipo_exame: 'laboratorial_local',
      })
      .eq('id', id)
      .eq('pet_id', laudo.pet_id)
      .eq('clinic_id', authorization.clinicId)
      .eq('status', 'pendente')
      .select('id')
      .maybeSingle()

    if (updateError) {
      console.error('[POST /api/laudos/:id/results-local] update failed', { code: updateError.code })
      return privateApiJson({ ok: false, error: 'Nao foi possivel salvar os resultados', code: 'UPDATE_FAILED' }, { status: 503 })
    }
    if (!updated) {
      return privateApiJson(
        { ok: false, error: 'O estado do laudo mudou; recarregue a pagina', code: 'STATE_CONFLICT' },
        { status: 409 },
      )
    }

    return privateApiJson({ ok: true, data: result })
  } catch (error) {
    if (error instanceof ApiPayloadTooLargeError) {
      return privateApiJson({ ok: false, error: error.message, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    if (error instanceof ApiUnsupportedMediaTypeError) {
      return privateApiJson({ ok: false, error: error.message, code: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415 })
    }
    if (error instanceof ApiValidationError) return validationError(error.message)
    console.error('[POST /api/laudos/:id/results-local] unexpected', safeErrorSummary(error))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
