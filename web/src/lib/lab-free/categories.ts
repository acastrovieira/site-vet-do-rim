/**
 * Mapeia cada parâmetro laboratorial conhecido para sua categoria clínica.
 * Parâmetros não listados caem em 'Outros Exames'.
 */

export type LabCategory =
  | 'Hematologia'
  | 'Bioquímica Sérica'
  | 'Urinálise'
  | 'Hemogasometria'
  | 'Outros Exames'

const HEMATOLOGIA_PARAMS = new Set([
  'Eritrócitos', 'Hemoglobina', 'Hematócrito', 'VCM', 'HCM', 'CHCM', 'RDW',
  'Reticulócitos', 'Reticulocitos',
  'Leucócitos', 'Neutrófilos', 'Neutrófilos Bastonetes', 'Neutrófilos Segmentados',
  'Bastonetes', 'Segmentados', 'Linfócitos', 'Monócitos',
  'Eosinófilos', 'Basófilos',
  'Plaquetas', 'VPM', 'PDW',
  'Proteína Plasmática Total', 'PPT', 'Fibrinogênio',
])

const BIOQUIMICA_PARAMS = new Set([
  'Ureia', 'Creatinina', 'SDMA',
  'TGO', 'TGP', 'FA', 'GGT',
  'Bilirrubina Total', 'Bilirrubina Direta', 'Bilirrubina Indireta',
  'Fosfatase Alcalina',
  'Proteínas Totais', 'Albumina', 'Globulinas', 'Relação A/G',
  'Glicose', 'Frutosamina', 'Colesterol Total', 'HDL', 'LDL', 'VLDL',
  'Triglicerídeos', 'Lipase', 'Amilase',
  'CK', 'Creatina Quinase', 'LDH',
  'Sódio', 'Potássio', 'Cloro', 'Cálcio', 'Cálcio Ionízado',
  'Fósforo', 'Magnésio', 'Bicarbonato',
  'Ferro', 'Ferritina', 'TIBC',
  'Proteína C Reativa', 'PCR', 'SAA',
  'TP', 'TAP', 'TTPA', 'TT', 'INR', 'D-dímero', 'FDP',
  'T4 Total', 'T4 Livre', 'TSH', 'Cortisol', 'Insulina',
  'Progesterona', 'Testosterona',
])

const URINALISE_PARAMS = new Set([
  'Densidade Urinária', 'pH Urinário',
  'Proteína Urinária', 'Proteína Urina',
  'Glicose Urinária', 'Glicose Urina',
  'Creatinina Urinária', 'Creatinina Urina',
  'RPCU', 'Relação P/C Urinária',
  'GFR', 'TFG',
  'Bilirrubina Urinária', 'Urobilinogenêo',
  'Hemoglobina Urinária', 'Hemoglobinúria',
  'Leucócitos Urinários', 'Eritrócitos Urinários',
  'Células Epiteliais', 'Cilindros', 'Cristais',
  'Nitritos', 'Corpos Cetônicos',
  'Volume Urinário', 'Produção Urinária',
])

const HEMOGASOMETRIA_PARAMS = new Set([
  'pH', 'pH Sangue',
  'pCO2', 'pO2', 'pO2/FiO2',
  'HCO3', 'HCO3-', 'Bicarbonato (gaso)',
  'BE', 'Base Excess', 'Excesso de Base',
  'SpO2', 'SaO2', 'FiO2',
  'Lactato', 'Lactato Artérial',
  'TCO2', 'tCO2',
  'Hb (gaso)', 'Hemoglobina (gaso)',
  'Na+ (gaso)', 'K+ (gaso)', 'Cl- (gaso)', 'Glicose (gaso)',
  'Anion Gap', 'AG',
  'Temperatura (gaso)',
])

/**
 * Retorna a categoria clínica de um parâmetro laboratorial.
 *
 * @param paramName - Nome do parâmetro
 * @returns Categoria clínica correspondente
 */
export function getParamCategory(paramName: string): LabCategory {
  const normalized = paramName.trim()
  if (HEMATOLOGIA_PARAMS.has(normalized)) return 'Hematologia'
  if (BIOQUIMICA_PARAMS.has(normalized)) return 'Bioquímica Sérica'
  if (URINALISE_PARAMS.has(normalized)) return 'Urinálise'
  if (HEMOGASOMETRIA_PARAMS.has(normalized)) return 'Hemogasometria'

  // Fuzzy matching para aliases comuns
  const lower = normalized.toLowerCase()
  if (/hematocrito|eritrocito|hemoglobin|leucocito|plaqueta|neutrofilo|linfocito|monocito|eosinofilo|basofilo|vcm|hcm|chcm|rdw|vpm/.test(lower))
    return 'Hematologia'
  if (/ureia|creatinin|tgo|tgp|\bfa\b|ggt|bilirrub|albumin|globulin|glicose|colesterol|triglice|lipase|amilase|sodio|potassio|calcio|fosforo|magnesio|ferro|ferritin|proteina c|fibrinogen|\btp\b|ttpa|cortisol|tiroxina/.test(lower))
    return 'Bioquímica Sérica'
  if (/urinari|urinali|rpcu|\bgfr\b|\btfg\b|densidade.urin|cilindro|cristal/.test(lower))
    return 'Urinálise'
  if (/\bph\b|pco2|po2|hco3|lactato|\bspO2\b|base.excess|gasometri/.test(lower))
    return 'Hemogasometria'

  return 'Outros Exames'
}

export const CATEGORY_ORDER: LabCategory[] = [
  'Hematologia',
  'Bioquímica Sérica',
  'Urinálise',
  'Hemogasometria',
  'Outros Exames',
]
