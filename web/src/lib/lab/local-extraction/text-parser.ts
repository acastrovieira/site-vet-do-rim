import { isCivilDate } from '../../civil-date.ts'
import type {
  LocalConfidenceLevel,
  LocalExtractedItem,
  LocalExtractionDraft,
  LocalExtractionMetadata,
  LocalExtractionSource,
} from './types.ts'
import {
  LOCAL_PARAMETER_CATALOG,
  normalizeLabText,
  type LocalParameterDefinition,
} from './parameter-catalog.ts'
import { findLocalNumberTokens, parseLocalNumber } from './number-parser.ts'

export const LOCAL_PARSER_VERSION = '1.0.0'

const UNIT_PATTERNS: Array<[RegExp, string]> = [
  [/(?:x|×)?\s*10\s*(?:\^|[*])?\s*6\s*\/\s*(?:(?:u|µ|μ)l|mm(?:\^?3|³))/i, '×10⁶/µL'],
  [/(?:x|×)?\s*10\s*(?:\^|[*])?\s*3\s*\/\s*(?:(?:u|µ|μ)l|mm(?:\^?3|³))/i, '×10³/µL'],
  [/(?:\/\s*(?:(?:u|µ|μ)l|mm(?:\^?3|³)))|(?:c[eé]l(?:ulas)?\s*\/\s*(?:(?:u|µ|μ)l|mm(?:\^?3|³)))/i, '/µL'],
  [/mg\s*\/\s*d[lL]/i, 'mg/dL'],
  [/g\s*\/\s*d[lL]/i, 'g/dL'],
  [/(?:u|µ|μ)mol\s*\/\s*[lL]/i, 'µmol/L'],
  [/m(?:e|E)q\s*\/\s*[lL]/i, 'mEq/L'],
  [/mmol\s*\/\s*[lL]/i, 'mmol/L'],
  [/[uU]\s*\/\s*[lL]/, 'U/L'],
  [/\bf[lL]\b/, 'fL'],
  [/\bpg\b/i, 'pg'],
  [/%/, '%'],
]

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lineMatchesAlias(normalizedLine: string, definition: LocalParameterDefinition) {
  const matches = definition.aliases
    .map(normalizeLabText)
    .sort((a, b) => b.length - a.length)
    .find((alias) => new RegExp(`(?:^|\\s)${escapeRegExp(alias)}(?=\\s|:|=|\\(|$)`).test(normalizedLine))
  return matches ?? null
}

function parseUnit(line: string) {
  return UNIT_PATTERNS.find(([pattern]) => pattern.test(line))?.[1] ?? null
}

function lineWithoutUnitScale(line: string) {
  const matchedPattern = UNIT_PATTERNS.find(([pattern]) => pattern.test(line))?.[0]
  return matchedPattern ? line.replace(matchedPattern, ' ') : line
}

function parseCivilDateToken(raw: string) {
  const match = raw.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/)
  if (!match) return null
  const [, day, month, year] = match
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return isCivilDate(iso) ? iso : null
}

function parseMetadata(lines: string[]): LocalExtractionMetadata {
  let collectionDate: string | null = null
  let resultDate: string | null = null
  let laboratory: string | null = null

  for (const line of lines.slice(0, 80)) {
    const normalized = normalizeLabText(line)
    if (!collectionDate && /data (?:de )?coleta|coletado em/.test(normalized)) {
      collectionDate = parseCivilDateToken(line)
    }
    if (!resultDate && /data (?:do )?resultado|liberado em|emissao/.test(normalized)) {
      resultDate = parseCivilDateToken(line)
    }
    const labMatch = line.match(/(?:laborat[oó]rio|lab\.?)[\s:=-]+(.{2,80})/i)
    if (!laboratory && labMatch) laboratory = labMatch[1].trim().slice(0, 80)
  }

  return { laboratory, collectionDate, resultDate }
}

function confidenceFor(source: LocalExtractionSource, flags: string[], unit: string | null): LocalConfidenceLevel {
  if (flags.length > 0) return 'low'
  if (source === 'pdf-text' && unit) return 'high'
  return 'medium'
}

function createItem(
  definition: LocalParameterDefinition,
  line: string,
  page: number,
  source: LocalExtractionSource,
  index: number,
): LocalExtractedItem | null {
  const unit = parseUnit(line)
  let numericEvidence = lineWithoutUnitScale(line)

  // Diferenciais leucocitários frequentemente trazem percentual e contagem
  // absoluta na mesma linha. Campos absolutos nunca podem receber o percentual.
  if (definition.absoluteOnly && unit !== '%') {
    numericEvidence = numericEvidence.replace(
      /(?:<=|>=|<|>|≤|≥)?\s*[+-]?\d[\d.,]*\s*%/g,
      ' ',
    )
  }

  const tokens = findLocalNumberTokens(numericEvidence)
  if (tokens.length === 0) return null

  const parsedValue = parseLocalNumber(tokens[0])
  const flags: string[] = []
  if (parsedValue.ambiguous) flags.push('ambiguous_number')
  if (parsedValue.qualifier) flags.push('qualified_value')

  if (!unit) flags.push('unit_missing')
  if (definition.absoluteOnly && unit === '%') flags.push('percentage_not_absolute')

  const parsedRemaining = tokens.slice(1).map(parseLocalNumber)
  const referenceCandidates = parsedRemaining.filter(
    (candidate) => candidate.value !== null && !candidate.ambiguous && !candidate.qualifier,
  )
  const referenceMin = referenceCandidates[0]?.value ?? null
  const referenceMax = referenceCandidates[1]?.value ?? null
  const referenceMinText = referenceCandidates[0]?.raw ?? ''
  const referenceMaxText = referenceCandidates[1]?.raw ?? ''
  const referenceText = referenceMin !== null && referenceMax !== null
    ? `${referenceMinText} - ${referenceMaxText}`
    : null

  const invalidForAutomaticUse = parsedValue.value === null
    || parsedValue.ambiguous
    || Boolean(parsedValue.qualifier)
    || (definition.absoluteOnly && unit === '%')

  return {
    id: `${page}-${definition.key}-${index}`,
    key: definition.key,
    label: definition.label,
    value: invalidForAutomaticUse ? null : parsedValue.value,
    valueText: parsedValue.raw,
    qualifier: parsedValue.qualifier,
    unit,
    referenceMin,
    referenceMax,
    referenceMinText,
    referenceMaxText,
    referenceText,
    rawLine: line.slice(0, 500),
    page,
    confidence: confidenceFor(source, flags, unit),
    flags,
    selected: !invalidForAutomaticUse,
  }
}

export function parseLocalLabText(
  pages: readonly string[],
  source: LocalExtractionSource,
): LocalExtractionDraft {
  const items: LocalExtractedItem[] = []
  const warnings: string[] = []
  const allLines: string[] = []

  pages.forEach((pageText, pageIndex) => {
    const lines = pageText
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    allLines.push(...lines)

    for (const line of lines) {
      const normalizedLine = normalizeLabText(line)
      const definition = LOCAL_PARAMETER_CATALOG.find((candidate) => lineMatchesAlias(normalizedLine, candidate))
      if (!definition) continue
      const item = createItem(definition, line, pageIndex + 1, source, items.length)
      if (item) items.push(item)
    }
  })

  const byKey = new Map<string, LocalExtractedItem[]>()
  for (const item of items) {
    const group = byKey.get(item.key) ?? []
    group.push(item)
    byKey.set(item.key, group)
  }

  for (const [key, candidates] of byKey) {
    if (candidates.length < 2) continue
    const distinctValues = new Set(candidates.map((item) => item.value).filter((value) => value !== null))
    if (distinctValues.size > 1) {
      warnings.push(`Foram encontrados valores conflitantes para ${candidates[0].label}.`)
      for (const candidate of candidates) {
        candidate.selected = false
        candidate.confidence = 'low'
        if (!candidate.flags.includes('conflicting_duplicate')) candidate.flags.push('conflicting_duplicate')
      }
    } else {
      candidates.slice(1).forEach((candidate) => {
        candidate.selected = false
        candidate.flags.push('duplicate')
      })
    }
    void key
  }

  if (items.length === 0) warnings.push('Nenhum parâmetro compatível foi identificado automaticamente.')
  if (source === 'ocr') warnings.push('O texto veio de OCR local e exige conferência cuidadosa com o PDF.')
  if (items.some((item) => item.confidence === 'low')) {
    warnings.push('Há valores ambíguos ou incompatíveis que não foram pré-selecionados.')
  }

  return {
    schemaVersion: 1,
    parserVersion: LOCAL_PARSER_VERSION,
    source,
    status: 'needs_review',
    items,
    metadata: parseMetadata(allLines),
    warnings,
    pageCount: pages.length,
  }
}
