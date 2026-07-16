/**
 * Funções utilitárias para transformar o JSON `resultado_ia` (JSONB do Supabase)
 * em formato tabular para a tabela de acompanhamento evolutivo.
 */

import type { HemogramaKey, LabCategory } from './reference-values'
import { CATEGORY_ORDER, getRefForSpecies } from './reference-values'

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
  laboratorio: string
  data_coleta: string
  data_resultado: string
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
function extractValue(result: ResultadoIA, key: HemogramaKey): number | null {
  switch (key) {
    // Série Vermelha
    case 'hemacias':     return result.serie_vermelha.hemacias
    case 'hemoglobina':  return result.serie_vermelha.hemoglobina
    case 'hematocrito':  return result.serie_vermelha.hematocrito
    case 'vcm':          return result.serie_vermelha.vcm
    case 'hcm':          return result.serie_vermelha.hcm
    case 'chcm':         return result.serie_vermelha.chcm
    case 'rdw':          return result.serie_vermelha.rdw
    // Série Branca
    case 'leucocitos_totais':       return result.serie_branca.leucocitos_totais
    case 'neutrofilos_segmentados': return result.serie_branca.neutrofilos_segmentados
    case 'neutrofilos_bastoes':     return result.serie_branca.neutrofilos_bastoes
    case 'linfocitos':              return result.serie_branca.linfocitos
    case 'monocitos':               return result.serie_branca.monocitos
    case 'eosinofilos':             return result.serie_branca.eosinofilos
    case 'basofilos':               return result.serie_branca.basofilos
    // Plaquetas
    case 'plaquetas_contagem': return result.plaquetas.contagem
    case 'plaquetas_vpm':      return result.plaquetas.vpm
    // Bioquímica
    case 'ureia':          return result.bioquimica.ureia
    case 'creatinina':     return result.bioquimica.creatinina
    case 'alt_tgp':        return result.bioquimica.alt_tgp
    case 'ast_tgo':        return result.bioquimica.ast_tgo
    case 'fosforo':        return result.bioquimica.fosforo
    case 'potassio':       return result.bioquimica.potassio
    case 'sodio':          return result.bioquimica.sodio
    case 'albumina':       return result.bioquimica.albumina
    case 'proteina_total': return result.bioquimica.proteina_total
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
  // Filtra laudos concluídos com dados
  const validLaudos = laudos
    .filter((l) => l.status === 'concluido' && l.resultado_ia)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  if (validLaudos.length === 0) return []

  const ref = getRefForSpecies(especie)

  // Monta dados por key
  const dataByKey: Map<HemogramaKey, EvolutionDataPoint> = new Map()

  for (const key of ALL_KEYS) {
    const values = validLaudos.map((laudo) => ({
      laudoId: laudo.id,
      date: laudo.resultado_ia?.data_coleta || new Date(laudo.created_at).toLocaleDateString('pt-BR'),
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
      const refInfo = ref[key]
      if (refInfo?.category !== category) continue
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
