import {
  ApiValidationError,
  assertAllowedKeys,
  optionalText,
  requiredText,
} from '../api-validation.ts'
import { isCivilDate } from '../civil-date.ts'

export const PET_DEATH_MIN_DATE = '1990-01-01'

export const PET_DEATH_REASON_PRESETS = [
  'Evolução da doença renal crônica',
  'Insuficiência renal aguda refratária',
  'Eutanásia terapêutica assistida',
  'Complicação clínica intercorrente',
  'Outro motivo clínico',
] as const

export interface PetDeathPayload {
  data_obito: string
  motivo: string
  observacoes: string | null
  confirm_pet_name: string
}

/** Retorna a data civil atual em America/Sao_Paulo no formato YYYY-MM-DD. */
export function todayCivilDateSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Valida os campos do payload de registro transacional de óbito. */
export function parsePetDeathPayload(
  body: Record<string, unknown>,
  referenceToday = todayCivilDateSaoPaulo(),
): PetDeathPayload {
  assertAllowedKeys(body, ['data_obito', 'motivo', 'observacoes', 'confirm_pet_name'])

  const dataObito = requiredText(body.data_obito, 'Data do óbito', 10)
  if (!isCivilDate(dataObito)) {
    throw new ApiValidationError('Informe a data do óbito no formato YYYY-MM-DD.')
  }
  if (dataObito < PET_DEATH_MIN_DATE || dataObito > referenceToday) {
    throw new ApiValidationError(
      `A data do óbito deve estar entre ${PET_DEATH_MIN_DATE} e a data atual.`,
    )
  }

  const motivo = requiredText(body.motivo, 'Motivo clínico do óbito', 200)
  if (motivo.length < 3) {
    throw new ApiValidationError('Motivo clínico do óbito deve ter ao menos 3 caracteres.')
  }

  const observacoes = optionalText(body.observacoes, 'Observações clínicas', 1000)
  const confirmPetName = requiredText(body.confirm_pet_name, 'Confirmação do nome do paciente', 120)

  return {
    data_obito: dataObito,
    motivo,
    observacoes,
    confirm_pet_name: confirmPetName,
  }
}

export interface MappedPetDeathError {
  status: 400 | 403 | 404 | 409 | 500
  code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'STATE_CONFLICT' | 'DATABASE'
  error: string
}

/** Traduz mensagens controladas de `private.record_pet_death` para respostas HTTP seguras. */
export function mapRecordPetDeathError(message?: string | null): MappedPetDeathError {
  const normalized = (message ?? '').trim().toLowerCase()

  if (normalized.includes('actor_not_authorized')) {
    return {
      status: 403,
      code: 'FORBIDDEN',
      error: 'Permissão insuficiente para registrar o óbito deste paciente.',
    }
  }

  if (normalized.includes('pet_not_found')) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      error: 'Paciente não encontrado.',
    }
  }

  if (normalized.includes('pet_already_deceased')) {
    return {
      status: 409,
      code: 'STATE_CONFLICT',
      error: 'O óbito deste paciente já foi registrado anteriormente.',
    }
  }

  if (normalized.includes('invalid_death_date')) {
    return {
      status: 400,
      code: 'VALIDATION',
      error: 'A data do óbito é inválida ou posterior à data atual.',
    }
  }

  if (normalized.includes('invalid_death_reason')) {
    return {
      status: 400,
      code: 'VALIDATION',
      error: 'Motivo clínico do óbito inválido.',
    }
  }

  if (normalized.includes('invalid_death_notes')) {
    return {
      status: 400,
      code: 'VALIDATION',
      error: 'Observações clínicas excedem o limite permitido.',
    }
  }

  if (normalized.includes('invalid_request')) {
    return {
      status: 400,
      code: 'VALIDATION',
      error: 'Dados inválidos para registrar o óbito.',
    }
  }

  return {
    status: 500,
    code: 'DATABASE',
    error: 'Não foi possível concluir o registro transacional de óbito.',
  }
}
