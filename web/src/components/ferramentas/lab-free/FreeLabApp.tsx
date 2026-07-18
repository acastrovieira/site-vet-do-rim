'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { FreeLabExam, FreePatient } from '@/lib/lab-free/types'
import {
  EXAMS_KEY,
  FREE_LAB_STATE_KEY,
  FreeLabStorageError,
  getFreeLabSnapshot,
  PATIENTS_KEY,
} from '@/lib/lab-free/storage'
import { FreePatientList } from './FreePatientList'
import { FreePatientForm } from './FreePatientForm'
import { FreeDashboard } from './FreeDashboard'

type View = 'list' | 'dashboard'
type StorageStatus = 'loading' | 'ready' | 'error'

function storageErrorCopy(error: unknown) {
  if (error instanceof FreeLabStorageError && error.code === 'CORRUPT') {
    return 'Os dados locais não puderam ser validados. O conteúdo original foi preservado e novas alterações estão bloqueadas para evitar perda de informações.'
  }
  if (error instanceof FreeLabStorageError && error.code === 'PARTIAL_WRITE') {
    return 'Uma alteração local foi interrompida e pode ter sido aplicada apenas em parte. Não faça novas alterações antes de revisar os dados neste navegador.'
  }
  if (error instanceof FreeLabStorageError && error.code === 'LEGACY_CONFLICT') {
    return 'Uma aba com uma versão anterior alterou o backup local. O documento atual foi preservado e novas alterações estão bloqueadas até a reconciliação dos dados.'
  }
  if (error instanceof FreeLabStorageError && error.code === 'LOCK_UNAVAILABLE') {
    return 'Este navegador não oferece a trava necessária para editar com segurança entre abas. A planilha permanece protegida contra gravações concorrentes.'
  }
  if (error instanceof FreeLabStorageError && error.code === 'OUTCOME_UNKNOWN') {
    return 'O navegador não confirmou o resultado da última gravação. Não faça novas alterações antes de recarregar e revisar os dados salvos.'
  }
  if (error instanceof FreeLabStorageError && error.code === 'UNSUPPORTED_VERSION') {
    return 'Os dados locais usam uma versão mais recente do que esta página. Atualize a página antes de tentar editar.'
  }
  return 'O armazenamento local não está disponível. Nenhum dado foi carregado e novas alterações permanecem bloqueadas.'
}

/**
 * Componente raiz da ferramenta Planilha Laboratorial Gratuita.
 * Orquestra navegação entre lista de pacientes e dashboard individual.
 * Dados persistem em localStorage do navegador.
 */
export function FreeLabApp() {
  const [view, setView] = useState<View>('list')
  const [patients, setPatients] = useState<FreePatient[]>([])
  const [exams, setExams] = useState<FreeLabExam[]>([])
  const [revision, setRevision] = useState(0)
  const [currentPatient, setCurrentPatient] = useState<FreePatient | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('loading')
  const [storageError, setStorageError] = useState('')
  const [syncNotice, setSyncNotice] = useState('')
  const currentPatientIdRef = useRef<string | null>(null)
  const storageAlertRef = useRef<HTMLDivElement>(null)
  const refreshRequestRef = useRef(0)
  const appliedStorageTokenRef = useRef('')
  const examDraftOpenRef = useRef(false)

  const refreshPatients = useCallback(async (source: 'local' | 'remote' = 'local') => {
    const requestId = ++refreshRequestRef.current
    try {
      const snapshot = await getFreeLabSnapshot()
      if (requestId !== refreshRequestRef.current) return false
      const changedSinceLastRead = appliedStorageTokenRef.current !== ''
        && appliedStorageTokenRef.current !== snapshot.storageToken
      appliedStorageTokenRef.current = snapshot.storageToken
      let removedPatientDraftPreserved = false
      setPatients(snapshot.patients)
      setExams(snapshot.exams)
      setRevision(snapshot.revision)
      const currentPatientId = currentPatientIdRef.current
      if (currentPatientId) {
        const refreshedPatient = snapshot.patients.find((patient) => patient.id === currentPatientId)
        if (refreshedPatient) {
          setCurrentPatient(refreshedPatient)
        } else if (examDraftOpenRef.current) {
          removedPatientDraftPreserved = true
        } else {
          currentPatientIdRef.current = null
          setCurrentPatient(null)
          setView('list')
        }
      }
      setStorageError('')
      setStorageStatus('ready')
      if (source === 'remote' && changedSinceLastRead) {
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        setSyncNotice(
          removedPatientDraftPreserved
            ? 'Este paciente foi excluído em outra aba. Seu rascunho de exame foi preservado e não será salvo nesse paciente.'
            : `Dados atualizados em outra aba. Esta tela foi recarregada às ${time}.`,
        )
      }
      return true
    } catch (error) {
      if (requestId !== refreshRequestRef.current) return false
      setStorageError(storageErrorCopy(error))
      setStorageStatus('error')
      return false
    }
  }, [])

  const handleStorageFailure = useCallback((error: unknown) => {
    setStorageError(storageErrorCopy(error))
    setStorageStatus('error')
  }, [])

  const handleExamDraftState = useCallback((open: boolean) => {
    examDraftOpenRef.current = open
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshPatients() }, 0)
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return
      if (
        !event.key
        || event.key === PATIENTS_KEY
        || event.key === EXAMS_KEY
        || event.key === FREE_LAB_STATE_KEY
      ) {
        void refreshPatients('remote')
      }
    }
    const handleFocus = () => { void refreshPatients('remote') }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshPatients('remote')
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refreshPatients])

  useEffect(() => {
    if (storageStatus === 'error') storageAlertRef.current?.focus()
  }, [storageStatus])

  function handleSelectPatient(p: FreePatient) {
    currentPatientIdRef.current = p.id
    setCurrentPatient(p)
    setView('dashboard')
  }

  async function handleSavePatient(p: FreePatient) {
    if (await refreshPatients()) {
      setShowForm(false)
      currentPatientIdRef.current = p.id
      setCurrentPatient(p)
      setView('dashboard')
    }
  }

  function handleBack() {
    currentPatientIdRef.current = null
    examDraftOpenRef.current = false
    void refreshPatients()
    setView('list')
    setCurrentPatient(null)
  }

  return (
    <>
      {storageStatus === 'loading' && (
        <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Carregando dados salvos neste navegador</span>
          <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
        </div>
      )}

      {storageStatus === 'error' && (
        <div
          ref={storageAlertRef}
          tabIndex={-1}
          className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          role="alert"
        >
          <p className="font-semibold">Dados locais protegidos</p>
          <p className="mt-1 text-sm">{storageError}</p>
          <button
            type="button"
            onClick={() => { void refreshPatients() }}
            className="mt-4 min-h-11 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold hover:bg-red-100 dark:border-red-500/30 dark:hover:bg-red-500/10"
          >
            Tentar carregar novamente
          </button>
        </div>
      )}

      {storageStatus === 'ready' && syncNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200"
        >
          {syncNotice}
        </div>
      )}

      {storageStatus === 'ready' && view === 'list' && (
        <FreePatientList
          patients={patients}
          exams={exams}
          revision={revision}
          onSelect={handleSelectPatient}
          onNew={() => setShowForm(true)}
          onRefresh={refreshPatients}
          onStorageError={handleStorageFailure}
        />
      )}

      {storageStatus === 'ready' && view === 'dashboard' && currentPatient && (
        <FreeDashboard
          patient={currentPatient}
          initialExams={exams.filter((exam) => exam.patientId === currentPatient.id)}
          revision={revision}
          patientAvailable={patients.some((patient) => patient.id === currentPatient.id)}
          onBack={handleBack}
          onRefresh={refreshPatients}
          onDraftStateChange={handleExamDraftState}
          onStorageError={handleStorageFailure}
        />
      )}

      {storageStatus === 'ready' && showForm && (
        <FreePatientForm
          revision={revision}
          onSave={handleSavePatient}
          onCancel={() => setShowForm(false)}
          onRefresh={refreshPatients}
          onStorageError={handleStorageFailure}
        />
      )}

      {/* Banner de dados locais */}
      {storageStatus === 'ready' && (
        <div className="mt-8 rounded-xl border border-amber-200/60 bg-amber-50 p-3 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
        <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          <strong>💡 Seus dados ficam salvos neste navegador</strong> (localStorage).
          Para backup na nuvem, sincronização segura e leitura automática de PDFs via Inteligência Artificial,{' '}
          <a href="/auth/cadastro" className="font-bold text-brand-600 underline hover:text-brand-700 dark:text-gold-400 dark:hover:text-gold-400/80">
            crie sua conta gratuita
          </a>.
        </p>
        </div>
      )}
    </>
  )
}
