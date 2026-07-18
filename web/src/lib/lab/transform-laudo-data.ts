/**
 * Funções utilitárias para transformar o JSON `resultado_ia` (JSONB do Supabase)
 * em formato tabular para a tabela de acompanhamento evolutivo.
 */

import type { HemogramaKey, LabCategory } from './reference-values.ts'
import { CATEGORY_ORDER, getCategoryForLabKey } from './reference-values.ts'
import {
  formatCivilDate,
  formatSaoPauloTimestampDate,
  isCivilDate,
} from '../civil-date.ts'

/** Estrutura de um laudo processado vindo do Supabase */
export interface LaudoRow {
  id: string
  created_at: string
  resultado_ia: ResultadoIA | null
  status: string
  nome_arquivo: string
}

/** Estrutura do JSON resultado_ia salvo no banco */
export interface ResultadoIA {
  paciente: {
    nome: string
    especie: string
    raca: string
    idade: string
    peso_kg: number | null
    tutor: string
  }
  serie_vermelha: {
    hemacias: number | null
    hemoglobina: number | null
    hematocrito: number | null
    vcm: number | null
    hcm: number | null
    chcm: number | null
    rdw: number | null
  }
  serie_branca: {
    leucocitos_totais: number | null
    neutrofilos_segmentados: number | null
    neutrofilos_bastoes: number | null
    linfocitos: number | null
    monocitos: number | null
    eosinofilos: number | null
    basofilos: number | null
  }
  plaquetas: {
    contagem: number | null
    vpm: number | null
  }
  bioquimica: {
    ureia: number | null
    creatinina: number | null
    alt_tgp: number | null
    ast_tgo: number | null
    fosforo: number | null
    potassio: number | null
    sodio: number | null
    albumina: number | null
    proteina_total: number | null
  }
  interpretacao_ia: {
    resumo: string
    achados_relevantes: string[]
    alertas: string[]
    estadiamento_iris_sugerido: string | null
  }
  laboratorio: string | null
  data_coleta: string | null
  data_resultado: string | null
}

export type LaudoDateSource = 'collection' | 'upload' | 'unavailable'

export interface LaudoChronology {
  sortTimestamp: number
  uploadTimestamp: number
  displayDate: string
  source: LaudoDateSource
}

export function resolveLaudoChronology(laudo: LaudoRow): LaudoChronology {
  const collectionDate = laudo.resultado_ia?.data_coleta
  const uploadTimestamp = Date.parse(laudo.created_at)
  const safeUploadTimestamp = Number.isFinite(uploadTimestamp)
    ? uploadTimestamp
    : Number.MAX_SAFE_INTEGER

  if (isCivilDate(collectionDate)) {
    const [year, month, day] = collectionDate.split('-').map(Number)
    return {
      sortTimestamp: Date.UTC(year, month - 1, day),
      uploadTimestamp: safeUploadTimestamp,
      displayDate: formatCivilDate(collectionDate, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      source: 'collection',
    }
  }

  if (Number.isFinite(uploadTimestamp)) {
    return {
      sortTimestamp: uploadTimestamp,
      uploadTimestamp,
      displayDate: formatSaoPauloTimestampDate(laudo.created_at),
      source: 'upload',
    }
  }

  return {
    sortTimestamp: Number.MAX_SAFE_INTEGER,
    uploadTimestamp: Number.MAX_SAFE_INTEGER,
    displayDate: 'Data indisponível',
    source: 'unavailable',
  }
}

export function sortLaudosChronologically<T extends LaudoRow>(laudos: readonly T[]): T[] {
  return [...laudos].sort((a, b) => {
    const aDate = resolveLaudoChronology(a)
    const bDate = resolveLaudoChronology(b)
    return aDate.sortTimestamp - bDate.sortTimestamp
      || aDate.uploadTimestamp - bDate.uploadTimestamp
      || a.id.localeCompare(b.id)
  })
}

/** Ponto de dados na tabela evolutiva */
export interface EvolutionDataPoint {
  key: HemogramaKey
  values: Array<{ laudoId: string; date: string; value: number | null }>
}

/** Linha da tabela evolutiva agrupada por categoria */
export interface EvolutionTableGroup {
  category: LabCategory
  rows: EvolutionDataPoint[]
}

/**
 * Extrai um valor numérico do resultado_ia dado uma key.
 * Resolve o mapeamento entre key plana e a estrutura aninhada.
 */
function finiteLabNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function extractValue(result: ResultadoIA, key: HemogramaKey): number | null {
  switch (key) {
    // Série Vermelha
    case 'hemacias':     return finiteLabNumber(result.serie_vermelha?.hemacias)
    case 'hemoglobina':  return finiteLabNumber(result.serie_vermelha?.hemoglobina)
    case 'hematocrito':  return finiteLabNumber(result.serie_vermelha?.hematocrito)
    case 'vcm':          return finiteLabNumber(result.serie_vermelha?.vcm)
    case 'hcm':          return finiteLabNumber(result.serie_vermelha?.hcm)
    case 'chcm':         return finiteLabNumber(result.serie_vermelha?.chcm)
    case 'rdw':          return finiteLabNumber(result.serie_vermelha?.rdw)
    // Série Branca
    case 'leucocitos_totais':       return finiteLabNumber(result.serie_branca?.leucocitos_totais)
    case 'neutrofilos_segmentados': return finiteLabNumber(result.serie_branca?.neutrofilos_segmentados)
    case 'neutrofilos_bastoes':     return finiteLabNumber(result.serie_branca?.neutrofilos_bastoes)
    case 'linfocitos':              return finiteLabNumber(result.serie_branca?.linfocitos)
    case 'monocitos':               return finiteLabNumber(result.serie_branca?.monocitos)
    case 'eosinofilos':             return finiteLabNumber(result.serie_branca?.eosinofilos)
    case 'basofilos':               return finiteLabNumber(result.serie_branca?.basofilos)
    // Plaquetas
    case 'plaquetas_contagem': return finiteLabNumber(result.plaquetas?.contagem)
    case 'plaquetas_vpm':      return finiteLabNumber(result.plaquetas?.vpm)
    // Bioquímica
    case 'ureia':          return finiteLabNumber(result.bioquimica?.ureia)
    case 'creatinina':     return finiteLabNumber(result.bioquimica?.creatinina)
    case 'alt_tgp':        return finiteLabNumber(result.bioquimica?.alt_tgp)
    case 'ast_tgo':        return finiteLabNumber(result.bioquimica?.ast_tgo)
    case 'fosforo':        return finiteLabNumber(result.bioquimica?.fosforo)
    case 'potassio':       return finiteLabNumber(result.bioquimica?.potassio)
    case 'sodio':          return finiteLabNumber(result.bioquimica?.sodio)
    case 'albumina':       return finiteLabNumber(result.bioquimica?.albumina)
    case 'proteina_total': return finiteLabNumber(result.bioquimica?.proteina_total)
    default:               return null
  }
}

/** Todas as chaves extraíveis na ordem natural */
const ALL_KEYS: HemogramaKey[] = [
  'ureia', 'creatinina', 'fosforo', 'potassio', 'sodio', 'albumina', 'proteina_total',
  'hemacias', 'hemoglobina', 'hematocrito', 'vcm', 'hcm', 'chcm', 'rdw',
  'leucocitos_totais', 'neutrofilos_segmentados', 'neutrofilos_bastoes',
  'linfocitos', 'monocitos', 'eosinofilos', 'basofilos',
  'plaquetas_contagem', 'plaquetas_vpm',
  'alt_tgp', 'ast_tgo',
]

/**
 * Transforma uma lista de laudos concluídos em dados para a tabela evolutiva.
 * Filtra apenas laudos com resultado_ia válido.
 * Agrupa por categoria clínica.
 */
export function transformLaudosToEvolution(
  laudos: LaudoRow[],
  especie: string,
): EvolutionTableGroup[] {
  // A espécie é mantida no contrato para compatibilidade da UI, mas nunca é
  // usada para escolher intervalos neste agrupamento estrutural.
  void especie
  // Filtra laudos concluídos com dados
  const validLaudos = sortLaudosChronologically(
    laudos.filter((l) => l.status === 'concluido' && l.resultado_ia),
  )

  if (validLaudos.length === 0) return []

  // Monta dados por key
  const dataByKey: Map<HemogramaKey, EvolutionDataPoint> = new Map()

  for (const key of ALL_KEYS) {
    const values = validLaudos.map((laudo) => ({
      laudoId: laudo.id,
      date: resolveLaudoChronology(laudo).displayDate,
      value: laudo.resultado_ia ? extractValue(laudo.resultado_ia, key) : null,
    }))

    // Só inclui a key se pelo menos 1 laudo tem valor não-null
    if (values.some((v) => v.value !== null)) {
      dataByKey.set(key, { key, values })
    }
  }

  // Agrupa por categoria
  const groups: EvolutionTableGroup[] = []

  for (const category of CATEGORY_ORDER) {
    const rows: EvolutionDataPoint[] = []

    for (const key of ALL_KEYS) {
      if (getCategoryForLabKey(key) !== category) continue
      const dp = dataByKey.get(key)
      if (dp) rows.push(dp)
    }

    if (rows.length > 0) {
      groups.push({ category, rows })
    }
  }

  return groups
}

/**
 * Detecta tendência de um parâmetro ao longo do tempo.
 * Retorna: 'subindo' | 'descendo' | 'estavel' | 'insuficiente'
 */
export function detectTrend(
  values: Array<{ value: number | null }>,
): 'subindo' | 'descendo' | 'estavel' | 'insuficiente' {
  const nums = values.map((v) => v.value).filter((v): v is number => v !== null)
  if (nums.length < 2) return 'insuficiente'

  const last = nums[nums.length - 1]
  const prev = nums[nums.length - 2]
  const diff = last - prev
  if (diff === 0) return 'estavel'
  const pct = Math.abs(diff / prev) * 100

  if (pct < 5) return 'estavel'
  return diff > 0 ? 'subindo' : 'descendo'
}

/**
 * Formata número para exibição na tabela.
 * Inteiros ficam sem decimal, decimais com até 2 casas.
 */
export function formatLabValue(value: number | null): string {
  if (value === null) return '—'
  if (Number.isInteger(value)) return value.toLocaleString('pt-BR')
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}
