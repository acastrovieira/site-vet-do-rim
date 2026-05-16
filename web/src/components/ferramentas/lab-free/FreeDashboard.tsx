'use client'

import { useState } from 'react'
import type { FreePatient, FreeLabExam } from '@/lib/lab-free/types'
import { getExamsForPatient } from '@/lib/lab-free/storage'
import { FreeEvolutionTable } from './FreeEvolutionTable'
import { FreeChartsView } from './FreeChartsView'
import { FreeExamForm } from './FreeExamForm'
import { LeadGate } from './LeadGate'
import {
  ArrowLeft, Plus, TrendingUp, Info,
  FlaskConical, CalendarDays, Cloud,
} from 'lucide-react'
import { differenceInYears, differenceInMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  patient: FreePatient
  onBack: () => void
}

type Tab = 'lab' | 'charts' | 'info' | 'advanced'

/**
 * Dashboard do paciente com tabs: Laboratorial, Gráficos, Info, Avançado.
 */
export function FreeDashboard({ patient, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('lab')
  const [showExamForm, setShowExamForm] = useState(false)
  const [exams, setExams] = useState<FreeLabExam[]>(() => getExamsForPatient(patient.id))

  function refreshExams() {
    setExams(getExamsForPatient(patient.id))
  }

  function getAge() {
    if (!patient.birthDate) return null
    const b = new Date(patient.birthDate)
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

  return (
    <div className="animate-fade-up">
      {/* Patient Hero Card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm"
              style={{ background: 'linear-gradient(135deg, #1A2E5A 0%, #0891b2 100%)' }}
            >
              <span>{SPECIES_EMOJI[patient.species] ?? '🐾'}</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{patient.petName}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {patient.species}{patient.breed ? ` · ${patient.breed}` : ''}
                {getAge() && ` · ${getAge()}`}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Tutor: {patient.tutorName}</p>
            </div>
          </div>

          {tab === 'lab' && (
            <button
              onClick={() => setShowExamForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg"
            >
              <Plus className="h-4 w-4" /> Adicionar Exame
            </button>
          )}
        </div>

        {/* Stats strip */}
        {exams.length > 0 && (
          <div className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-brand-500" />
              <span className="text-sm font-semibold text-slate-700">{exams.length}</span>
              <span className="text-sm text-slate-400">exame{exams.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-400">
                Último: {format(new Date(exams[exams.length - 1].examDate), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              tab === t.id
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count !== undefined && t.count > 0 && (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === t.id ? 'bg-brand-50 text-brand-600' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div key={tab} className="animate-fade-up">
        {tab === 'lab' && <FreeEvolutionTable patient={patient} exams={exams} onExamsChange={refreshExams} />}
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
          onSaved={() => { refreshExams(); setShowExamForm(false) }}
          onCancel={() => setShowExamForm(false)}
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
    ['Data de Nascimento', patient.birthDate ? format(new Date(patient.birthDate), 'dd/MM/yyyy', { locale: ptBR }) : '—'],
    ['Idade', age || '—'],
    ['Tutor', patient.tutorName],
    ['ID', patient.id],
    ['Cadastrado em', format(new Date(patient.createdAt), 'dd/MM/yyyy', { locale: ptBR })],
  ]
  return (
    <div className="max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-sm animate-fade-up">
      <h3 className="mb-4 text-sm font-bold text-slate-700">Dados do Paciente</h3>
      <dl className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6">
            <dt className="shrink-0 text-sm text-slate-400">{label}</dt>
            <dd className="break-all text-right text-sm font-semibold text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
