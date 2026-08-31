/**
 * Lançamento manual de exame na planilha evolutiva — sem PDF, sem OCR e sem IA.
 *
 * O veterinário digita os valores que leu no laudo em papel ou no portal do
 * laboratório. O contrato de saída é o MESMO `ResultadoIA` produzido pelo fluxo
 * de PDF, para que planilha, export CSV/XLSX e histórico continuem lendo uma
 * única forma — o que muda é a procedência registrada em `extracao_local.source`.
 *
 * A validação por item é a de `reviewed-result.ts`, deliberadamente
 * compartilhada: um valor digitado à mão não pode passar por travas mais
 * frouxas do que um valor conferido a partir do PDF.
 */

import { ApiValidationError, assertAllowedKeys, optionalText } from '../api-validation.ts'
import { isCivilDate } from '../civil-date.ts'
import { parseItem } from './local-extraction/reviewed-result.ts'
import type { ReviewedLocalExtractionPayload } from './local-extraction/types.ts'

const MAX_ITEMS = 25

/**
 * Itens manuais carregam `page: 0`. A página é a evidência de onde o valor foi
 * lido no PDF; no lançamento manual não existe PDF, e 0 é o sentinela que
 * `buildReviewedLocalResult` já traduz para a observação canônica 'manual'.
 */
const MANUAL_PAGE = 0

function requiredCivilDate(value: unknown, field: string) {
  if (typeof value !== 'string' || !isCivilDate(value)) {
    throw new ApiValidationError(`${field} invalida`)
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

export function parseManualLabEntryPayload(
  body: Record<string, unknown>,
): ReviewedLocalExtractionPayload {
  assertAllowedKeys(body, ['items', 'laboratory', 'collectionDate', 'resultDate'])

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
    throw new ApiValidationError('Informe entre 1 e 25 parametros')
  }

  const items = body.items.map(parseItem)
  if (items.some((item) => item.page !== MANUAL_PAGE)) {
    throw new ApiValidationError('Lancamento manual nao referencia pagina de PDF')
  }
  if (new Set(items.map((item) => item.key)).size !== items.length) {
    throw new ApiValidationError('Cada parametro pode ser lancado apenas uma vez')
  }

  // A data de coleta é o eixo X da planilha evolutiva. No fluxo de PDF ela pode
  // faltar (o laudo não a trazia); num lançamento manual quem digita sabe a
  // data, e sem ela o ponto não tem onde ser posicionado na evolução.
  const collectionDate = requiredCivilDate(body.collectionDate, 'Data de coleta')
  const resultDate = optionalCivilDate(body.resultDate, 'Data do resultado')
  if (resultDate && resultDate < collectionDate) {
    throw new ApiValidationError('Data do resultado anterior a data de coleta')
  }

  return {
    items,
    laboratory: optionalText(body.laboratory, 'Laboratorio', 120),
    collectionDate,
    resultDate,
    source: 'manual',
  }
}
