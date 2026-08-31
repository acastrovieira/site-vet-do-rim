import type { HemogramaKey, LabCategory } from '../reference-values.ts'

export interface LocalParameterDefinition {
  key: HemogramaKey
  label: string
  category: LabCategory
  aliases: readonly string[]
  absoluteOnly?: boolean
}

/**
 * Aliases cobrem a nomenclatura usada por laboratórios veterinários
 * brasileiros e por analisadores importados (IDEXX, Mindray, BC-2800Vet).
 * Cada alias a mais é um laudo a menos que precisa cair na IA.
 *
 * Regras para incluir um alias:
 * - nunca abreviações de 1 caractere ('k', 'p', 'na') — colidem com texto corrido;
 * - nunca palavras que também são preposição/artigo em português;
 * - o matcher já escolhe o alias mais longo entre todas as definições, então
 *   termos genéricos ('neutrofilos') convivem com específicos ('neutrofilos bastoes').
 */
export const LOCAL_PARAMETER_CATALOG: readonly LocalParameterDefinition[] = [
  { key: 'proteina_total', label: 'Proteína total', category: 'Bioquímica Renal', aliases: ['proteinas totais', 'proteina total', 'proteinas plasmaticas totais', 'proteina plasmatica total', 'proteinas sericas totais', 'proteina serica total', 'ptn totais', 'ptn total', 'proteina total (biureto)'] },
  { key: 'neutrofilos_segmentados', label: 'Neutrófilos segmentados', category: 'Série Branca', aliases: ['neutrofilos segmentados', 'segmentados', 'neutrofilos maduros', 'neutrofilos', 'neu abs', 'neut abs', 'neu#', 'segs'], absoluteOnly: true },
  { key: 'neutrofilos_bastoes', label: 'Bastonetes', category: 'Série Branca', aliases: ['neutrofilos bastoes', 'neutrofilos bastonetes', 'bastonetes', 'bastoes', 'bands', 'band abs'], absoluteOnly: true },
  { key: 'leucocitos_totais', label: 'Leucócitos totais', category: 'Série Branca', aliases: ['leucocitos totais', 'leucocitos globais', 'contagem global de leucocitos', 'globulos brancos', 'leucocitos', 'wbc'], absoluteOnly: true },
  { key: 'plaquetas_contagem', label: 'Plaquetas', category: 'Plaquetas', aliases: ['contagem plaquetaria', 'contagem de plaquetas', 'plaquetas', 'trombocitos', 'plt'], absoluteOnly: true },
  { key: 'hemoglobina', label: 'Hemoglobina', category: 'Série Vermelha', aliases: ['hemoglobina', 'hgb', 'hb'] },
  { key: 'hematocrito', label: 'Hematócrito', category: 'Série Vermelha', aliases: ['hematocrito', 'volume globular', 'hct', 'ht', 'vg'] },
  { key: 'hemacias', label: 'Hemácias', category: 'Série Vermelha', aliases: ['eritrocitos', 'hemacias', 'contagem de hemacias', 'globulos vermelhos', 'rbc'] },
  { key: 'chcm', label: 'CHCM', category: 'Série Vermelha', aliases: ['mchc', 'chcm'] },
  { key: 'vcm', label: 'VCM', category: 'Série Vermelha', aliases: ['mcv', 'vcm'] },
  { key: 'hcm', label: 'HCM', category: 'Série Vermelha', aliases: ['mch', 'hcm'] },
  { key: 'rdw', label: 'RDW', category: 'Série Vermelha', aliases: ['rdw-cv', 'rdw'] },
  { key: 'linfocitos', label: 'Linfócitos', category: 'Série Branca', aliases: ['linfocitos tipicos', 'linfocitos', 'lym abs', 'lymph', 'lym#'], absoluteOnly: true },
  { key: 'monocitos', label: 'Monócitos', category: 'Série Branca', aliases: ['monocitos', 'mono abs', 'mon#'], absoluteOnly: true },
  { key: 'eosinofilos', label: 'Eosinófilos', category: 'Série Branca', aliases: ['eosinofilos', 'eos abs', 'eos#'], absoluteOnly: true },
  { key: 'basofilos', label: 'Basófilos', category: 'Série Branca', aliases: ['basofilos', 'baso abs', 'bas#'], absoluteOnly: true },
  { key: 'plaquetas_vpm', label: 'VPM', category: 'Plaquetas', aliases: ['volume plaquetario medio', 'mpv', 'vpm'] },
  { key: 'creatinina', label: 'Creatinina', category: 'Bioquímica Renal', aliases: ['creatinina', 'creat', 'crea', 'cre'] },
  { key: 'ureia', label: 'Ureia', category: 'Bioquímica Renal', aliases: ['ureia', 'nitrogenio ureico', 'bun'] },
  { key: 'alt_tgp', label: 'ALT (TGP)', category: 'Bioquímica Hepática', aliases: ['alanina aminotransferase', 'alanina transaminase', 'alt/tgp', 'tgp/alt', 'alt (tgp)', 'tgp', 'gpt', 'alt'] },
  { key: 'ast_tgo', label: 'AST (TGO)', category: 'Bioquímica Hepática', aliases: ['aspartato aminotransferase', 'aspartato transaminase', 'ast/tgo', 'tgo/ast', 'ast (tgo)', 'tgo', 'got', 'ast'] },
  { key: 'fosforo', label: 'Fósforo', category: 'Bioquímica Renal', aliases: ['fosforo inorganico', 'fosforo', 'fosfato', 'phos'] },
  { key: 'potassio', label: 'Potássio', category: 'Bioquímica Renal', aliases: ['potassio', 'kalemia', 'k+'] },
  { key: 'sodio', label: 'Sódio', category: 'Bioquímica Renal', aliases: ['sodio', 'natremia', 'na+'] },
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
