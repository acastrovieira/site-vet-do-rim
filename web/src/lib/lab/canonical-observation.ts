/**
 * Contrato canônico para uma observação laboratorial revisada.
 *
 * Este módulo não contém intervalos clínicos e não converte escalas. A
 * comparação é permitida somente contra a faixa impressa no mesmo laudo,
 * preservada como texto e com unidade dimensionalmente idêntica.
 */

export type LabValueQualifier = '<' | '<=' | '>' | '>=' | null

export type LaboratoryReferenceSource =
  | 'laboratory_report'
  | 'not_provided'
  | 'legacy_catalog'

export type LaboratoryReferenceStatus =
  | 'below'
  | 'within'
  | 'above'
  | 'not_classified'

export type LaboratoryReferenceStatusReason =
  | 'laboratory_interval_applied'
  | 'measurement_missing'
  | 'qualified_measurement'
  | 'measurement_unit_missing'
  | 'reference_not_from_report'
  | 'reference_text_missing'
  | 'reference_incomplete'
  | 'reference_invalid'
  | 'reference_unit_missing'
  | 'unit_mismatch'

export interface LaboratoryReferenceAssessment {
  status: LaboratoryReferenceStatus
  reason: LaboratoryReferenceStatusReason
}

export interface LaboratoryReferenceInput {
  value: number | null
  qualifier?: LabValueQualifier
  measurementUnit: string | null
  referenceMin: number | null
  referenceMax: number | null
  referenceText: string | null
  referenceUnit: string | null
  referenceSource: LaboratoryReferenceSource
}

export interface CanonicalLaboratoryObservation {
  parameter: string
  measurement: {
    value: number | null
    /** Transcrição revisada; não é reconstruída a partir do número. */
    printedValue: string
    qualifier: LabValueQualifier
    /** Texto revisado da unidade que constava no laudo. */
    printedUnit: string | null
    canonicalUnit: string | null
  }
  reference: {
    min: number | null
    max: number | null
    /** Transcrição revisada da faixa impressa no laudo. */
    printedText: string | null
    printedUnit: string | null
    canonicalUnit: string | null
    source: LaboratoryReferenceSource
  }
  assessment: LaboratoryReferenceAssessment
  evidence: {
    source: 'pdf-text' | 'ocr' | 'manual'
    page: number | null
    reviewed: boolean
  }
}

function compactUnit(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00b5\u03bc]/g, 'u')
    .replace(/\s+/g, '')
    .replace(/[\u00d7x]/gi, 'x')
    .replace(/\^?([36])/g, '$1')
    .toLowerCase()
}

/**
 * Normaliza apenas variações tipográficas seguras. Não transforma valor
 * nem converte `/µL` para `×10³/µL` (ou vice-versa).
 */
export function canonicalizeLaboratoryUnit(unit: string | null): string | null {
  if (!unit?.trim()) return null
  const compact = compactUnit(unit)

  if (/^(?:cel(?:ulas?)?)?\/(?:ul|mm3)$/.test(compact)) return '/µL'
  if (/^x?103\/(?:ul|mm3)$/.test(compact)) return '×10³/µL'
  if (/^x?106\/(?:ul|mm3)$/.test(compact)) return '×10⁶/µL'
  if (compact === 'mg/dl') return 'mg/dL'
  if (compact === 'g/dl') return 'g/dL'
  if (compact === 'mmol/l') return 'mmol/L'
  if (compact === 'umol/l') return 'µmol/L'
  if (compact === 'meq/l') return 'mEq/L'
  if (compact === 'u/l') return 'U/L'
  if (compact === 'fl') return 'fL'
  if (compact === 'pg') return 'pg'
  if (compact === '%') return '%'

  // Unidade desconhecida é preservada, mas não é promovida a canônica.
  return null
}

export function assessLaboratoryReference(
  input: LaboratoryReferenceInput,
): LaboratoryReferenceAssessment {
  if (input.value === null || !Number.isFinite(input.value)) {
    return { status: 'not_classified', reason: 'measurement_missing' }
  }
  if (input.qualifier) {
    return { status: 'not_classified', reason: 'qualified_measurement' }
  }
  const measurementUnit = canonicalizeLaboratoryUnit(input.measurementUnit)
  if (!measurementUnit) {
    return { status: 'not_classified', reason: 'measurement_unit_missing' }
  }
  if (input.referenceSource !== 'laboratory_report') {
    return { status: 'not_classified', reason: 'reference_not_from_report' }
  }
  if (!input.referenceText?.trim()) {
    return { status: 'not_classified', reason: 'reference_text_missing' }
  }
  if (input.referenceMin === null || input.referenceMax === null) {
    return { status: 'not_classified', reason: 'reference_incomplete' }
  }
  if (
    !Number.isFinite(input.referenceMin)
    || !Number.isFinite(input.referenceMax)
    || input.referenceMin > input.referenceMax
  ) {
    return { status: 'not_classified', reason: 'reference_invalid' }
  }
  const referenceUnit = canonicalizeLaboratoryUnit(input.referenceUnit)
  if (!referenceUnit) {
    return { status: 'not_classified', reason: 'reference_unit_missing' }
  }
  if (measurementUnit !== referenceUnit) {
    return { status: 'not_classified', reason: 'unit_mismatch' }
  }
  if (input.value < input.referenceMin) {
    return { status: 'below', reason: 'laboratory_interval_applied' }
  }
  if (input.value > input.referenceMax) {
    return { status: 'above', reason: 'laboratory_interval_applied' }
  }
  return { status: 'within', reason: 'laboratory_interval_applied' }
}

export function buildCanonicalLaboratoryObservation(input: {
  parameter: string
  value: number | null
  printedValue: string
  qualifier?: LabValueQualifier
  printedUnit: string | null
  referenceMin: number | null
  referenceMax: number | null
  referenceText: string | null
  referenceUnit?: string | null
  referenceSource: LaboratoryReferenceSource
  source: CanonicalLaboratoryObservation['evidence']['source']
  page?: number | null
  reviewed: boolean
}): CanonicalLaboratoryObservation {
  const qualifier = input.qualifier ?? null
  const referenceUnit = input.referenceUnit ?? input.printedUnit
  const assessment = assessLaboratoryReference({
    value: input.value,
    qualifier,
    measurementUnit: input.printedUnit,
    referenceMin: input.referenceMin,
    referenceMax: input.referenceMax,
    referenceText: input.referenceText,
    referenceUnit,
    referenceSource: input.referenceSource,
  })

  return {
    parameter: input.parameter,
    measurement: {
      value: input.value,
      printedValue: input.printedValue,
      qualifier,
      printedUnit: input.printedUnit,
      canonicalUnit: canonicalizeLaboratoryUnit(input.printedUnit),
    },
    reference: {
      min: input.referenceMin,
      max: input.referenceMax,
      printedText: input.referenceText,
      printedUnit: referenceUnit,
      canonicalUnit: canonicalizeLaboratoryUnit(referenceUnit),
      source: input.referenceSource,
    },
    assessment,
    evidence: {
      source: input.source,
      page: input.page ?? null,
      reviewed: input.reviewed,
    },
  }
}

/**
 * Tendência numérica só é comparável quando todos os pontos com valor
 * possuem a mesma unidade canônica conhecida. Nenhuma conversão é inferida.
 */
export function observationsHaveComparableUnits(
  observations: ReadonlyArray<{ value: number | null; unit?: string | null }>,
): boolean {
  const units = observations
    .filter((observation) => observation.value !== null)
    .map((observation) => canonicalizeLaboratoryUnit(observation.unit ?? null))
  return units.length > 0 && units.every((unit): unit is string => unit !== null)
    && new Set(units).size === 1
}
