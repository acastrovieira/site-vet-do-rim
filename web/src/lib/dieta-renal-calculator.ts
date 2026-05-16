/**
 * @file dieta-renal-calculator.ts
 * Calculadora de dieta terapêutica renal para cães e gatos.
 *
 * Tabelas de alimentação extraídas dos guias nutricionais oficiais dos fabricantes.
 * Versão dos dados: maio/2025.
 * ⚠️  Sempre confira a embalagem atual do produto — formulações mudam.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Especie = 'cao' | 'gato'

/** Escore de Condição Corporal (BCS/ECC), escala 1–9 da WSAVA */
export type ECC = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type Marca =
  | 'royal-canin'
  | 'hills'
  | 'premier'
  | 'vetlife'

export interface LinhaAlimento {
  marca: Marca
  nomeMarca: string
  nomeLinha: string
  especie: Especie
  /** Energia metabolizável (kcal/100g) */
  emKcal: number
  /** Tamanho do copo medidor em gramas (quando disponível) */
  copoMedidorG?: number
  /** Tabela: [peso corporal ideal (kg), g/dia] */
  tabela: Array<[number, number]>
  /** Link externo para página do produto */
  urlProduto?: string
  /** Nota do fabricante */
  nota?: string
}

export interface DietaInput {
  especie: Especie
  pesoAtualKg: number
  ecc: ECC
  marca: Marca
  /** Número de refeições por dia (padrão: 2) */
  refeicoesPerDay?: number
}

export interface ResultadoDieta {
  marca: Marca
  nomeMarca: string
  nomeLinha: string
  pesoUsadoKg: number
  pesoIdealEstimadoKg: number
  eccAjuste: 'abaixo' | 'ideal' | 'acima'
  gramsPerDay: number
  gramsPerRefeicao: number
  refeicoesPerDay: number
  /** Equivalência em colheres/xícaras quando disponível */
  coposMedidores?: number
  emKcal: number
  kcalTotal: number
  urlProduto?: string
  nota?: string
  advertencia?: string
}

export interface ResultadoDietaMultimarca {
  resultados: ResultadoDieta[]
  pesoUsadoKg: number
  pesoIdealEstimadoKg: number
  eccAjuste: 'abaixo' | 'ideal' | 'acima'
}

// ─── Tabelas de Alimentação ───────────────────────────────────────────────────

/**
 * Tabelas baseadas nos guias nutricionais publicados pelos fabricantes.
 * Referências: embalagens oficiais e sites das marcas (consultados mai/2025).
 */
const LINHAS_ALIMENTO: LinhaAlimento[] = [
  // ── Royal Canin ─────────────────────────────────────────────────────────────
  {
    marca: 'royal-canin',
    nomeMarca: 'Royal Canin',
    nomeLinha: 'Renal Canine (seco)',
    especie: 'cao',
    emKcal: 354,
    copoMedidorG: 60,
    urlProduto: 'https://www.royalcanin.com/br/dogs/products/wet-and-dry-food/renal-dry',
    nota: 'Para adultos com doença renal crônica. Indicado a partir do Estágio II IRIS.',
    tabela: [
      [2, 42],
      [4, 70],
      [6, 95],
      [8, 118],
      [10, 140],
      [15, 192],
      [20, 240],
      [25, 285],
      [30, 328],
      [35, 370],
      [40, 410],
      [50, 490],
      [60, 567],
    ],
  },
  {
    marca: 'royal-canin',
    nomeMarca: 'Royal Canin',
    nomeLinha: 'Renal Feline (seco)',
    especie: 'gato',
    emKcal: 346,
    copoMedidorG: 42,
    urlProduto: 'https://www.royalcanin.com/br/cats/products/wet-and-dry-food/renal-dry',
    nota: 'Para gatos adultos com doença renal crônica. Formulado para suporte renal a longo prazo.',
    tabela: [
      [2, 31],
      [3, 41],
      [4, 50],
      [5, 58],
      [6, 67],
    ],
  },

  // ── Hill's k/d ──────────────────────────────────────────────────────────────
  {
    marca: 'hills',
    nomeMarca: "Hill's",
    nomeLinha: 'k/d Canine (seco)',
    especie: 'cao',
    emKcal: 326,
    copoMedidorG: 56,
    urlProduto: 'https://www.hillspet.com.br/dog-food/pd-kd-canine-dry',
    nota: 'Suporte renal e cardíaco. Ajuste a quantidade conforme condição corporal e orientação veterinária.',
    tabela: [
      [2, 42],
      [3, 56],
      [5, 84],
      [8, 121],
      [10, 145],
      [15, 200],
      [20, 252],
      [25, 300],
      [30, 347],
      [40, 434],
      [50, 518],
      [60, 599],
    ],
  },
  {
    marca: 'hills',
    nomeMarca: "Hill's",
    nomeLinha: 'k/d Feline (seco)',
    especie: 'gato',
    emKcal: 348,
    copoMedidorG: 42,
    urlProduto: 'https://www.hillspet.com.br/cat-food/pd-kd-feline-dry',
    nota: 'Suporte renal para gatos. Reduz carga de trabalho renal com fósforo e sódio controlados.',
    tabela: [
      [2, 28],
      [3, 38],
      [4, 46],
      [5, 54],
      [6, 62],
    ],
  },

  // ── Premier Pet ─────────────────────────────────────────────────────────────
  {
    marca: 'premier',
    nomeMarca: 'Premier Pet',
    nomeLinha: 'Renal Cães (seco)',
    especie: 'cao',
    emKcal: 330,
    copoMedidorG: 55,
    urlProduto: 'https://www.premierpet.com.br/caes/adulto/renal',
    nota: 'Desenvolvida para suporte renal em cães adultos. Baixo teor de fósforo e proteína de alta digestibilidade.',
    tabela: [
      [2, 40],
      [3, 54],
      [5, 80],
      [8, 115],
      [10, 136],
      [15, 187],
      [20, 235],
      [25, 280],
      [30, 323],
      [40, 405],
      [50, 483],
    ],
  },
  {
    marca: 'premier',
    nomeMarca: 'Premier Pet',
    nomeLinha: 'Renal Gatos (seco)',
    especie: 'gato',
    emKcal: 335,
    copoMedidorG: 40,
    urlProduto: 'https://www.premierpet.com.br/gatos/adulto/renal',
    nota: 'Fórmula com restrição de fósforo e proteína controlada para suporte à função renal.',
    tabela: [
      [2, 30],
      [3, 40],
      [4, 49],
      [5, 57],
      [6, 65],
    ],
  },

  // ── Vet Life / Farmina ───────────────────────────────────────────────────────
  {
    marca: 'vetlife',
    nomeMarca: 'Vet Life (Farmina)',
    nomeLinha: 'Renal Cães (seco)',
    especie: 'cao',
    emKcal: 338,
    copoMedidorG: 55,
    urlProduto: 'https://farmina.com/pt-br/vet-life/cao/renal/',
    nota: 'Fórmula veterinária com restrição de fósforo e proteína de alta qualidade. Recomendada para DRC.',
    tabela: [
      [2, 43],
      [3, 57],
      [5, 83],
      [8, 119],
      [10, 141],
      [15, 195],
      [20, 244],
      [25, 291],
      [30, 336],
      [40, 420],
      [50, 502],
    ],
  },
  {
    marca: 'vetlife',
    nomeMarca: 'Vet Life (Farmina)',
    nomeLinha: 'Renal Gatos (seco)',
    especie: 'gato',
    emKcal: 340,
    copoMedidorG: 40,
    urlProduto: 'https://farmina.com/pt-br/vet-life/gato/renal/',
    nota: 'Alimento completo para suporte renal em gatos. Ômega-3 e antioxidantes para qualidade de vida.',
    tabela: [
      [2, 32],
      [3, 43],
      [4, 52],
      [5, 61],
      [6, 69],
    ],
  },
]

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**
 * Estima o peso corporal ideal a partir do ECC (escala 1–9 WSAVA).
 * Para ECC > 5, cada ponto acima equivale a ~10% de excesso de gordura.
 * Para ECC < 4, o animal está abaixo do peso — usamos o peso atual sem redução.
 *
 * @param pesoAtualKg - Peso atual do paciente
 * @param ecc - Escore de Condição Corporal (1–9)
 * @returns Peso ideal estimado em kg
 */
export function estimarPesoIdeal(pesoAtualKg: number, ecc: ECC): number {
  if (ecc <= 5) return pesoAtualKg
  // Fórmula padrão: peso_ideal = peso_atual / (1 + 0.1 * (ECC - 5))
  const fatorSobrepeso = 1 + 0.1 * (ecc - 5)
  return Math.round((pesoAtualKg / fatorSobrepeso) * 10) / 10
}

/**
 * Interpola linearmente na tabela de alimentação para um peso intermediário.
 *
 * @param tabela - Array de [pesoKg, gramsPerDay]
 * @param pesoKg - Peso para o qual calcular
 * @returns Quantidade em gramas por dia
 */
function interpolarTabela(tabela: Array<[number, number]>, pesoKg: number): number {
  // Abaixo do mínimo: extrapola pela inclinação do primeiro segmento
  if (pesoKg <= tabela[0][0]) {
    const slope = (tabela[1][1] - tabela[0][1]) / (tabela[1][0] - tabela[0][0])
    const g = tabela[0][1] + slope * (pesoKg - tabela[0][0])
    return Math.max(1, Math.round(g))
  }

  // Acima do máximo: extrapola pela inclinação do último segmento
  const last = tabela.length - 1
  if (pesoKg >= tabela[last][0]) {
    const slope =
      (tabela[last][1] - tabela[last - 1][1]) / (tabela[last][0] - tabela[last - 1][0])
    const g = tabela[last][1] + slope * (pesoKg - tabela[last][0])
    return Math.max(1, Math.round(g))
  }

  // Interpolação linear entre dois pontos adjacentes
  for (let i = 0; i < tabela.length - 1; i++) {
    const [p0, g0] = tabela[i]
    const [p1, g1] = tabela[i + 1]
    if (pesoKg >= p0 && pesoKg <= p1) {
      const t = (pesoKg - p0) / (p1 - p0)
      return Math.round(g0 + t * (g1 - g0))
    }
  }

  return Math.round(tabela[last][1])
}

// ─── Funções Principais ───────────────────────────────────────────────────────

/**
 * Retorna todas as linhas de alimento disponíveis para a espécie informada.
 *
 * @param especie - 'cao' ou 'gato'
 * @returns Lista de linhas de alimento
 */
export function getLinhasDisponiveis(especie: Especie): LinhaAlimento[] {
  return LINHAS_ALIMENTO.filter((l) => l.especie === especie)
}

/**
 * Retorna a linha de alimento de uma marca específica para a espécie.
 *
 * @param marca - Identificador da marca
 * @param especie - 'cao' ou 'gato'
 * @returns Linha de alimento ou undefined
 */
export function getLinha(marca: Marca, especie: Especie): LinhaAlimento | undefined {
  return LINHAS_ALIMENTO.find((l) => l.marca === marca && l.especie === especie)
}

/**
 * Calcula a quantidade diária de dieta terapêutica renal para um paciente.
 *
 * @param input - Dados do paciente e da dieta
 * @returns Resultado do cálculo
 * @throws Error se a marca/espécie não estiver disponível
 */
export function calcularDietaRenal(input: DietaInput): ResultadoDieta {
  const { especie, pesoAtualKg, ecc, marca, refeicoesPerDay = 2 } = input

  const linha = getLinha(marca, especie)
  if (!linha) {
    throw new Error(`Linha de alimento não encontrada para marca "${marca}" e espécie "${especie}"`)
  }

  const pesoIdealEstimadoKg = estimarPesoIdeal(pesoAtualKg, ecc)
  const pesoUsadoKg = pesoIdealEstimadoKg

  const eccAjuste: ResultadoDieta['eccAjuste'] =
    ecc <= 3 ? 'abaixo' : ecc <= 5 ? 'ideal' : 'acima'

  const gramsPerDay = interpolarTabela(linha.tabela, pesoUsadoKg)
  const gramsPerRefeicao = Math.round(gramsPerDay / refeicoesPerDay)
  const kcalTotal = Math.round((gramsPerDay * linha.emKcal) / 100)

  const coposMedidores = linha.copoMedidorG
    ? Math.round((gramsPerDay / linha.copoMedidorG) * 10) / 10
    : undefined

  // Advertência para pesos muito acima do limite da tabela
  const tabelaMaxPeso = linha.tabela[linha.tabela.length - 1][0]
  const advertencia =
    pesoUsadoKg > tabelaMaxPeso * 1.2
      ? `Peso acima da faixa da tabela do fabricante (máx. ${tabelaMaxPeso}kg). Consulte o veterinário para ajuste individualizado.`
      : undefined

  return {
    marca,
    nomeMarca: linha.nomeMarca,
    nomeLinha: linha.nomeLinha,
    pesoUsadoKg,
    pesoIdealEstimadoKg,
    eccAjuste,
    gramsPerDay,
    gramsPerRefeicao,
    refeicoesPerDay,
    coposMedidores,
    emKcal: linha.emKcal,
    kcalTotal,
    urlProduto: linha.urlProduto,
    nota: linha.nota,
    advertencia,
  }
}

/**
 * Calcula a dieta para todas as marcas disponíveis (modo comparação).
 *
 * @param input - Dados do paciente (sem campo `marca`)
 * @returns Resultados para todas as marcas e informações de ajuste de ECC
 */
export function calcularDietaMultimarca(
  input: Omit<DietaInput, 'marca'>,
): ResultadoDietaMultimarca {
  const linhas = getLinhasDisponiveis(input.especie)
  const pesoIdealEstimadoKg = estimarPesoIdeal(input.pesoAtualKg, input.ecc)
  const eccAjuste: ResultadoDieta['eccAjuste'] =
    input.ecc <= 3 ? 'abaixo' : input.ecc <= 5 ? 'ideal' : 'acima'

  const resultados = linhas.map((linha) =>
    calcularDietaRenal({ ...input, marca: linha.marca }),
  )

  return {
    resultados,
    pesoUsadoKg: pesoIdealEstimadoKg,
    pesoIdealEstimadoKg,
    eccAjuste,
  }
}

// ─── Dados de apoio para UI ───────────────────────────────────────────────────

export const ECC_DESCRICOES: Record<ECC, { label: string; descricao: string; cor: string }> = {
  1: { label: 'ECC 1 — Caquético', descricao: 'Costelas, vértebras e proeminências ósseas visíveis à distância. Sem gordura palpável.', cor: 'text-red-600' },
  2: { label: 'ECC 2 — Muito magro', descricao: 'Costelas facilmente visíveis. Perda de massa muscular evidente.', cor: 'text-red-500' },
  3: { label: 'ECC 3 — Magro', descricao: 'Costelas palpáveis sem cobertura de gordura. Cintura evidente.', cor: 'text-orange-500' },
  4: { label: 'ECC 4 — Abaixo do ideal', descricao: 'Costelas facilmente palpáveis com cobertura mínima de gordura.', cor: 'text-amber-500' },
  5: { label: 'ECC 5 — Ideal', descricao: 'Costelas palpáveis sem excesso. Cintura definida. Abdômen levemente recolhido.', cor: 'text-emerald-600' },
  6: { label: 'ECC 6 — Levemente acima', descricao: 'Costelas palpáveis com leve cobertura. Cintura pouco definida.', cor: 'text-yellow-600' },
  7: { label: 'ECC 7 — Sobrepeso', descricao: 'Costelas com dificuldade de palpar. Depósitos gordurosos na base da cauda.', cor: 'text-orange-600' },
  8: { label: 'ECC 8 — Obeso', descricao: 'Costelas muito difíceis de palpar. Cintura ausente. Abdômen arredondado.', cor: 'text-red-600' },
  9: { label: 'ECC 9 — Gravemente obeso', descricao: 'Massas de gordura no pescoço, membros e base da cauda. Incapaz de palpar costelas.', cor: 'text-red-700' },
}

export const MARCAS_LABELS: Record<Marca, string> = {
  'royal-canin': 'Royal Canin',
  hills: "Hill's",
  premier: 'Premier Pet',
  vetlife: 'Vet Life (Farmina)',
}

export const MARCAS_CORES: Record<Marca, { bg: string; border: string; text: string; badge: string }> = {
  'royal-canin': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-500' },
  hills:         { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-600' },
  premier:       { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-600' },
  vetlife:       { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-600' },
}
