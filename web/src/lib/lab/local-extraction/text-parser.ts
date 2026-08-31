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

/**
 * Delimitadores aceitos ao redor de um alias. Laudos separam rótulo e valor por
 * espaço, dois-pontos, barra, hífen, parênteses ou pipe (colunas de tabela
 * achatadas pelo pdf.js), então 'ALT-TGP' e 'TGO | 42' precisam casar tanto
 * quanto 'ALT (TGP)'.
 */
function aliasPattern(alias: string) {
  return new RegExp(`(?:^|[\\s|(\\-/])${escapeRegExp(alias)}(?=[\\s:=(),|/.\\-]|$)`)
}

function lineMatchesAlias(normalizedLine: string, definition: LocalParameterDefinition) {
  const matches = definition.aliases
    .map(normalizeLabText)
    .sort((a, b) => b.length - a.length)
    .find((alias) => aliasPattern(alias).test(normalizedLine))
  return matches ?? null
}

/**
 * Escolhe a definição cujo alias casado é o mais longo da linha inteira, em vez
 * do primeiro item do catálogo que casa. Sem isso, 'Neutrófilos bastonetes'
 * seria capturado por 'neutrofilos' (segmentados) só porque essa definição vem
 * antes no array — a precedência passaria a depender da ordem do catálogo.
 */
function bestDefinitionForLine(normalizedLine: string) {
  let best: { definition: LocalParameterDefinition; alias: string } | null = null
  for (const definition of LOCAL_PARAMETER_CATALOG) {
    const alias = lineMatchesAlias(normalizedLine, definition)
    if (!alias) continue
    if (!best || alias.length > best.alias.length) best = { definition, alias }
  }
  return best?.definition ?? null
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

/**
 * Faixa de referência impressa no próprio laudo, em qualquer posição da linha:
 * '0,5 - 1,8', '0,5 a 1,8', 'VR 21 até 60'. Reconhecê-la explicitamente é o que
 * permite ler layouts em que a referência vem ANTES do resultado — nesses, a
 * leitura posicional (primeiro número = valor) devolvia o limite inferior da
 * faixa como se fosse o resultado do paciente.
 *
 * Só aceita um intervalo cujos dois limites sejam números não ambíguos e sem
 * qualificador; caso contrário devolve null e a leitura posicional continua
 * valendo.
 */
function findPrintedReferenceInterval(evidence: string) {
  const match = evidence.match(
    /(?<![\d.,])([+-]?\d[\d.,]*)\s*(?:-|a|ate|to)\s*([+-]?\d[\d.,]*)(?![\d.,])/i,
  )
  if (!match) return null

  const min = parseLocalNumber(match[1])
  const max = parseLocalNumber(match[2])
  const usable = [min, max].every(
    (candidate) => candidate.value !== null && !candidate.ambiguous && !candidate.qualifier,
  )
  if (!usable) return null

  return {
    min,
    max,
    remainingEvidence: `${evidence.slice(0, match.index)} ${evidence.slice((match.index ?? 0) + match[0].length)}`,
  }
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

  const printedReference = findPrintedReferenceInterval(numericEvidence)
  if (printedReference) numericEvidence = printedReference.remainingEvidence

  const tokens = findLocalNumberTokens(numericEvidence)
  // Sem a faixa impressa sobra apenas o rótulo: o laudo trouxe a referência e
  // não o resultado. Antes de detectar o intervalo, o limite inferior era lido
  // como se fosse o valor medido e ia pré-selecionado para a planilha.
  if (tokens.length === 0) return null

  const parsedValue = parseLocalNumber(tokens[0])
  const flags: string[] = []
  if (parsedValue.ambiguous) flags.push('ambiguous_number')
  if (parsedValue.qualifier) flags.push('qualified_value')

  if (!unit) flags.push('unit_missing')
  if (definition.absoluteOnly && unit === '%') flags.push('percentage_not_absolute')

  const parsedRemaining = tokens.slice(1).map(parseLocalNumber)
  const positionalCandidates = parsedRemaining.filter(
    (candidate) => candidate.value !== null && !candidate.ambiguous && !candidate.qualifier,
  )
  const referenceCandidates = printedReference
    ? [printedReference.min, printedReference.max]
    : positionalCandidates
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
      const definition = bestDefinitionForLine(normalizedLine)
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
