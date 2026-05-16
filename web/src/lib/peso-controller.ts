/**
 * @file peso-controller.ts
 * Gerenciamento local do histórico de peso corporal.
 * Todos os dados são armazenados apenas no localStorage do navegador — sem servidor.
 */

import type { Especie, ECC } from './dieta-renal-calculator'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RegistroPeso {
  id: string
  /** Nome do paciente (opcional) */
  nomePaciente?: string
  especie: Especie
  pesoKg: number
  ecc: ECC
  /** Data no formato ISO 8601: YYYY-MM-DD */
  data: string
  observacoes?: string
  /** Timestamp de criação (ms) */
  criadoEm: number
}

export interface HistoricoPeso {
  pacienteId: string
  nomePaciente: string
  especie: Especie
  registros: RegistroPeso[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vetdorim:peso-historico'
const MAX_REGISTROS = 500 // limite de segurança para o localStorage

// ─── Utilidades ───────────────────────────────────────────────────────────────

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function lerStorage(): RegistroPeso[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RegistroPeso[]
  } catch {
    return []
  }
}

function escreverStorage(registros: RegistroPeso[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros))
}

// ─── API Pública ─────────────────────────────────────────────────────────────

/**
 * Salva um novo registro de peso no histórico local.
 *
 * @param dados - Dados do registro (sem id e criadoEm — gerados automaticamente)
 * @returns Registro salvo com id e timestamp
 */
export function salvarPeso(
  dados: Omit<RegistroPeso, 'id' | 'criadoEm'>,
): RegistroPeso {
  const registro: RegistroPeso = {
    ...dados,
    id: gerarId(),
    criadoEm: Date.now(),
  }

  const historico = lerStorage()
  // Remove registros mais antigos se exceder o limite
  const atualizado = [registro, ...historico].slice(0, MAX_REGISTROS)
  escreverStorage(atualizado)
  return registro
}

/**
 * Lista todos os registros de peso, ordenados do mais recente para o mais antigo.
 *
 * @param filtro - Filtro opcional por nome do paciente (case-insensitive)
 * @returns Lista de registros
 */
export function listarPesos(filtro?: { nomePaciente?: string }): RegistroPeso[] {
  const historico = lerStorage()

  if (filtro?.nomePaciente) {
    const termo = filtro.nomePaciente.toLowerCase()
    return historico.filter((r) =>
      r.nomePaciente?.toLowerCase().includes(termo),
    )
  }

  return historico.sort((a, b) => b.criadoEm - a.criadoEm)
}

/**
 * Deleta um registro pelo id.
 *
 * @param id - Identificador do registro
 * @returns true se removido, false se não encontrado
 */
export function deletarPeso(id: string): boolean {
  const historico = lerStorage()
  const filtrado = historico.filter((r) => r.id !== id)
  if (filtrado.length === historico.length) return false
  escreverStorage(filtrado)
  return true
}

/**
 * Remove todos os registros do histórico.
 */
export function limparHistorico(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}

/**
 * Exporta o histórico como string CSV.
 *
 * @param registros - Lista de registros a exportar
 * @returns Conteúdo CSV como string
 */
export function exportarCSV(registros: RegistroPeso[]): string {
  const header = 'Data,Paciente,Espécie,Peso (kg),ECC,Observações'
  const especies: Record<Especie, string> = { cao: 'Cão', gato: 'Gato' }

  const linhas = registros.map((r) => {
    const cols = [
      r.data,
      `"${r.nomePaciente ?? '-'}"`,
      especies[r.especie],
      r.pesoKg.toFixed(2),
      r.ecc.toString(),
      `"${r.observacoes ?? ''}"`,
    ]
    return cols.join(',')
  })

  return [header, ...linhas].join('\n')
}

/**
 * Dispara o download do CSV no navegador.
 *
 * @param registros - Registros a exportar
 * @param nomeArquivo - Nome do arquivo (sem extensão)
 */
export function downloadCSV(
  registros: RegistroPeso[],
  nomeArquivo = 'historico-peso-vetdorim',
): void {
  const csv = exportarCSV(registros)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${nomeArquivo}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Retorna o total de registros no histórico.
 */
export function contarRegistros(): number {
  return lerStorage().length
}
