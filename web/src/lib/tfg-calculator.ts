/**
 * Triagem de faixas para estadiamento IRIS de DRC.
 * Baseado nas diretrizes IRIS 2026 (iris-kidney.com).
 *
 * Importante: creatinina, SDMA e peso não calculam a taxa de filtração
 * glomerular. O nome legado deste arquivo/função é mantido para não quebrar
 * links e consumidores internos existentes.
 */

export type Species = 'cao' | 'gato'
export type IRISStage = 1 | 2 | 3 | 4
export type ProteinuriaSubstage = 'nao-proteinurico' | 'borderline' | 'proteinurico' | 'nao-avaliado'
export type HypertensionSubstage = 'normotenso' | 'pre-hipertensivo' | 'hipertensivo' | 'gravemente-hipertensivo' | 'nao-avaliado'

export interface TFGInput {
  species: Species
  creatininaMgDl: number
  sdmaMcgDl?: number
  upcRatio?: number
  pressaoSistolicaMmhg?: number
}

export interface IRISResult {
  stage: IRISStage
  stageName: string
  stageDescription: string
  stageColor: string
  creatininaRef: string
  sdmaRef: string
  proteinuriaSubstage: ProteinuriaSubstage
  hypertensionSubstage: HypertensionSubstage
  recommendations: string[]
  monitoringInterval: string
  /** true = resultado parcialmente bloqueado para não autenticados */
  requiresAuth: boolean
}

// ── Estadiamento por creatinina ────────────────────────────
const CREATININE_STAGES: Record<Species, { stage: IRISStage; max: number }[]> = {
  cao: [
    { stage: 1, max: 1.4 },
    { stage: 2, max: 2.8 },
    { stage: 3, max: 5.0 },
    { stage: 4, max: Infinity },
  ],
  gato: [
    { stage: 1, max: 1.6 },
    { stage: 2, max: 2.8 },
    { stage: 3, max: 5.0 },
    { stage: 4, max: Infinity },
  ],
}

// ── Labels e metadados por estágio ────────────────────────
const STAGE_META: Record<IRISStage, { name: string; description: string; color: string; monitoring: string }> = {
  1: {
    name: 'Estágio 1 — DRC Precoce',
    description: 'Função renal adequada. Marcadores de dano renal podem estar presentes (proteinúria, imagiologia).',
    color: 'green',
    monitoring: 'Defina o intervalo de monitoramento com o veterinário responsável.',
  },
  2: {
    name: 'Estágio 2 — DRC Leve',
    description: 'Azotemia leve. Sinais clínicos geralmente ausentes ou discretos (PU/PD).',
    color: 'yellow',
    monitoring: 'Defina o intervalo de monitoramento com o veterinário responsável.',
  },
  3: {
    name: 'Estágio 3 — DRC Moderada',
    description: 'Azotemia moderada com sinais clínicos presentes. Risco de complicações sistêmicas.',
    color: 'orange',
    monitoring: 'Defina o intervalo de monitoramento com o veterinário responsável.',
  },
  4: {
    name: 'Estágio 4 — DRC Grave (Uremia)',
    description: 'Azotemia grave com risco iminente de crise urêmica. Hospitalização pode ser necessária.',
    color: 'red',
    monitoring: 'Defina o intervalo de monitoramento com o veterinário responsável.',
  },
}

export function getStageByCreatinine(creatinina: number, species: Species): IRISStage {
  for (const { stage, max } of CREATININE_STAGES[species]) {
    if (stage === 1 ? creatinina < max : creatinina <= max) return stage
  }
  return 4
}

export function getStageBySdma(sdma: number, species: Species): IRISStage {
  if (sdma < 18) return 1
  if (species === 'gato') {
    if (sdma <= 25) return 2
    if (sdma <= 38) return 3
    return 4
  }
  if (sdma <= 35) return 2
  if (sdma <= 54) return 3
  return 4
}

export function getProteinuriaSubstage(upc?: number, species?: Species): ProteinuriaSubstage {
  if (upc === undefined) return 'nao-avaliado'
  const borderlineMax = species === 'gato' ? 0.4 : 0.5
  const naoProtMax = 0.2
  if (upc < naoProtMax) return 'nao-proteinurico'
  if (upc <= borderlineMax) return 'borderline'
  return 'proteinurico'
}

export function getHypertensionSubstage(pressure?: number): HypertensionSubstage {
  if (pressure === undefined) return 'nao-avaliado'
  if (pressure < 140) return 'normotenso'
  if (pressure < 160) return 'pre-hipertensivo'
  if (pressure < 180) return 'hipertensivo'
  return 'gravemente-hipertensivo'
}

function getRecommendations(
  proteinuria: ProteinuriaSubstage,
  hypertension: HypertensionSubstage,
): string[] {
  const recs = [
    'Confirmar DRC em paciente estável e adequadamente hidratado; este resultado isolado não estabelece diagnóstico.',
    'Confirmar creatinina e/ou SDMA em pelo menos duas avaliações e investigar causas pré-renais e pós-renais.',
  ]
  if (proteinuria !== 'nao-avaliado') {
    recs.push('Interpretar UPC após excluir causas pré-renais e pós-renais de proteinúria.')
  }
  if (hypertension !== 'nao-avaliado') {
    recs.push('Confirmar a pressão arterial em medições padronizadas e avaliar lesão de órgão-alvo.')
  }
  recs.push('Definir tratamento e monitoramento com o médico-veterinário conforme as recomendações IRIS vigentes.')
  return recs
}

/**
 * Calcula o estadiamento IRIS e métricas renais a partir dos dados clínicos do paciente.
 */
export function calcularTFG(input: TFGInput): IRISResult {
  const { species, creatininaMgDl, sdmaMcgDl, upcRatio, pressaoSistolicaMmhg } = input

  const stageByCreatinine = getStageByCreatinine(creatininaMgDl, species)
  const stageBySdma =
    sdmaMcgDl !== undefined ? getStageBySdma(sdmaMcgDl, species) : null

  // IRIS: usar o maior estágio entre creatinina e SDMA
  const finalStage: IRISStage =
    stageBySdma && stageBySdma > stageByCreatinine ? stageBySdma : stageByCreatinine

  const meta = STAGE_META[finalStage]
  const proteinuria = getProteinuriaSubstage(upcRatio, species)
  const hypertension = getHypertensionSubstage(pressaoSistolicaMmhg)
  const recommendations = getRecommendations(proteinuria, hypertension)

  const creatRef =
    species === 'cao'
      ? ['< 1,4', '1,4–2,8', '2,9–5,0', '> 5,0'][finalStage - 1]
      : ['< 1,6', '1,6–2,8', '2,9–5,0', '> 5,0'][finalStage - 1]

  return {
    stage: finalStage,
    stageName: meta.name,
    stageDescription: meta.description,
    stageColor: meta.color,
    creatininaRef: `${creatRef} mg/dL`,
    sdmaRef: sdmaMcgDl !== undefined ? `${sdmaMcgDl} µg/dL` : 'Não informado',
    proteinuriaSubstage: proteinuria,
    hypertensionSubstage: hypertension,
    recommendations,
    monitoringInterval: meta.monitoring,
    requiresAuth: finalStage >= 2, // STORY-302: bloqueia detalhes dos estágios 2–4
  }
}
