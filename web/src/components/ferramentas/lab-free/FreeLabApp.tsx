'use client'

import { useState, useCallback, useEffect } from 'react'
import type { FreePatient } from '@/lib/lab-free/types'
import { getPatients } from '@/lib/lab-free/storage'
import { FreePatientList } from './FreePatientList'
import { FreePatientForm } from './FreePatientForm'
import { FreeDashboard } from './FreeDashboard'

type View = 'list' | 'dashboard'

/**
 * Componente raiz da ferramenta Planilha Laboratorial Gratuita.
 * Orquestra navegação entre lista de pacientes e dashboard individual.
 * Dados persistem em localStorage do navegador.
 */
export function FreeLabApp() {
  const [view, setView] = useState<View>('list')
  const [patients, setPatients] = useState<FreePatient[]>([])
  const [currentPatient, setCurrentPatient] = useState<FreePatient | null>(null)
  const [showForm, setShowForm] = useState(false)

  const refreshPatients = useCallback(() => {
    setPatients(getPatients())
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(refreshPatients, 0)
    return () => window.clearTimeout(timer)
  }, [refreshPatients])

  function handleSelectPatient(p: FreePatient) {
    setCurrentPatient(p)
    setView('dashboard')
  }

  function handleSavePatient(p: FreePatient) {
    refreshPatients()
    setShowForm(false)
    setCurrentPatient(p)
    setView('dashboard')
  }

  function handleBack() {
    refreshPatients()
    setView('list')
    setCurrentPatient(null)
  }

  return (
    <>
      {view === 'list' && (
        <FreePatientList
          patients={patients}
          onSelect={handleSelectPatient}
          onNew={() => setShowForm(true)}
          onRefresh={refreshPatients}
        />
      )}

      {view === 'dashboard' && currentPatient && (
        <FreeDashboard
          patient={currentPatient}
          onBack={handleBack}
        />
      )}

      {showForm && (
        <FreePatientForm
          onSave={handleSavePatient}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Banner de dados locais */}
      <div className="mt-8 rounded-xl border border-amber-200/60 bg-amber-50 p-3 text-center">
        <p className="text-xs leading-relaxed text-amber-700">
          <strong>💡 Seus dados ficam salvos neste navegador</strong> (localStorage).
          Para backup na nuvem, sincronização segura e leitura automática de PDFs via Inteligência Artificial,{' '}
          <a href="/auth/cadastro" className="font-bold text-brand-600 underline hover:text-brand-700">
            crie sua conta gratuita
          </a>.
        </p>
      </div>
    </>
  )
}
