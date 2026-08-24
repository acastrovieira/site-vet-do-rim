import { ApiValidationError, assertAllowedKeys, optionalText } from '../../api-validation.ts'
import { isCivilDate } from '../../civil-date.ts'
import type { ResultadoIA } from '../transform-laudo-data.ts'
import { buildCanonicalLaboratoryObservation } from '../canonical-observation.ts'
import { LOCAL_PARAMETER_KEYS } from './parameter-catalog.ts'
import { LOCAL_PARSER_VERSION } from './text-parser.ts'
import { findLocalNumberTokens, parseLocalNumber } from './number-parser.ts'
import type {
  LocalExtractionSource,
  ReviewedLocalExtractionPayload,
  ReviewedLocalItem,
} from './types.ts'

const MAX_ITEMS = 25
const MAX_LAB_VALUE = 1_000_000_000

function optionalBoundedNumber(value: unknown, field: string) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_LAB_VALUE) {
    throw new ApiValidationError(`${field} invalido`)
  }
  return value
}

function optionalCivilDate(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !isCivilDate(value)) {
    throw new ApiValidationError(`${field} invalida`)
  }
  return value
}

function parseSource(value: unknown): LocalExtractionSource {
  if (value !== 'pdf-text' && value !== 'ocr') {
    throw new ApiValidationError('Origem da extracao invalida')
  }
  return value
}

function parseItem(value: unknown, index: number): ReviewedLocalItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiValidationError(`Item ${index + 1} invalido`)
  }
  const item = value as Record<string, unknown>
  assertAllowedKeys(item, [
    'key', 'value', 'valueText', 'unit', 'referenceMin', 'referenceMax',
    'referenceText', 'page',
  ])

  if (typeof item.key !== 'string' || !LOCAL_PARAMETER_KEYS.has(item.key as ReviewedLocalItem['key'])) {
    throw new ApiValidationError(`Parametro ${index + 1} invalido`)
  }
  if (
    typeof item.value !== 'number'
    || !Number.isFinite(item.value)
    || item.value < 0
    || item.value > MAX_LAB_VALUE
  ) {
    throw new ApiValidationError(`Valor ${index + 1} invalido`)
  }
  const valueText = optionalText(item.valueText, `Texto do valor ${index + 1}`, 24)
  const parsedValueText = valueText ? parseLocalNumber(valueText) : null
  if (!valueText || parsedValueText?.value !== item.value || parsedValueText.ambiguous || parsedValueText.qualifier) {
    throw new ApiValidationError(`Evidencia do valor ${index + 1} invalida`)
  }

  const referenceMin = optionalBoundedNumber(item.referenceMin, `Referencia minima ${index + 1}`)
  const referenceMax = optionalBoundedNumber(item.referenceMax, `Referencia maxima ${index + 1}`)
  if (referenceMin !== null && referenceMax !== null && referenceMin > referenceMax) {
    throw new ApiValidationError(`Faixa de referencia ${index + 1} invalida`)
  }
  const referenceText = optionalText(item.referenceText, `Texto da referencia ${index + 1}`, 64)
  if ((referenceMin !== null || referenceMax !== null) && !referenceText) {
    throw new ApiValidationError(`Evidencia da referencia ${index + 1} ausente`)
  }
  if (referenceText) {
    const parsedReference = findLocalNumberTokens(referenceText).map(parseLocalNumber)
    if (
      parsedReference.length !== 2
      || parsedReference.some((number) => number.value === null || number.ambiguous || number.qualifier)
      || parsedReference[0].value !== referenceMin
      || parsedReference[1].value !== referenceMax
    ) {
      throw new ApiValidationError(`Evidencia da referencia ${index + 1} invalida`)
    }
  }
  const page = item.page
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 0 || page > 10_000) {
    throw new ApiValidationError(`Pagina ${index + 1} invalida`)
  }

  return {
    key: item.key as ReviewedLocalItem['key'],
    value: item.value,
    valueText,
    unit: optionalText(item.unit, `Unidade ${index + 1}`, 32),
    referenceMin,
    referenceMax,
    referenceText,
    page,
  }
}

export function parseReviewedLocalExtractionPayload(
  body: Record<string, unknown>,
): ReviewedLocalExtractionPayload {
  assertAllowedKeys(body, ['items', 'laboratory', 'collectionDate', 'resultDate', 'source'])
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
    throw new ApiValidationError('Selecione entre 1 e 25 parametros revisados')
  }

  const items = body.items.map(parseItem)
  if (new Set(items.map((item) => item.key)).size !== items.length) {
    throw new ApiValidationError('Cada parametro pode ser salvo apenas uma vez')
  }

  return {
    items,
    laboratory: optionalText(body.laboratory, 'Laboratorio', 120),
    collectionDate: optionalCivilDate(body.collectionDate, 'Data de coleta'),
    resultDate: optionalCivilDate(body.resultDate, 'Data do resultado'),
    source: parseSource(body.source),
  }
}

interface LocalPatientSnapshot {
  name: string
  species: string
  breed: string
  age: string
  weightKg: number | null
  tutor: string
}

export function buildReviewedLocalResult(
  payload: ReviewedLocalExtractionPayload,
  patient: LocalPatientSnapshot,
): ResultadoIA {
  const values = new Map(payload.items.map((item) => [item.key, item.value]))
  const value = (key: ReviewedLocalItem['key']) => values.get(key) ?? null

  return {
    paciente: {
      nome: patient.name,
      especie: patient.species,
      raca: patient.breed,
      idade: patient.age,
      peso_kg: patient.weightKg,
      tutor: patient.tutor,
    },
    serie_vermelha: {
      hemacias: value('hemacias'), hemoglobina: value('hemoglobina'),
      hematocrito: value('hematocrito'), vcm: value('vcm'), hcm: value('hcm'),
      chcm: value('chcm'), rdw: value('rdw'),
    },
    serie_branca: {
      leucocitos_totais: value('leucocitos_totais'),
      neutrofilos_segmentados: value('neutrofilos_segmentados'),
      neutrofilos_bastoes: value('neutrofilos_bastoes'),
      linfocitos: value('linfocitos'), monocitos: value('monocitos'),
      eosinofilos: value('eosinofilos'), basofilos: value('basofilos'),
    },
    plaquetas: { contagem: value('plaquetas_contagem'), vpm: value('plaquetas_vpm') },
    bioquimica: {
      ureia: value('ureia'), creatinina: value('creatinina'),
      alt_tgp: value('alt_tgp'), ast_tgo: value('ast_tgo'), fosforo: value('fosforo'),
      potassio: value('potassio'), sodio: value('sodio'), albumina: value('albumina'),
      proteina_total: value('proteina_total'),
    },
    interpretacao_ia: {
      resumo: 'Valores extraídos localmente e conferidos pelo usuário. Nenhuma interpretação clínica automática foi gerada.',
      achados_relevantes: [],
      alertas: [],
      estadiamento_iris_sugerido: null,
    },
    laboratorio: payload.laboratory,
    data_coleta: payload.collectionDate,
    data_resultado: payload.resultDate,
    extracao_local: {
      schema_version: 2,
      parser_version: LOCAL_PARSER_VERSION,
      source: payload.source,
      reviewed: true,
      items: payload.items.map((item) => {
        const observation = buildCanonicalLaboratoryObservation({
          parameter: item.key,
          value: item.value,
          printedValue: item.valueText,
          printedUnit: item.unit,
          referenceMin: item.referenceMin,
          referenceMax: item.referenceMax,
          referenceText: item.referenceText,
          referenceSource: item.referenceText ? 'laboratory_report' : 'not_provided',
          source: item.page === 0 ? 'manual' : payload.source,
          page: item.page,
          reviewed: true,
        })
        return {
          parametro: item.key,
          valor: item.value,
          valor_texto: item.valueText,
          unidade: item.unit,
          ref_min: item.referenceMin,
          ref_max: item.referenceMax,
          referencia_texto: item.referenceText,
          pagina: item.page,
          observation,
        }
      }),
    },
  }
}
