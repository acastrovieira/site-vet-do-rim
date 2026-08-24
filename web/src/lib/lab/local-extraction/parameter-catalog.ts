import type { HemogramaKey, LabCategory } from '../reference-values.ts'

export interface LocalParameterDefinition {
  key: HemogramaKey
  label: string
  category: LabCategory
  aliases: readonly string[]
  absoluteOnly?: boolean
}

export const LOCAL_PARAMETER_CATALOG: readonly LocalParameterDefinition[] = [
  { key: 'proteina_total', label: 'Proteína total', category: 'Bioquímica Renal', aliases: ['proteinas totais', 'proteina total'] },
  { key: 'neutrofilos_segmentados', label: 'Neutrófilos segmentados', category: 'Série Branca', aliases: ['neutrofilos segmentados', 'segmentados', 'neu abs'], absoluteOnly: true },
  { key: 'neutrofilos_bastoes', label: 'Bastonetes', category: 'Série Branca', aliases: ['neutrofilos bastoes', 'bastonetes', 'bastoes', 'bands'], absoluteOnly: true },
  { key: 'leucocitos_totais', label: 'Leucócitos totais', category: 'Série Branca', aliases: ['leucocitos totais', 'leucocitos', 'wbc'], absoluteOnly: true },
  { key: 'plaquetas_contagem', label: 'Plaquetas', category: 'Plaquetas', aliases: ['contagem plaquetaria', 'plaquetas', 'plt'], absoluteOnly: true },
  { key: 'hemoglobina', label: 'Hemoglobina', category: 'Série Vermelha', aliases: ['hemoglobina', 'hgb', 'hb'] },
  { key: 'hematocrito', label: 'Hematócrito', category: 'Série Vermelha', aliases: ['hematocrito', 'hct', 'ht'] },
  { key: 'hemacias', label: 'Hemácias', category: 'Série Vermelha', aliases: ['eritrocitos', 'hemacias', 'rbc'] },
  { key: 'chcm', label: 'CHCM', category: 'Série Vermelha', aliases: ['mchc', 'chcm'] },
  { key: 'vcm', label: 'VCM', category: 'Série Vermelha', aliases: ['mcv', 'vcm'] },
  { key: 'hcm', label: 'HCM', category: 'Série Vermelha', aliases: ['mch', 'hcm'] },
  { key: 'rdw', label: 'RDW', category: 'Série Vermelha', aliases: ['rdw-cv', 'rdw'] },
  { key: 'linfocitos', label: 'Linfócitos', category: 'Série Branca', aliases: ['linfocitos', 'lym abs'], absoluteOnly: true },
  { key: 'monocitos', label: 'Monócitos', category: 'Série Branca', aliases: ['monocitos', 'mono abs'], absoluteOnly: true },
  { key: 'eosinofilos', label: 'Eosinófilos', category: 'Série Branca', aliases: ['eosinofilos', 'eos abs'], absoluteOnly: true },
  { key: 'basofilos', label: 'Basófilos', category: 'Série Branca', aliases: ['basofilos', 'baso abs'], absoluteOnly: true },
  { key: 'plaquetas_vpm', label: 'VPM', category: 'Plaquetas', aliases: ['volume plaquetario medio', 'mpv', 'vpm'] },
  { key: 'creatinina', label: 'Creatinina', category: 'Bioquímica Renal', aliases: ['creatinina', 'crea', 'cre'] },
  { key: 'ureia', label: 'Ureia', category: 'Bioquímica Renal', aliases: ['ureia'] },
  { key: 'alt_tgp', label: 'ALT (TGP)', category: 'Bioquímica Hepática', aliases: ['alanina aminotransferase', 'alt/tgp', 'alt (tgp)', 'tgp', 'gpt', 'alt'] },
  { key: 'ast_tgo', label: 'AST (TGO)', category: 'Bioquímica Hepática', aliases: ['aspartato aminotransferase', 'ast/tgo', 'ast (tgo)', 'tgo', 'got', 'ast'] },
  { key: 'fosforo', label: 'Fósforo', category: 'Bioquímica Renal', aliases: ['fosforo', 'phos'] },
  { key: 'potassio', label: 'Potássio', category: 'Bioquímica Renal', aliases: ['potassio', 'k+'] },
  { key: 'sodio', label: 'Sódio', category: 'Bioquímica Renal', aliases: ['sodio', 'na+'] },
  { key: 'albumina', label: 'Albumina', category: 'Bioquímica Renal', aliases: ['albumina', 'alb'] },
] as const

export const LOCAL_PARAMETER_KEYS = new Set<HemogramaKey>(
  LOCAL_PARAMETER_CATALOG.map((parameter) => parameter.key),
)

export function normalizeLabText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[µμ]/g, 'u')
    .replace(/[–—]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
