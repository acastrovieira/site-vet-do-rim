'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FreePatient, FreeLabExam } from '@/lib/lab-free/types'
import { FreeEvolutionTable } from './FreeEvolutionTable'
import dynamic from 'next/dynamic'

// Lazy load para evitar baixar o bundle do Recharts no TTI inicial
const FreeChartsView = dynamic(() => import('./FreeChartsView').then(mod => mod.FreeChartsView), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
})
import { FreeExamForm } from './FreeExamForm'
import { LeadGate } from './LeadGate'
import {
  ArrowLeft, Plus, TrendingUp, Info,
  FlaskConical, CalendarDays, Cloud,
} from 'lucide-react'
import { differenceInYears, differenceInMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  patient: FreePatient
  initialExams: FreeLabExam[]
  revision: number
  patientAvailable: boolean
  onBack: () => void
  onRefresh: () => Promise<boolean>
  onDraftStateChange: (open: boolean) => void
  onStorageError: (error: unknown) => void
}

type Tab = 'lab' | 'charts' | 'info' | 'advanced'

/**
 * Dashboard do paciente com tabs: Laboratorial, Gráficos, Info, Avançado.
 */
export function FreeDashboard({
  patient,
  initialExams,
  revision,
  patientAvailable,
  onBack,
  onRefresh,
  onDraftStateChange,
  onStorageError,
}: Props) {
  const [tab, setTab] = useState<Tab>('lab')
  const [showExamForm, setShowExamForm] = useState(false)
  const exams = useMemo(
    () => [...initialExams].sort(
      (a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime(),
    ),
    [initialExams],
  )

  useEffect(() => () => onDraftStateChange(false), [onDraftStateChange])

  function refreshExams() {
    return onRefresh()
  }

  function openExamForm() {
    setShowExamForm(true)
    onDraftStateChange(true)
  }

  function closeExamForm() {
    setShowExamForm(false)
    onDraftStateChange(false)
    if (!patientAvailable) onBack()
  }

  function getAge() {
    if (!patient.birthDate) return null
    const b = parseISO(patient.birthDate)
    const y = differenceInYears(new Date(), b)
    return y >= 1 ? `${y} ano${y !== 1 ? 's' : ''}` : `${differenceInMonths(new Date(), b)} mês(es)`
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'lab', label: 'Laboratorial', icon: <FlaskConical className="h-3.5 w-3.5" />, count: exams.length },
    { id: 'charts', label: 'Gráficos', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { id: 'info', label: 'Paciente', icon: <Info className="h-3.5 w-3.5" /> },
    { id: 'advanced', label: 'Avançado', icon: <Cloud className="h-3.5 w-3.5" /> },
  ]

  const SPECIES_EMOJI: Record<string, string> = {
    Canino: '🐶', Felino: '🐱', Equino: '🐴', Bovino: '🐄',
    Ovino: '🐑', Caprino: '🐐', Ave: '🐦', Réptil: '🦎', Outro: '🐾',
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    setTab(tabs[nextIndex].id)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[nextIndex]?.focus()
  }

  return (
    <div className="animate-fade-up">
      {/* Patient Hero Card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0F2244]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 w-full flex-1 items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-science-400 dark:hover:bg-white/5 dark:hover:text-white"
              aria-label="Voltar para pacientes"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm"
              style={{ background: 'linear-gradient(135deg, #1A2E5A 0%, #0891b2 100%)' }}
            >
              <span>{SPECIES_EMOJI[patient.species] ?? '🐾'}</span>
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{patient.petName}</h2>
              <p className="break-words mt-0.5 text-sm text-slate-500 dark:text-science-200">
                {patient.species}{patient.breed ? ` · ${patient.breed}` : ''}
                {getAge() && ` · ${getAge()}`}
              </p>
              <p className="break-words mt-0.5 text-xs text-slate-400 dark:text-science-400">Tutor: {patient.tutorName}</p>
            </div>
          </div>

          {tab === 'lab' && (
            <button
              type="button"
              onClick={openExamForm}
              disabled={!patientAvailable}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Adicionar Exame
            </button>
          )}
        </div>

        {/* Stats strip */}
        {exams.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4 dark:border-white/10">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-brand-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-science-100">{exams.length}</span>
              <span className="text-sm text-slate-400 dark:text-science-400">exame{exams.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400 dark:text-science-400" />
              <span className="text-sm text-slate-400 dark:text-science-400">
                Último: {format(parseISO(exams[exams.length - 1].examDate), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
        )}
      </div>

      {!patientAvailable && (
        <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          Este paciente foi excluído em outra aba. O rascunho aberto foi preservado para consulta, mas não poderá ser salvo.
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="tablist" aria-label="Seções do paciente">
        {tabs.map((t, index) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`free-dashboard-panel-${t.id}`}
            aria-label={t.label}
            tabIndex={tab === t.id ? 0 : -1}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:flex-none sm:px-3 ${
              tab === t.id
                ? 'bg-white text-brand-600 shadow-sm dark:bg-white/10 dark:text-gold-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-science-300 dark:hover:text-white'
            }`}
          >
            {t.icon}
            <span className="sr-only sm:not-sr-only">{t.label}</span>
            {t.count !== undefined && t.count > 0 && (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === t.id ? 'bg-brand-50 text-brand-600 dark:bg-gold-400/10 dark:text-gold-400' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-science-300'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        key={tab}
        id={`free-dashboard-panel-${tab}`}
        className="animate-fade-up"
        role="tabpanel"
      >
        {tab === 'lab' && (
          <FreeEvolutionTable
            patient={patient}
            exams={exams}
            revision={revision}
            onExamsChange={refreshExams}
            onStorageError={onStorageError}
          />
        )}
        {tab === 'charts' && <FreeChartsView exams={exams} />}
        {tab === 'info' && <PatientInfoCard patient={patient} age={getAge()} />}
        {tab === 'advanced' && (
          <div className="space-y-4">
            <LeadGate
              title="Leitura com Inteligência Artificial"
              description="Envie PDFs e fotos de exames. O sistema extrai os parâmetros automaticamente via IA e preenche a planilha para você."
            />
            <LeadGate
              title="Sincronização na Nuvem"
              description="Salve planilhas e arquivos originais na nuvem para backup, auditoria e acesso em qualquer dispositivo."
            />
            <LeadGate
              title="Portal do Tutor"
              description="Compartilhe a evolução laboratorial e laudos de imagem de forma segura com o tutor do pet."
            />
            <LeadGate
              title="Gestão de Prontuários Completa"
              description="Armazenamento na nuvem com histórico, laudos de imagem (ultrassom, raio-x) e muito mais criando uma conta gratuita."
            />
          </div>
        )}
      </div>

      {/* Exam Form Modal */}
      {showExamForm && (
        <FreeExamForm
          patientId={patient.id}
          revision={revision}
          onSaved={async () => {
            if (await refreshExams()) closeExamForm()
          }}
          onCancel={closeExamForm}
          onRefresh={refreshExams}
          onStorageError={onStorageError}
        />
      )}
    </div>
  )
}

function PatientInfoCard({ patient, age }: { patient: FreePatient; age: string | null }) {
  const rows: [string, string][] = [
    ['Nome do Pet', patient.petName],
    ['Espécie', patient.species],
    ['Raça', patient.breed || '—'],
    ['Sexo', patient.sex],
    ['Data de Nascimento', patient.birthDate ? format(parseISO(patient.birthDate), 'dd/MM/yyyy', { locale: ptBR }) : '—'],
    ['Idade', age || '—'],
    ['Tutor', patient.tutorName],
    ['ID', patient.id],
    ['Cadastrado em', format(new Date(patient.createdAt), 'dd/MM/yyyy', { locale: ptBR })],
  ]
  return (
    <div className="max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-sm animate-fade-up dark:border-white/10 dark:bg-[#0F2244]">
      <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Dados do Paciente</h3>
      <dl className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6">
            <dt className="shrink-0 text-sm text-slate-400 dark:text-science-400">{label}</dt>
            <dd className="break-all text-right text-sm font-semibold text-slate-700 dark:text-science-100">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
