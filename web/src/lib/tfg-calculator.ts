/**
 * Engine de cálculo da TFG e estadiamento IRIS.
 * Baseado nas diretrizes IRIS 2023 (iris-kidney.com).
 */

export type Species = 'cao' | 'gato'
export type IRISStage = 1 | 2 | 3 | 4
export type ProteinuriaSubstage = 'nao-proteinurico' | 'borderline' | 'proteinurico' | 'nao-avaliado'
export type HypertensionSubstage = 'normotenso' | 'pre-hipertensivo' | 'hipertensivo' | 'gravemente-hipertensivo' | 'nao-avaliado'

export interface TFGInput {
  species: Species
  weightKg: number
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
  tfgEstimadaMin: number
  tfgEstimadaMax: number
  recommendations: string[]
  monitoringInterval: string
  /** true = resultado parcialmente bloqueado para não autenticados */
  requiresAuth: boolean
}

// ── Estadiamento por creatinina ────────────────────────────
const CREATININE_STAGES: Record<Species, { stage: IRISStage; max: number }[]> = {
  cao: [
    { stage: 1, max: 1.6 },
    { stage: 2, max: 2.8 },
    { stage: 3, max: 5.0 },
    { stage: 4, max: Infinity },
  ],
  gato: [
    { stage: 1, max: 1.4 },
    { stage: 2, max: 2.8 },
    { stage: 3, max: 5.0 },
    { stage: 4, max: Infinity },
  ],
}

// ── TFG estimada por estágio e espécie ────────────────────
const TFG_RANGE: Record<Species, Record<IRISStage, [number, number]>> = {
  cao: { 1: [2.5, 3.5], 2: [1.5, 2.5], 3: [0.7, 1.5], 4: [0, 0.7] },
  gato: { 1: [2.0, 3.0], 2: [1.0, 2.0], 3: [0.5, 1.0], 4: [0, 0.5] },
}

// ── Labels e metadados por estágio ────────────────────────
const STAGE_META: Record<IRISStage, { name: string; description: string; color: string; monitoring: string }> = {
  1: {
    name: 'Estágio 1 — DRC Precoce',
    description: 'Função renal adequada. Marcadores de dano renal podem estar presentes (proteinúria, imagiologia).',
    color: 'green',
    monitoring: 'Monitoramento semestral recomendado.',
  },
  2: {
    name: 'Estágio 2 — DRC Leve',
    description: 'Azotemia leve. Sinais clínicos geralmente ausentes ou discretos (PU/PD).',
    color: 'yellow',
    monitoring: 'Reavaliação a cada 3–4 meses.',
  },
  3: {
    name: 'Estágio 3 — DRC Moderada',
    description: 'Azotemia moderada com sinais clínicos presentes. Risco de complicações sistêmicas.',
    color: 'orange',
    monitoring: 'Reavaliação mensal a cada 2 meses.',
  },
  4: {
    name: 'Estágio 4 — DRC Grave (Uremia)',
    description: 'Azotemia grave com risco iminente de crise urêmica. Hospitalização pode ser necessária.',
    color: 'red',
    monitoring: 'Monitoramento intensivo semanal a quinzenal.',
  },
}

function getStageByCreatinine(creatinina: number, species: Species): IRISStage {
  for (const { stage, max } of CREATININE_STAGES[species]) {
    if (creatinina < max) return stage
  }
  return 4
}

function getStageBySdma(sdma: number): IRISStage | null {
  if (sdma < 18) return null // sem indicação de DRC pelo SDMA
  if (sdma <= 35) return 2
  if (sdma <= 54) return 3
  return 4
}

function getProteinuriaSubstage(upc?: number, species?: Species): ProteinuriaSubstage {
  if (upc === undefined) return 'nao-avaliado'
  const borderlineMax = species === 'gato' ? 0.4 : 0.5
  const naoProtMax = 0.2
  if (upc < naoProtMax) return 'nao-proteinurico'
  if (upc <= borderlineMax) return 'borderline'
  return 'proteinurico'
}

function getHypertensionSubstage(pressure?: number): HypertensionSubstage {
  if (pressure === undefined) return 'nao-avaliado'
  if (pressure < 140) return 'normotenso'
  if (pressure < 160) return 'pre-hipertensivo'
  if (pressure < 180) return 'hipertensivo'
  return 'gravemente-hipertensivo'
}

function getRecommendations(stage: IRISStage, proteinuria: ProteinuriaSubstage, hypertension: HypertensionSubstage): string[] {
  const recs: string[] = []
  if (stage >= 2) recs.push('Iniciar dieta renal com restrição de fósforo')
  if (stage >= 1) recs.push('Garantir hidratação adequada — preferir alimentação úmida')
  if (stage >= 2) recs.push('Monitorar PA sistêmica e UPC regularmente')
  if (stage >= 3) recs.push('Considerar fluidoterapia subcutânea domiciliar')
  if (stage >= 3) recs.push('Avaliar suplementação de eritropoetina se anemia')
  if (stage >= 4) recs.push('Hospitalização e fluidoterapia IV — avaliar hemodiálise')
  if (proteinuria === 'proteinurico') recs.push('Iniciar inibidor de ECA (benazepril) para controle da proteinúria')
  if (hypertension === 'hipertensivo' || hypertension === 'gravemente-hipertensivo') {
    recs.push('Tratar hipertensão com amlodipina (felinos) ou benazepril (cães)')
  }
  return recs
}

/**
 * Calcula o estadiamento IRIS e métricas renais a partir dos dados clínicos do paciente.
 */
export function calcularTFG(input: TFGInput): IRISResult {
  const { species, creatininaMgDl, sdmaMcgDl, upcRatio, pressaoSistolicaMmhg } = input

  const stageByCreatinine = getStageByCreatinine(creatininaMgDl, species)
  const stageBySdma = sdmaMcgDl ? getStageBySdma(sdmaMcgDl) : null

  // IRIS: usar o maior estágio entre creatinina e SDMA
  const finalStage: IRISStage =
    stageBySdma && stageBySdma > stageByCreatinine ? stageBySdma : stageByCreatinine

  const meta = STAGE_META[finalStage]
  const [tfgMin, tfgMax] = TFG_RANGE[species][finalStage]
  const proteinuria = getProteinuriaSubstage(upcRatio, species)
  const hypertension = getHypertensionSubstage(pressaoSistolicaMmhg)
  const recommendations = getRecommendations(finalStage, proteinuria, hypertension)

  const creatRef =
    species === 'cao'
      ? ['< 1,6', '1,6–2,8', '2,9–5,0', '> 5,0'][finalStage - 1]
      : ['< 1,4', '1,4–2,8', '2,9–5,0', '> 5,0'][finalStage - 1]

  return {
    stage: finalStage,
    stageName: meta.name,
    stageDescription: meta.description,
    stageColor: meta.color,
    creatininaRef: `${creatRef} mg/dL`,
    sdmaRef: sdmaMcgDl !== undefined ? `${sdmaMcgDl} µg/dL` : 'Não informado',
    proteinuriaSubstage: proteinuria,
    hypertensionSubstage: hypertension,
    tfgEstimadaMin: tfgMin,
    tfgEstimadaMax: tfgMax,
    recommendations,
    monitoringInterval: meta.monitoring,
    requiresAuth: finalStage >= 2, // STORY-302: bloqueia detalhes dos estágios 2–4
  }
}
