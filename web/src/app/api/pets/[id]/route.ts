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
import { authorizeServerRoles } from '@/lib/server-authorization'
import {
  authorizationFailureJson,
  privateApiJson,
} from '@/lib/server-api-response'
import { isUuid } from '@/lib/identifiers'

interface Params {
  params: Promise<{ id: string }>
}

const ESPECIES = new Set(['canino', 'felino', 'equino', 'bovino', 'suino', 'ave', 'roedor', 'reptil', 'outro'])
const STATUS = new Set(['ativo', 'em_tratamento', 'alta', 'inativo', 'obito'])

function badRequest(error: string) {
  return privateApiJson({ ok: false, error, code: 'VALIDATION' }, { status: 400 })
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    if (!isUuid(id)) {
      return badRequest('ID de paciente invalido')
    }

    const supabase = await createClient()
    const authorization = await authorizeServerRoles(supabase, ['vet', 'admin'])
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

    const updates: {
      nome?: string
      tutor_id?: string
      especie?: string
      raca?: string | null
      idade_anos?: number | null
      idade_meses?: number | null
      peso_atual?: number | null
      status_paciente?: string
    } = {}
    let expectedStatus: string | null = null

    if (body.nome !== undefined) {
      updates.nome = requiredText(body.nome, 'Nome', 120)
    }

    if (body.tutor_id !== undefined) {
      const tutorId = requiredText(body.tutor_id, 'Tutor', 36)
      if (!isUuid(tutorId)) return badRequest('Tutor invalido')
      updates.tutor_id = tutorId
    }

    if (body.especie !== undefined) {
      const especie = requiredText(body.especie, 'Especie', 32).toLowerCase()
      if (!ESPECIES.has(especie)) return badRequest('Especie invalida')
      updates.especie = especie
    }

    if (body.raca !== undefined) updates.raca = optionalText(body.raca, 'Raca', 120)
    if (body.idade_anos !== undefined) updates.idade_anos = optionalNumber(body.idade_anos, 'Idade em anos', 0, 40, { integer: true })
    if (body.idade_meses !== undefined) updates.idade_meses = optionalNumber(body.idade_meses, 'Idade em meses', 0, 11, { integer: true })
    if (body.peso_atual !== undefined) updates.peso_atual = optionalNumber(body.peso_atual, 'Peso atual', 0.01, 250)
    if (body.status_paciente !== undefined) {
      const status = requiredText(body.status_paciente, 'Status', 32).toLowerCase()
      if (!STATUS.has(status)) return badRequest('Status invalido')

      if (status === 'obito') {
        return privateApiJson(
          {
            ok: false,
            error: 'O registro de obito exige o fluxo transacional dedicado.',
            code: 'DEATH_WORKFLOW_UNAVAILABLE',
          },
          { status: 409 },
        )
      }

      const { data: currentPet, error: currentPetError } = await supabase
        .from('pets')
        .select('status_paciente')
        .eq('id', id)
        .maybeSingle()

      if (currentPetError || !currentPet) {
        console.error('[PATCH /api/pets/:id] Status lookup failed', {
          code: currentPetError?.code ?? 'NOT_FOUND',
        })
        const isRLS = currentPetError?.code === '42501'
          || currentPetError?.message?.toLowerCase().includes('row-level')
        return privateApiJson(
          {
            ok: false,
            error: isRLS
              ? 'Permissao insuficiente para atualizar paciente.'
              : currentPetError
                ? 'Nao foi possivel confirmar o estado do paciente.'
                : 'Paciente nao encontrado.',
            code: isRLS ? 'RLS_DENIED' : currentPetError ? 'DATABASE' : 'NOT_FOUND',
          },
          { status: isRLS ? 403 : currentPetError ? 500 : 404 },
        )
      }

      if (currentPet.status_paciente === 'obito') {
        return privateApiJson(
          {
            ok: false,
            error: 'O status de obito exige um fluxo auditavel de correcao.',
            code: 'DEATH_STATUS_IMMUTABLE',
          },
          { status: 409 },
        )
      }

      expectedStatus = currentPet.status_paciente
      updates.status_paciente = status
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('Nenhum campo para atualizar')
    }

    let updateQuery = supabase
      .from('pets')
      .update(updates)
      .eq('id', id)

    if (expectedStatus !== null) {
      updateQuery = updateQuery.eq('status_paciente', expectedStatus)
    }

    const { data, error } = await updateQuery
      .select('id')
      .maybeSingle()

    if (error || !data) {
      console.error('[PATCH /api/pets/:id]', {
        code: error?.code ?? 'UNKNOWN',
      })

      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      const isNotFound = error?.code === 'PGRST116'
      const isConstraint = error?.code === '23503' || error?.code === '23514' || error?.code === '22P02'
      const isMissing = expectedStatus === null && !error && !data
      const isStateConflict = expectedStatus !== null && !data && (!error || isNotFound)
      return privateApiJson(
        {
          ok: false,
          error: isRLS
            ? 'Permissao insuficiente para atualizar paciente.'
            : isMissing
              ? 'Paciente nao encontrado.'
            : isStateConflict
              ? 'O paciente foi alterado por outra operacao. Atualize a tela antes de tentar novamente.'
            : isNotFound
              ? 'Paciente nao encontrado.'
              : isConstraint
                ? 'Dados invalidos para atualizar paciente.'
                : 'Nao foi possivel atualizar o paciente.',
          code: isRLS
            ? 'RLS_DENIED'
            : isMissing
              ? 'NOT_FOUND'
            : isStateConflict
              ? 'STATE_CONFLICT'
              : isNotFound
                ? 'NOT_FOUND'
                : isConstraint
                  ? 'VALIDATION'
                  : 'DATABASE',
        },
        { status: isRLS ? 403 : isMissing ? 404 : isStateConflict ? 409 : isNotFound ? 404 : isConstraint ? 400 : 500 }
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
    console.error('[PATCH /api/pets/:id] Unexpected error:', safeErrorSummary(err))
    return privateApiJson({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
