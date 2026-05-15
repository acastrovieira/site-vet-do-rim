/**
 * CRUD via localStorage para a versão gratuita da Planilha Laboratorial.
 * Keys isoladas: `vetdorim_free_patients` e `vetdorim_free_exams`.
 * Não interfere com dados do Lab Evolution (usa prefixo diferente).
 */

import type { FreePatient, FreeLabExam } from './types'

const PATIENTS_KEY = 'vetdorim_free_patients'
const EXAMS_KEY = 'vetdorim_free_exams'

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * JSON.parse seguro — retorna fallback se dados estão corrompidos.
 */
function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    console.warn('[VetDoRim Free] Dados corrompidos no storage, usando fallback.')
    return fallback
  }
}

// ─── Patients ─────────────────────────────────────────────────────────────

/**
 * Retorna todos os pacientes salvos no localStorage.
 */
export function getPatients(): FreePatient[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(PATIENTS_KEY)
  return safeJsonParse<FreePatient[]>(raw, [])
}

/**
 * Salva um paciente (insere ou atualiza).
 *
 * @param patient - Dados do paciente
 */
export function savePatient(patient: FreePatient): void {
  const patients = getPatients()
  const idx = patients.findIndex(p => p.id === patient.id)
  if (idx >= 0) patients[idx] = patient
  else patients.push(patient)
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients))
}

/**
 * Exclui um paciente e todos os seus exames.
 *
 * @param id - ID do paciente a excluir
 */
export function deletePatient(id: string): void {
  localStorage.setItem(
    PATIENTS_KEY,
    JSON.stringify(getPatients().filter(p => p.id !== id))
  )
  localStorage.setItem(
    EXAMS_KEY,
    JSON.stringify(getExams().filter(e => e.patientId !== id))
  )
}

// ─── Exams ────────────────────────────────────────────────────────────────

/**
 * Retorna todos os exames salvos no localStorage.
 */
export function getExams(): FreeLabExam[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(EXAMS_KEY)
  return safeJsonParse<FreeLabExam[]>(raw, [])
}

/**
 * Retorna os exames de um paciente, ordenados por data.
 *
 * @param patientId - ID do paciente
 * @returns Exames ordenados cronologicamente
 */
export function getExamsForPatient(patientId: string): FreeLabExam[] {
  return getExams()
    .filter(e => e.patientId === patientId)
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime())
}

/**
 * Salva um exame (insere ou atualiza).
 *
 * @param exam - Dados do exame
 */
export function saveExam(exam: FreeLabExam): void {
  const exams = getExams()
  const idx = exams.findIndex(e => e.id === exam.id)
  if (idx >= 0) exams[idx] = exam
  else exams.push(exam)
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams))
}

/**
 * Exclui um exame pelo ID.
 *
 * @param id - ID do exame a excluir
 */
export function deleteExam(id: string): void {
  localStorage.setItem(
    EXAMS_KEY,
    JSON.stringify(getExams().filter(e => e.id !== id))
  )
}
