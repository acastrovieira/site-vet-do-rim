/**
 * Valores de referência para exames laboratoriais veterinários.
 * Agrupados por espécie (canino/felino).
 * Fonte: referências clínicas padrão de patologia veterinária.
 */

export interface RefRange {
  min: number
  max: number
  unit: string
  label: string
  /** Categoria clínica para agrupamento na tabela */
  category: LabCategory
}

export type LabCategory =
  | 'Série Vermelha'
  | 'Série Branca'
  | 'Plaquetas'
  | 'Bioquímica Renal'
  | 'Bioquímica Hepática'

export type SupportedReferenceSpecies = 'canino' | 'felino'

/** Chaves do schema resultado_ia que contêm valores numéricos */
export type HemogramaKey =
  // série vermelha
  | 'hemacias' | 'hemoglobina' | 'hematocrito' | 'vcm' | 'hcm' | 'chcm' | 'rdw'
  // série branca
  | 'leucocitos_totais' | 'neutrofilos_segmentados' | 'neutrofilos_bastoes'
  | 'linfocitos' | 'monocitos' | 'eosinofilos' | 'basofilos'
  // plaquetas
  | 'plaquetas_contagem' | 'plaquetas_vpm'
  // bioquímica
  | 'ureia' | 'creatinina' | 'alt_tgp' | 'ast_tgo'
  | 'fosforo' | 'potassio' | 'sodio' | 'albumina' | 'proteina_total'

/**
 * Referências para cães (canino).
 * Intervalos fisiológicos típicos — podem variar por raça, idade e lab.
 */
export const CANINE_REF: Record<HemogramaKey, RefRange> = {
  // Série Vermelha
  hemacias:     { min: 5.5,  max: 8.5,  unit: '×10⁶/µL', label: 'Hemácias', category: 'Série Vermelha' },
  hemoglobina:  { min: 12,   max: 18,   unit: 'g/dL',     label: 'Hemoglobina', category: 'Série Vermelha' },
  hematocrito:  { min: 37,   max: 55,   unit: '%',        label: 'Hematócrito', category: 'Série Vermelha' },
  vcm:          { min: 60,   max: 74,   unit: 'fL',       label: 'VCM', category: 'Série Vermelha' },
  hcm:          { min: 19.5, max: 24.5, unit: 'pg',       label: 'HCM', category: 'Série Vermelha' },
  chcm:         { min: 32,   max: 36,   unit: 'g/dL',     label: 'CHCM', category: 'Série Vermelha' },
  rdw:          { min: 14,   max: 17,   unit: '%',        label: 'RDW', category: 'Série Vermelha' },

  // Série Branca
  leucocitos_totais:        { min: 6000,  max: 17000, unit: '/µL', label: 'Leucócitos totais', category: 'Série Branca' },
  neutrofilos_segmentados:  { min: 3000,  max: 11500, unit: '/µL', label: 'Neutrófilos segm.', category: 'Série Branca' },
  neutrofilos_bastoes:      { min: 0,     max: 300,   unit: '/µL', label: 'Bastonetes', category: 'Série Branca' },
  linfocitos:               { min: 1000,  max: 4800,  unit: '/µL', label: 'Linfócitos', category: 'Série Branca' },
  monocitos:                { min: 150,   max: 1350,  unit: '/µL', label: 'Monócitos', category: 'Série Branca' },
  eosinofilos:              { min: 100,   max: 1250,  unit: '/µL', label: 'Eosinófilos', category: 'Série Branca' },
  basofilos:                { min: 0,     max: 100,   unit: '/µL', label: 'Basófilos', category: 'Série Branca' },

  // Plaquetas
  plaquetas_contagem: { min: 175000, max: 500000, unit: '×10³/µL', label: 'Plaquetas', category: 'Plaquetas' },
  plaquetas_vpm:      { min: 6.1,    max: 10.1,   unit: 'fL',      label: 'VPM', category: 'Plaquetas' },

  // Bioquímica Renal
  ureia:          { min: 21,   max: 60,   unit: 'mg/dL',  label: 'Ureia', category: 'Bioquímica Renal' },
  creatinina:     { min: 0.5,  max: 1.8,  unit: 'mg/dL',  label: 'Creatinina', category: 'Bioquímica Renal' },
  fosforo:        { min: 2.6,  max: 6.2,  unit: 'mg/dL',  label: 'Fósforo', category: 'Bioquímica Renal' },
  potassio:       { min: 4.0,  max: 5.8,  unit: 'mEq/L',  label: 'Potássio', category: 'Bioquímica Renal' },
  sodio:          { min: 140,  max: 155,  unit: 'mEq/L',  label: 'Sódio', category: 'Bioquímica Renal' },
  albumina:       { min: 2.6,  max: 3.3,  unit: 'g/dL',   label: 'Albumina', category: 'Bioquímica Renal' },
  proteina_total: { min: 5.4,  max: 7.1,  unit: 'g/dL',   label: 'Proteínas totais', category: 'Bioquímica Renal' },

  // Bioquímica Hepática
  alt_tgp: { min: 10,  max: 125, unit: 'U/L', label: 'ALT (TGP)', category: 'Bioquímica Hepática' },
  ast_tgo: { min: 10,  max: 88,  unit: 'U/L', label: 'AST (TGO)', category: 'Bioquímica Hepática' },
}

/**
 * Referências para gatos (felino).
 */
export const FELINE_REF: Record<HemogramaKey, RefRange> = {
  // Série Vermelha
  hemacias:     { min: 5.0,  max: 10.0, unit: '×10⁶/µL', label: 'Hemácias', category: 'Série Vermelha' },
  hemoglobina:  { min: 8,    max: 15,   unit: 'g/dL',     label: 'Hemoglobina', category: 'Série Vermelha' },
  hematocrito:  { min: 24,   max: 45,   unit: '%',        label: 'Hematócrito', category: 'Série Vermelha' },
  vcm:          { min: 39,   max: 55,   unit: 'fL',       label: 'VCM', category: 'Série Vermelha' },
  hcm:          { min: 12.5, max: 17.5, unit: 'pg',       label: 'HCM', category: 'Série Vermelha' },
  chcm:         { min: 30,   max: 36,   unit: 'g/dL',     label: 'CHCM', category: 'Série Vermelha' },
  rdw:          { min: 14,   max: 18,   unit: '%',        label: 'RDW', category: 'Série Vermelha' },

  // Série Branca
  leucocitos_totais:        { min: 5500,  max: 19500, unit: '/µL', label: 'Leucócitos totais', category: 'Série Branca' },
  neutrofilos_segmentados:  { min: 2500,  max: 12500, unit: '/µL', label: 'Neutrófilos segm.', category: 'Série Branca' },
  neutrofilos_bastoes:      { min: 0,     max: 300,   unit: '/µL', label: 'Bastonetes', category: 'Série Branca' },
  linfocitos:               { min: 1500,  max: 7000,  unit: '/µL', label: 'Linfócitos', category: 'Série Branca' },
  monocitos:                { min: 0,     max: 850,   unit: '/µL', label: 'Monócitos', category: 'Série Branca' },
  eosinofilos:              { min: 0,     max: 1500,  unit: '/µL', label: 'Eosinófilos', category: 'Série Branca' },
  basofilos:                { min: 0,     max: 100,   unit: '/µL', label: 'Basófilos', category: 'Série Branca' },

  // Plaquetas
  plaquetas_contagem: { min: 175000, max: 500000, unit: '×10³/µL', label: 'Plaquetas', category: 'Plaquetas' },
  plaquetas_vpm:      { min: 5.0,    max: 12.0,   unit: 'fL',      label: 'VPM', category: 'Plaquetas' },

  // Bioquímica Renal
  ureia:          { min: 42,   max: 64,   unit: 'mg/dL',  label: 'Ureia', category: 'Bioquímica Renal' },
  creatinina:     { min: 0.8,  max: 1.8,  unit: 'mg/dL',  label: 'Creatinina', category: 'Bioquímica Renal' },
  fosforo:        { min: 3.1,  max: 6.8,  unit: 'mg/dL',  label: 'Fósforo', category: 'Bioquímica Renal' },
  potassio:       { min: 4.0,  max: 5.3,  unit: 'mEq/L',  label: 'Potássio', category: 'Bioquímica Renal' },
  sodio:          { min: 147,  max: 156,  unit: 'mEq/L',  label: 'Sódio', category: 'Bioquímica Renal' },
  albumina:       { min: 2.1,  max: 3.3,  unit: 'g/dL',   label: 'Albumina', category: 'Bioquímica Renal' },
  proteina_total: { min: 5.7,  max: 7.8,  unit: 'g/dL',   label: 'Proteínas totais', category: 'Bioquímica Renal' },

  // Bioquímica Hepática
  alt_tgp: { min: 12,  max: 130, unit: 'U/L', label: 'ALT (TGP)', category: 'Bioquímica Hepática' },
  ast_tgo: { min: 12,  max: 40,  unit: 'U/L', label: 'AST (TGO)', category: 'Bioquímica Hepática' },
}

/** Resolve somente espécies com intervalos explicitamente cadastrados. */
export function resolveReferenceSpecies(
  especie: string,
): SupportedReferenceSpecies | null {
  const lower = especie.toLowerCase().trim()
  if (lower.includes('felino') || lower.includes('gato') || lower.includes('felin') || lower.includes('cat')) {
    return 'felino'
  }
  if (lower.includes('canino') || lower.includes('cão') || lower.includes('cao') || lower.includes('dog')) {
    return 'canino'
  }
  return null
}

/**
 * Retorna referências apenas para uma espécie suportada. Nunca usa uma espécie
 * diferente como fallback clínico.
 */
export function getRefForSpecies(especie: string): Record<HemogramaKey, RefRange> {
  const supportedSpecies = resolveReferenceSpecies(especie)
  if (supportedSpecies === 'felino') return FELINE_REF
  if (supportedSpecies === 'canino') return CANINE_REF
  throw new Error('Referência laboratorial indisponível para esta espécie.')
}

/** Metadado de agrupamento, sem selecionar intervalo clínico por espécie. */
export function getCategoryForLabKey(key: HemogramaKey): LabCategory {
  return CANINE_REF[key].category
}

/** Ordem das categorias na tabela evolutiva */
export const CATEGORY_ORDER: LabCategory[] = [
  'Bioquímica Renal',
  'Série Vermelha',
  'Série Branca',
  'Plaquetas',
  'Bioquímica Hepática',
]
