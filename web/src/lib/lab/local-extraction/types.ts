import type { HemogramaKey } from '../reference-values.ts'
import type { CanonicalLaboratoryObservation } from '../canonical-observation.ts'

/**
 * Procedencia do dado laboratorial. 'manual' identifica o lancamento digitado
 * direto na planilha, sem PDF e sem IA — nunca e produzido pelo parser, apenas
 * pelo fluxo de entrada manual.
 */
export type LocalExtractionSource = 'pdf-text' | 'ocr' | 'manual'
export type LocalConfidenceLevel = 'high' | 'medium' | 'low'

export interface LocalExtractedItem {
  id: string
  key: HemogramaKey
  label: string
  value: number | null
  valueText: string
  qualifier: '<' | '<=' | '>' | '>=' | null
  unit: string | null
  referenceMin: number | null
  referenceMax: number | null
  referenceMinText: string
  referenceMaxText: string
  referenceText: string | null
  rawLine: string
  page: number
  confidence: LocalConfidenceLevel
  flags: string[]
  selected: boolean
}

export interface LocalExtractionMetadata {
  laboratory: string | null
  collectionDate: string | null
  resultDate: string | null
}

export interface LocalExtractionDraft {
  schemaVersion: 1
  parserVersion: string
  source: LocalExtractionSource
  status: 'needs_review'
  items: LocalExtractedItem[]
  metadata: LocalExtractionMetadata
  warnings: string[]
  pageCount: number
}

export interface ReviewedLocalItem {
  key: HemogramaKey
  value: number
  valueText: string
  unit: string | null
  referenceMin: number | null
  referenceMax: number | null
  referenceText: string | null
  page: number
}

export interface ReviewedLocalExtractionPayload {
  items: ReviewedLocalItem[]
  laboratory: string | null
  collectionDate: string | null
  resultDate: string | null
  source: LocalExtractionSource
}

export interface PersistedLocalItem extends ReviewedLocalItem {
  observation: CanonicalLaboratoryObservation
}
