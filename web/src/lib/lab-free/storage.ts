/**
 * Persistencia local da planilha gratuita.
 *
 * O formato v2 consolida pacientes e exames em um unico documento atomico.
 * Todas as mutacoes cooperativas passam por Web Locks e exigem a revisao que
 * estava visivel ao usuario. As duas chaves v1 permanecem intactas como backup.
 */

import {
  FREE_LAB_LIMITS,
  type FreePatient,
  type FreeLabExam,
  type LabParameter,
} from './types.ts'

export const PATIENTS_KEY = 'vetdorim_free_patients'
export const EXAMS_KEY = 'vetdorim_free_exams'
export const FREE_LAB_STATE_KEY = 'vetdorim_free_state_v2'
export const FREE_LAB_LOCK_NAME = 'vetdorim:free-lab:state'

const FREE_LAB_STATE_KIND = 'vetdorim-free-lab'
const FREE_LAB_SCHEMA_VERSION = 2
const LOCK_TIMEOUT_MS = 3_000
const SHA256_HEX_LENGTH = 64

export type FreeLabStorageErrorCode =
  | 'CORRUPT'
  | 'UNAVAILABLE'
  | 'WRITE_FAILED'
  | 'PARTIAL_WRITE'
  | 'CONFLICT'
  | 'BUSY'
  | 'LOCK_UNAVAILABLE'
  | 'OUTCOME_UNKNOWN'
  | 'LEGACY_CONFLICT'
  | 'UNSUPPORTED_VERSION'
  | 'PARENT_NOT_FOUND'

export class FreeLabStorageError extends Error {
  readonly code: FreeLabStorageErrorCode

  constructor(code: FreeLabStorageErrorCode) {
    super('Free laboratory storage operation failed')
    this.name = 'FreeLabStorageError'
    this.code = code
  }
}

const BLOCKING_ERROR_CODES = new Set<FreeLabStorageErrorCode>([
  'CORRUPT',
  'UNAVAILABLE',
  'PARTIAL_WRITE',
  'LOCK_UNAVAILABLE',
  'OUTCOME_UNKNOWN',
  'LEGACY_CONFLICT',
  'UNSUPPORTED_VERSION',
])

export function isBlockingFreeLabStorageError(error: unknown) {
  return error instanceof FreeLabStorageError && BLOCKING_ERROR_CODES.has(error.code)
}

export function getFreeLabMutationErrorCopy(error: unknown) {
  if (!(error instanceof FreeLabStorageError)) {
    return 'Não foi possível concluir a alteração neste navegador. Nenhum dado deve ser reenviado sem revisar a planilha.'
  }
  if (error.code === 'CONFLICT') {
    return 'Os dados foram alterados em outra aba. Seu rascunho foi preservado; revise os dados atualizados e confirme novamente.'
  }
  if (error.code === 'BUSY') {
    return 'Outra aba ainda está concluindo uma alteração. Aguarde alguns segundos e tente novamente.'
  }
  if (error.code === 'PARENT_NOT_FOUND') {
    return 'Este paciente foi excluído em outra aba. O exame não foi salvo; copie o rascunho antes de fechar.'
  }
  if (error.code === 'WRITE_FAILED') {
    return 'Não foi possível gravar no armazenamento local. O estado anterior foi preservado; verifique o espaço disponível e tente novamente.'
  }
  return 'Não foi possível concluir a alteração com segurança. Revise a planilha antes de tentar novamente.'
}

export interface FreeLabSnapshot {
  patients: FreePatient[]
  exams: FreeLabExam[]
  revision: number
  storageToken: string
}

interface LegacyFingerprint {
  patients: string
  exams: string
}

interface StoredFreeLabState {
  kind: typeof FREE_LAB_STATE_KIND
  schemaVersion: typeof FREE_LAB_SCHEMA_VERSION
  documentId: string
  revision: number
  updatedAt: string
  lastMutationId: string
  legacyFingerprint: LegacyFingerprint
  patients: FreePatient[]
  exams: FreeLabExam[]
}

interface RawLegacyState {
  patients: string | null
  exams: string | null
}

interface InternalFreeLabState extends FreeLabSnapshot {
  documentId: string | null
  stateRaw: string | null
  legacyRaw: RawLegacyState
  legacyFingerprint: LegacyFingerprint
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isBoundedString(value: unknown, maxLength: number, required = false): value is string {
  return typeof value === 'string'
    && value.length <= maxLength
    && (!required || value.trim().length > 0)
}

function isOptionalBoundedString(value: unknown, maxLength: number) {
  return value === undefined || isBoundedString(value, maxLength)
}

function isCalendarDate(value: unknown, allowEmpty = false) {
  if (allowEmpty && value === '') return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isTimestamp(value: unknown) {
  return isBoundedString(value, FREE_LAB_LIMITS.timestamp, true)
    && Number.isFinite(Date.parse(value))
}

function isLabParameter(value: unknown): value is LabParameter {
  return isRecord(value)
    && isBoundedString(value.name, FREE_LAB_LIMITS.parameterName, true)
    && isBoundedString(value.value, FREE_LAB_LIMITS.parameterValue, true)
    && isBoundedString(value.unit, FREE_LAB_LIMITS.unit)
    && isOptionalBoundedString(value.refMin, FREE_LAB_LIMITS.reference)
    && isOptionalBoundedString(value.refMax, FREE_LAB_LIMITS.reference)
}

function isFreePatient(value: unknown): value is FreePatient {
  return isRecord(value)
    && isBoundedString(value.id, FREE_LAB_LIMITS.id, true)
    && isBoundedString(value.petName, FREE_LAB_LIMITS.patientName, true)
    && isBoundedString(value.species, FREE_LAB_LIMITS.species, true)
    && isBoundedString(value.breed, FREE_LAB_LIMITS.breed)
    && (value.sex === 'Macho' || value.sex === 'Fêmea')
    && isCalendarDate(value.birthDate, true)
    && isBoundedString(value.tutorName, FREE_LAB_LIMITS.tutorName, true)
    && isTimestamp(value.createdAt)
}

function isFreeLabExam(value: unknown): value is FreeLabExam {
  return isRecord(value)
    && isBoundedString(value.id, FREE_LAB_LIMITS.id, true)
    && isBoundedString(value.patientId, FREE_LAB_LIMITS.id, true)
    && isCalendarDate(value.examDate)
    && isBoundedString(value.labName, FREE_LAB_LIMITS.labName)
    && Array.isArray(value.parameters)
    && value.parameters.length > 0
    && value.parameters.length <= FREE_LAB_LIMITS.parametersPerExam
    && value.parameters.every(isLabParameter)
    && isTimestamp(value.createdAt)
}

type StoredArrayResult<T> =
  | { ok: true; data: T[] }
  | { ok: false }

function parseStoredArrayResult<T>(
  raw: string | null,
  isItem: (value: unknown) => value is T,
  maxItems: number,
): StoredArrayResult<T> {
  if (raw === null) return { ok: true, data: [] }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length > maxItems || !parsed.every(isItem)) {
      return { ok: false }
    }
    return { ok: true, data: parsed }
  } catch {
    return { ok: false }
  }
}

function parseStoredArray<T>(
  raw: string | null,
  isItem: (value: unknown) => value is T,
  label: string,
  maxItems: number,
): T[] {
  const result = parseStoredArrayResult(raw, isItem, maxItems)
  if (!result.ok) {
    console.warn(`[VetDoRim Free] ${label} invalidos no storage; valor original preservado.`)
    return []
  }
  return result.data
}

export function parsePatientsStorage(raw: string | null): FreePatient[] {
  return parseStoredArray(raw, isFreePatient, 'Pacientes', FREE_LAB_LIMITS.patients)
}

export function parseExamsStorage(raw: string | null): FreeLabExam[] {
  return parseStoredArray(raw, isFreeLabExam, 'Exames', FREE_LAB_LIMITS.exams)
}

function validateCollections(patients: readonly FreePatient[], exams: readonly FreeLabExam[]) {
  if (
    patients.length > FREE_LAB_LIMITS.patients
    || exams.length > FREE_LAB_LIMITS.exams
    || !patients.every(isFreePatient)
    || !exams.every(isFreeLabExam)
  ) {
    throw new FreeLabStorageError('CORRUPT')
  }

  const patientIds = new Set(patients.map((patient) => patient.id))
  const examIds = new Set(exams.map((exam) => exam.id))
  if (
    patientIds.size !== patients.length
    || examIds.size !== exams.length
    || exams.some((exam) => !patientIds.has(exam.patientId))
  ) {
    throw new FreeLabStorageError('CORRUPT')
  }
}

function readStorageItem(key: string) {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    throw new FreeLabStorageError('UNAVAILABLE')
  }
}

function readLegacyRaw(): RawLegacyState {
  return {
    patients: readStorageItem(PATIENTS_KEY),
    exams: readStorageItem(EXAMS_KEY),
  }
}

function parseLegacyState(raw: RawLegacyState) {
  const patientsResult = parseStoredArrayResult(
    raw.patients,
    isFreePatient,
    FREE_LAB_LIMITS.patients,
  )
  const examsResult = parseStoredArrayResult(
    raw.exams,
    isFreeLabExam,
    FREE_LAB_LIMITS.exams,
  )
  if (!patientsResult.ok || !examsResult.ok) {
    console.warn('[VetDoRim Free] Dados legados invalidos; mutacoes bloqueadas.')
    throw new FreeLabStorageError('CORRUPT')
  }
  validateCollections(patientsResult.data, examsResult.data)
  return { patients: patientsResult.data, exams: examsResult.data }
}

function parseStoredState(raw: string): StoredFreeLabState {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new FreeLabStorageError('CORRUPT')
  }

  if (
    isRecord(parsed)
    && parsed.kind === FREE_LAB_STATE_KIND
    && parsed.schemaVersion !== FREE_LAB_SCHEMA_VERSION
  ) {
    throw new FreeLabStorageError('UNSUPPORTED_VERSION')
  }

  if (
    !isRecord(parsed)
    || parsed.kind !== FREE_LAB_STATE_KIND
    || parsed.schemaVersion !== FREE_LAB_SCHEMA_VERSION
    || !isBoundedString(parsed.documentId, FREE_LAB_LIMITS.id, true)
    || !Number.isSafeInteger(parsed.revision)
    || Number(parsed.revision) < 1
    || !isTimestamp(parsed.updatedAt)
    || !isBoundedString(parsed.lastMutationId, FREE_LAB_LIMITS.id, true)
    || !isRecord(parsed.legacyFingerprint)
    || typeof parsed.legacyFingerprint.patients !== 'string'
    || parsed.legacyFingerprint.patients.length !== SHA256_HEX_LENGTH
    || typeof parsed.legacyFingerprint.exams !== 'string'
    || parsed.legacyFingerprint.exams.length !== SHA256_HEX_LENGTH
    || !Array.isArray(parsed.patients)
    || !Array.isArray(parsed.exams)
  ) {
    throw new FreeLabStorageError('CORRUPT')
  }

  const state = parsed as unknown as StoredFreeLabState
  validateCollections(state.patients, state.exams)
  return state
}

async function sha256(raw: string | null) {
  if (!globalThis.crypto?.subtle) throw new FreeLabStorageError('UNAVAILABLE')
  const taggedValue = raw === null ? 'null:' : `value:${raw}`
  const bytes = new TextEncoder().encode(taggedValue)
  let digest: ArrayBuffer
  try {
    digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  } catch {
    throw new FreeLabStorageError('UNAVAILABLE')
  }
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function fingerprintLegacy(raw: RawLegacyState): Promise<LegacyFingerprint> {
  const [patients, exams] = await Promise.all([
    sha256(raw.patients),
    sha256(raw.exams),
  ])
  return { patients, exams }
}

function legacyFingerprintMatches(a: LegacyFingerprint, b: LegacyFingerprint) {
  return a.patients === b.patients && a.exams === b.exams
}

function rawLegacyMatches(a: RawLegacyState, b: RawLegacyState) {
  return a.patients === b.patients && a.exams === b.exams
}

async function readFreeLabState(): Promise<InternalFreeLabState> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stateRaw = readStorageItem(FREE_LAB_STATE_KEY)
    const legacyRaw = readLegacyRaw()
    const legacyFingerprint = await fingerprintLegacy(legacyRaw)

    let state: InternalFreeLabState
    if (stateRaw === null) {
      const legacy = parseLegacyState(legacyRaw)
      state = {
        ...legacy,
        revision: 0,
        storageToken: `v1:${legacyFingerprint.patients}:${legacyFingerprint.exams}`,
        documentId: null,
        stateRaw,
        legacyRaw,
        legacyFingerprint,
      }
    } else {
      const stored = parseStoredState(stateRaw)
      if (!legacyFingerprintMatches(stored.legacyFingerprint, legacyFingerprint)) {
        throw new FreeLabStorageError('LEGACY_CONFLICT')
      }
      state = {
        patients: stored.patients,
        exams: stored.exams,
        revision: stored.revision,
        storageToken: `v2:${stored.documentId}:${stored.revision}`,
        documentId: stored.documentId,
        stateRaw,
        legacyRaw,
        legacyFingerprint,
      }
    }

    const stateRawAfterRead = readStorageItem(FREE_LAB_STATE_KEY)
    const legacyRawAfterRead = readLegacyRaw()
    if (stateRawAfterRead === stateRaw && rawLegacyMatches(legacyRawAfterRead, legacyRaw)) {
      return state
    }
  }
  throw new FreeLabStorageError('BUSY')
}

function snapshotFromState(state: InternalFreeLabState): FreeLabSnapshot {
  return {
    patients: state.patients,
    exams: state.exams,
    revision: state.revision,
    storageToken: state.storageToken,
  }
}

export async function getFreeLabSnapshot(): Promise<FreeLabSnapshot> {
  return snapshotFromState(await readFreeLabState())
}

function createOpaqueId() {
  if (!globalThis.crypto?.randomUUID) throw new FreeLabStorageError('UNAVAILABLE')
  return globalThis.crypto.randomUUID()
}

function assertExpectedRevision(expectedRevision: number, actualRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new FreeLabStorageError('CORRUPT')
  }
  if (expectedRevision !== actualRevision) throw new FreeLabStorageError('CONFLICT')
}

async function commitState(
  base: InternalFreeLabState,
  patients: FreePatient[],
  exams: FreeLabExam[],
): Promise<FreeLabSnapshot> {
  validateCollections(patients, exams)

  const currentStateRaw = readStorageItem(FREE_LAB_STATE_KEY)
  const currentLegacyRaw = readLegacyRaw()
  if (currentStateRaw !== base.stateRaw || !rawLegacyMatches(currentLegacyRaw, base.legacyRaw)) {
    throw new FreeLabStorageError('CONFLICT')
  }

  const next: StoredFreeLabState = {
    kind: FREE_LAB_STATE_KIND,
    schemaVersion: FREE_LAB_SCHEMA_VERSION,
    documentId: base.documentId ?? createOpaqueId(),
    revision: base.revision + 1,
    updatedAt: new Date().toISOString(),
    lastMutationId: createOpaqueId(),
    legacyFingerprint: base.legacyFingerprint,
    patients,
    exams,
  }
  const serialized = JSON.stringify(next)
  try {
    localStorage.setItem(FREE_LAB_STATE_KEY, serialized)
  } catch {
    throw new FreeLabStorageError('WRITE_FAILED')
  }

  let verified: string | null
  try {
    verified = localStorage.getItem(FREE_LAB_STATE_KEY)
  } catch {
    throw new FreeLabStorageError('OUTCOME_UNKNOWN')
  }
  if (verified !== serialized) throw new FreeLabStorageError('OUTCOME_UNKNOWN')

  return {
    patients: next.patients,
    exams: next.exams,
    revision: next.revision,
    storageToken: `v2:${next.documentId}:${next.revision}`,
  }
}

async function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') {
    throw new FreeLabStorageError('LOCK_UNAVAILABLE')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LOCK_TIMEOUT_MS)
  try {
    return await navigator.locks.request(
      FREE_LAB_LOCK_NAME,
      { mode: 'exclusive', signal: controller.signal },
      operation,
    )
  } catch (error) {
    if (error instanceof FreeLabStorageError) throw error
    if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new FreeLabStorageError('BUSY')
    }
    throw new FreeLabStorageError('UNAVAILABLE')
  } finally {
    clearTimeout(timeout)
  }
}

export async function getPatients(): Promise<FreePatient[]> {
  return (await getFreeLabSnapshot()).patients
}

export async function savePatient(
  patient: FreePatient,
  expectedRevision: number,
): Promise<FreeLabSnapshot> {
  if (!isFreePatient(patient)) throw new FreeLabStorageError('CORRUPT')
  return withMutationLock(async () => {
    const state = await readFreeLabState()
    assertExpectedRevision(expectedRevision, state.revision)
    const patients = [...state.patients]
    const index = patients.findIndex((item) => item.id === patient.id)
    if (index >= 0) patients[index] = patient
    else {
      if (patients.length >= FREE_LAB_LIMITS.patients) {
        throw new FreeLabStorageError('WRITE_FAILED')
      }
      patients.push(patient)
    }
    return commitState(state, patients, [...state.exams])
  })
}

export async function deletePatient(
  id: string,
  expectedRevision: number,
): Promise<FreeLabSnapshot> {
  return withMutationLock(async () => {
    const state = await readFreeLabState()
    if (!state.patients.some((patient) => patient.id === id)) return snapshotFromState(state)
    assertExpectedRevision(expectedRevision, state.revision)
    return commitState(
      state,
      state.patients.filter((patient) => patient.id !== id),
      state.exams.filter((exam) => exam.patientId !== id),
    )
  })
}

export async function getExams(): Promise<FreeLabExam[]> {
  return (await getFreeLabSnapshot()).exams
}

export async function getExamsForPatient(patientId: string): Promise<FreeLabExam[]> {
  return (await getFreeLabSnapshot()).exams
    .filter((exam) => exam.patientId === patientId)
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime())
}

export async function saveExam(
  exam: FreeLabExam,
  expectedRevision: number,
): Promise<FreeLabSnapshot> {
  if (!isFreeLabExam(exam)) throw new FreeLabStorageError('CORRUPT')
  return withMutationLock(async () => {
    const state = await readFreeLabState()
    if (!state.patients.some((patient) => patient.id === exam.patientId)) {
      throw new FreeLabStorageError('PARENT_NOT_FOUND')
    }
    assertExpectedRevision(expectedRevision, state.revision)
    const exams = [...state.exams]
    const index = exams.findIndex((item) => item.id === exam.id)
    if (index >= 0) exams[index] = exam
    else {
      if (exams.length >= FREE_LAB_LIMITS.exams) {
        throw new FreeLabStorageError('WRITE_FAILED')
      }
      exams.push(exam)
    }
    return commitState(state, [...state.patients], exams)
  })
}

export async function deleteExam(
  id: string,
  expectedRevision: number,
): Promise<FreeLabSnapshot> {
  return withMutationLock(async () => {
    const state = await readFreeLabState()
    if (!state.exams.some((exam) => exam.id === id)) return snapshotFromState(state)
    assertExpectedRevision(expectedRevision, state.revision)
    return commitState(
      state,
      [...state.patients],
      state.exams.filter((exam) => exam.id !== id),
    )
  })
}
