/**
 * Gera a biblioteca de referências laboratoriais a partir das tabelas
 * transcritas em docs/clinical/referencias-laboratoriais-extracao-2026-08-30.md.
 *
 * Rodar: node scripts/build-reference-library.mjs
 *
 * Por que um gerador e não um JSON escrito à mão: cada intervalo precisa carregar
 * a fonte que o originou (Constitution, Artigo IV — No Invention), e conflitos
 * entre fontes precisam ficar explícitos em vez de serem resolvidos em silêncio
 * por quem digitou o arquivo. O gerador falha se um intervalo não tiver fonte.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'lib', 'lab', 'clinical-references', 'reference-library.json',
)

const SOURCES = {
  'knoll-tufts': {
    citation: 'Knoll JS. Apendice 1: Tabelas de Valores Laboratoriais Normais. In: Exames Laboratoriais e Procedimentos Diagnosticos: Canino e Felino.',
    population: 'Cummings School of Veterinary Medicine, Tufts University',
    instrument: 'CellDyn 3700 (hematologia, diferencial manual); Hitachi 911 (bioquimica)',
    page: 'p. 1211-1212 do PDF',
  },
  'thrall-schalm': {
    citation: 'Thrall MA et al. Hematologia e Bioquimica Clinica Veterinaria, 2a ed., Tabela 10.1.',
    population: 'Diretrizes derivadas do trabalho original de Schalm',
    instrument: null,
    page: 'p. 266 do PDF',
  },
  'iris-2026': {
    citation: 'IRIS Staging of CKD (Modified 2026). International Renal Interest Society (IRIS) Ltd.',
    population: 'Caes e gatos com DRC diagnosticada, estaveis e hidratados',
    instrument: 'SDMA: metodologia proprietaria IDEXX (a propria diretriz adverte que outros ensaios podem nao ser equivalentes)',
    page: 'iris-kidney.com — IRIS_staging_guidelines 2026.pdf',
    supersedes: 'IRIS Staging Guidelines 2023',
  },
}

/** [chave, rotulo, categoria, unidade, cão min, cão max, gato min, gato max, fonte] */
const KNOLL = [
  ['hemacias', 'Hemácias', 'serie_vermelha', '×10⁶/µL', 5.8, 8.5, 6.8, 10.0],
  ['hemoglobina', 'Hemoglobina', 'serie_vermelha', 'g/dL', 14.0, 19.1, 10.5, 14.9],
  ['hematocrito', 'Hematócrito', 'serie_vermelha', '%', 40.0, 56.0, 31.0, 49.0],
  ['vcm', 'VCM', 'serie_vermelha', 'fL', 60.0, 75.0, 39.0, 56.0],
  ['hcm', 'HCM', 'serie_vermelha', 'pg', 19.1, 26.2, 13.8, 17.1],
  ['chcm', 'CHCM', 'serie_vermelha', 'g/dL', 33.0, 36.0, 30.5, 36.2],
  ['rdw', 'RDW', 'serie_vermelha', '%', 14.5, 19.9, 17.9, 24.8],
  ['leucocitos_totais', 'Leucócitos totais', 'serie_branca', '/µL', 4900, 16900, 4500, 15700],
  ['neutrofilos_segmentados', 'Neutrófilos segmentados', 'serie_branca', '/µL', 2800, 11500, 2100, 10100],
  ['neutrofilos_bastoes', 'Bastonetes', 'serie_branca', '/µL', 0, 300, 0, 300],
  ['linfocitos', 'Linfócitos', 'serie_branca', '/µL', 1000, 4800, 1100, 6000],
  ['monocitos', 'Monócitos', 'serie_branca', '/µL', 100, 1500, 0, 1600],
  ['eosinofilos', 'Eosinófilos', 'serie_branca', '/µL', 100, 1250, 0, 1900],
  ['basofilos', 'Basófilos', 'serie_branca', '/µL', 0, 300, 0, 300],
  ['plaquetas_contagem', 'Plaquetas', 'plaquetas', '/µL', 181000, 525000, 183000, 643000],
  ['alt_tgp', 'ALT (TGP)', 'bioquimica_hepatica', 'U/L', 18, 86, 29, 145],
  ['ast_tgo', 'AST (TGO)', 'bioquimica_hepatica', 'U/L', 16, 54, 12, 42],
  ['fosfatase_alcalina', 'Fosfatase alcalina', 'bioquimica_hepatica', 'U/L', 12, 121, 10, 72],
  ['ggt', 'GGT', 'bioquimica_hepatica', 'U/L', 2, 10, 0, 5],
  ['bilirrubina_total', 'Bilirrubina total', 'bioquimica_hepatica', 'mg/dL', 0.1, 0.3, 0.1, 0.3],
  ['creatinina', 'Creatinina', 'bioquimica_renal', 'mg/dL', 0.6, 2.0, 0.9, 2.1],
  ['ureia', 'Ureia', 'bioquimica_renal', 'mg/dL', 8, 30, 15, 32],
  ['fosforo', 'Fósforo', 'bioquimica_renal', 'mg/dL', 2.6, 7.2, 3.0, 6.3],
  ['albumina', 'Albumina', 'bioquimica_renal', 'g/dL', 2.8, 4.0, 2.4, 4.0],
  ['proteina_total', 'Proteína total', 'bioquimica_renal', 'g/dL', 5.5, 7.8, 6.0, 8.4],
  ['sodio', 'Sódio', 'eletrolitos', 'mEq/L', 143, 154, 149, 162],
  ['potassio', 'Potássio', 'eletrolitos', 'mEq/L', 3.9, 5.6, 3.6, 5.4],
  ['cloro', 'Cloreto', 'eletrolitos', 'mEq/L', 106, 116, 110, 125],
  ['calcio_total', 'Cálcio total', 'eletrolitos', 'mg/dL', 9.4, 11.6, 8.9, 11.5],
  ['magnesio_total', 'Magnésio total', 'eletrolitos', 'mg/dL', 1.8, 2.6, 2.0, 2.7],
  ['glicose', 'Glicose', 'bioquimica_geral', 'mg/dL', 67, 135, 70, 120],
  ['colesterol', 'Colesterol', 'bioquimica_geral', 'mg/dL', 82, 355, 77, 258],
  ['triglicerides', 'Triglicerídios', 'bioquimica_geral', 'mg/dL', 30, 321, 25, 191],
  ['globulina', 'Globulina (calculada)', 'bioquimica_geral', 'g/dL', 2.3, 4.2, 2.5, 5.8],
]

/** Mesmos parâmetros na outra fonte — registrados para expor o conflito. */
const THRALL = [
  ['leucocitos_totais', 6000, 17000, 5500, 19500],
  ['neutrofilos_segmentados', 3000, 11500, 2500, 12500],
  ['neutrofilos_bastoes', 0, 300, 0, 300],
  ['linfocitos', 1000, 5000, 1500, 7000],
  ['monocitos', 0, 1200, 0, 800],
  ['eosinofilos', 100, 1200, 0, 1500],
  ['basofilos', 0, 100, 0, 100],
]

/**
 * A diretriz IRIS 2026 registra que SDMA persistentemente >14 µg/dL pode ser
 * usado para diagnosticar DRC precoce — daí o teto de 14 como faixa normal.
 * Cálcio ionizado NÃO consta da diretriz de estadiamento e por isso saiu daqui:
 * atribuí-lo ao IRIS seria inventar procedência.
 */
const IRIS_ONLY = [
  ['sdma', 'SDMA', 'bioquimica_renal', 'µg/dL', 0, 14, 0, 14],
]

const thrallByKey = new Map(THRALL.map(([k, ...v]) => [k, v]))

const parameters = []
for (const [source, rows] of [['knoll-tufts', KNOLL], ['iris-2026', IRIS_ONLY]]) {
  for (const [key, label, category, unit, cMin, cMax, fMin, fMax] of rows) {
    const entry = {
      key, label, category, unit,
      species: {
        canino: { min: cMin, max: cMax },
        felino: { min: fMin, max: fMax },
      },
      source,
    }
    const alt = thrallByKey.get(key)
    if (alt) {
      const [aCMin, aCMax, aFMin, aFMax] = alt
      const diverge = aCMin !== cMin || aCMax !== cMax || aFMin !== fMin || aFMax !== fMax
      if (diverge) {
        // Conflito fica explícito e bloqueia uso automático: escolher fonte é
        // decisão do responsável técnico, não do gerador.
        entry.requiresArbitration = true
        entry.alternateSources = [{
          source: 'thrall-schalm',
          species: {
            canino: { min: aCMin, max: aCMax },
            felino: { min: aFMin, max: aFMax },
          },
        }]
      }
    }
    parameters.push(entry)
  }
}

/** Sem fonte localizada — declarados para não sumirem do radar. */
const unsourced = [
  { key: 'plaquetas_vpm', label: 'VPM', category: 'plaquetas', unit: 'fL',
    reason: 'Ausente nas tabelas de Knoll e Thrall consultadas.' },
  { key: 'reticulocitos', label: 'Reticulócitos', category: 'serie_vermelha', unit: '/µL',
    reason: 'Citado no texto do Thrall, sem tabela de intervalo canino/felino localizada.' },
  { key: 'upc', label: 'Relação proteína:creatinina urinária', category: 'urinalise', unit: null,
    reason: 'Subestadiamento IRIS; limiar categórico, não faixa de normalidade.' },
  { key: 'densidade_urinaria', label: 'Densidade urinária', category: 'urinalise', unit: null,
    reason: 'Valor de corte (>1.030 cão, >1.035 gato), não faixa min/max.' },
  { key: 'ph_urinario', label: 'pH urinário', category: 'urinalise', unit: null,
    reason: 'Faixa do JSON IRIS ainda não conferida contra obra de referência.' },
  { key: 'proteina_fita', label: 'Proteína (fita)', category: 'urinalise', unit: null,
    reason: 'Resultado qualitativo (negativo/traços), não numérico.' },
  { key: 'calcio_ionizado', label: 'Cálcio ionizado', category: 'eletrolitos', unit: 'mmol/L',
    reason: 'Não consta da diretriz IRIS de estadiamento nem das tabelas de Knoll/Thrall consultadas. O valor do JSON de 2023 não tem fonte rastreável.' },
]

/**
 * Estadiamento IRIS 2026 — cortes transcritos da diretriz oficial.
 *
 * Substitui a versão 2023: em 2026 o SDMA felino passou a ter faixas próprias
 * (18–25 / 26–38 / >38) em vez de repetir as do cão, e o estágio 2 canino foi
 * ampliado com estreitamento do 3.
 *
 * Bordas: a diretriz não se sobrepõe — usa `<X`, `[a,b]` e `>Y`. O intervalo
 * aparentemente vago entre 2,8 e 2,9 mg/dL vem do arredondamento de µmol/L
 * (250 → 2,8 e 251 → 2,9); a implementação em `tfg-calculator.ts` fecha esse
 * vão classificando `<= 2,8` como estágio 2, o que é decisão de implementação
 * e não alteração de corte clínico.
 */
const IRIS_STAGING = {
  source: 'iris-2026',
  criterion: 'Creatinina e SDMA em jejum, em ao menos duas ocasiões, com paciente hidratado e estável, após diagnóstico de DRC.',
  discrepancyRule: 'Quando creatinina e SDMA discordam, estadiar pelo marcador persistentemente mais avançado.',
  earlyCkdMarker: { parameter: 'sdma', persistentlyAbove: 14, unit: 'µg/dL' },
  stages: {
    canino: [
      { stage: 1, creatinineMgDl: { max: 1.4, inclusiveMax: false }, creatinineUmolL: { max: 125, inclusiveMax: false }, sdma: { max: 18, inclusiveMax: false } },
      { stage: 2, creatinineMgDl: { min: 1.4, max: 2.8 }, creatinineUmolL: { min: 125, max: 250 }, sdma: { min: 18, max: 35 } },
      { stage: 3, creatinineMgDl: { min: 2.9, max: 5.0 }, creatinineUmolL: { min: 251, max: 440 }, sdma: { min: 36, max: 54 } },
      { stage: 4, creatinineMgDl: { min: 5.0, inclusiveMin: false }, creatinineUmolL: { min: 440, inclusiveMin: false }, sdma: { min: 54, inclusiveMin: false } },
    ],
    felino: [
      { stage: 1, creatinineMgDl: { max: 1.6, inclusiveMax: false }, creatinineUmolL: { max: 140, inclusiveMax: false }, sdma: { max: 18, inclusiveMax: false } },
      { stage: 2, creatinineMgDl: { min: 1.6, max: 2.8 }, creatinineUmolL: { min: 140, max: 250 }, sdma: { min: 18, max: 25 } },
      { stage: 3, creatinineMgDl: { min: 2.9, max: 5.0 }, creatinineUmolL: { min: 251, max: 440 }, sdma: { min: 26, max: 38 } },
      { stage: 4, creatinineMgDl: { min: 5.0, inclusiveMin: false }, creatinineUmolL: { min: 440, inclusiveMin: false }, sdma: { min: 38, inclusiveMin: false } },
    ],
  },
  proteinuriaSubstaging: {
    canino: [
      { category: 'nao_proteinurico', abbreviation: 'NP', upc: { max: 0.2, inclusiveMax: false } },
      { category: 'borderline_proteinurico', abbreviation: 'BP', upc: { min: 0.2, max: 0.5 } },
      { category: 'proteinurico', abbreviation: 'P', upc: { min: 0.5, inclusiveMin: false } },
    ],
    felino: [
      { category: 'nao_proteinurico', abbreviation: 'NP', upc: { max: 0.2, inclusiveMax: false } },
      { category: 'borderline_proteinurico', abbreviation: 'BP', upc: { min: 0.2, max: 0.4 } },
      { category: 'proteinurico', abbreviation: 'P', upc: { min: 0.4, inclusiveMin: false } },
    ],
  },
  // Mesmos cortes para cão e gato. Raças de pressão alta (sight hounds) usam
  // referência própria da raça, conforme a diretriz.
  bloodPressureSubstaging: [
    { category: 'normotenso', systolicMmHg: { max: 140, inclusiveMax: false }, targetOrganRisk: 'minimo' },
    { category: 'pre_hipertenso', systolicMmHg: { min: 140, max: 159 }, targetOrganRisk: 'baixo' },
    { category: 'hipertenso', systolicMmHg: { min: 160, max: 179 }, targetOrganRisk: 'moderado' },
    { category: 'gravemente_hipertenso', systolicMmHg: { min: 180 }, targetOrganRisk: 'alto' },
  ],
}

for (const p of parameters) {
  for (const especie of ['canino', 'felino']) {
    const { min, max } = p.species[especie]
    if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
      throw new Error(`intervalo invalido em ${p.key}/${especie}`)
    }
  }
  if (!SOURCES[p.source]) throw new Error(`fonte desconhecida em ${p.key}: ${p.source}`)
}

const library = {
  schemaVersion: 1,
  generatedAt: '2026-08-30',
  // Nenhum valor daqui classifica resultado antes da conferencia visual contra o
  // PDF de origem e da arbitragem dos conflitos por responsavel tecnico.
  status: 'draft-awaiting-clinical-approval',
  // Transcricao conferida contra as paginas renderizadas (pdftoppm) em
  // 2026-08-31: Thrall p.266, Knoll p.1211 e IRIS 2026 p.2 batem celula a
  // celula. Isso valida a FIDELIDADE da copia, nao a escolha clinica da fonte —
  // por isso o status acima continua draft.
  transcriptionVerifiedAt: '2026-08-31',
  precedence: 'O intervalo impresso no proprio laudo tem prioridade sobre esta biblioteca, que e fallback.',
  sources: SOURCES,
  parameters: parameters.sort((a, b) => a.key.localeCompare(b.key)),
  irisStaging: IRIS_STAGING,
  unsourced,
  unitConversions: {
    creatinina_mgdl_para_umoll: 88.4,
    ureia_mgdl_para_mmoll: 0.357,
    calcio_mgdl_para_mmoll: 0.25,
    fosforo_mgdl_para_mmoll: 0.323,
    glicose_mgdl_para_mmoll: 0.0555,
    colesterol_mgdl_para_mmoll: 0.026,
    albumina_gdl_para_gl: 10,
  },
}

writeFileSync(outPath, `${JSON.stringify(library, null, 2)}\n`, 'utf8')
console.log(
  `reference-library.json: ${library.parameters.length} parametros com fonte, ` +
  `${library.parameters.filter((p) => p.requiresArbitration).length} em conflito, ` +
  `${unsourced.length} sem fonte.`,
)
