'use client'

import { useState, useMemo } from 'react'
import type { FreePatient } from '@/lib/lab-free/types'
import { getExamsForPatient, deletePatient } from '@/lib/lab-free/storage'
import { PawPrint, Plus, ChevronRight, Trash2, FlaskConical, Search, ArrowRight } from 'lucide-react'

interface Props {
  patients: FreePatient[]
  onSelect: (p: FreePatient) => void
  onNew: () => void
  onRefresh: () => void
}

const SPECIES_EMOJI: Record<string, string> = {
  Canino: '🐶', Felino: '🐱', Equino: '🐴', Bovino: '🐄',
  Ovino: '🐑', Caprino: '🐐', Ave: '🐦', Réptil: '🦎', Outro: '🐾',
}

const SPECIES_GRADIENTS: Record<string, string> = {
  Canino: 'from-amber-400 to-orange-500',
  Felino: 'from-violet-400 to-purple-600',
  Equino: 'from-amber-600 to-amber-700',
  Ave: 'from-sky-400 to-blue-500',
  default: 'from-brand-500 to-teal-600',
}

/**
 * Lista de pacientes cadastrados com busca e contagem de exames.
 */
export function FreePatientList({ patients, onSelect, onNew, onRefresh }: Props) {
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<FreePatient | null>(null)

  const patientStats = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of patients) {
      map[p.id] = getExamsForPatient(p.id).length
    }
    return map
  }, [patients])

  const totalExams = useMemo(
    () => patients.reduce((acc, p) => acc + (patientStats[p.id] ?? 0), 0),
    [patients, patientStats]
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return patients
    const q = query.toLowerCase()
    return patients.filter(
      p =>
        p.petName.toLowerCase().includes(q) ||
        p.tutorName.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        (p.breed && p.breed.toLowerCase().includes(q))
    )
  }, [patients, query])

  function handleDelete(p: FreePatient) {
    deletePatient(p.id)
    setPendingDelete(null)
    onRefresh()
  }

  return (
    <div className="animate-fade-up">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Pacientes</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {patients.length === 0
              ? 'Nenhum paciente cadastrado'
              : `${patients.length} paciente${patients.length !== 1 ? 's' : ''} · ${totalExams} exame${totalExams !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" /> Novo Paciente
        </button>
      </div>

      {/* Search */}
      {patients.length > 2 && (
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-100"
            placeholder="Buscar por nome, tutor, espécie ou raça..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      )}

      {patients.length === 0 ? (
        /* Empty state */
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -mr-20 -mt-20 right-0 top-0 h-64 w-64 rounded-full bg-brand-50 opacity-50 blur-3xl" />
          <div className="relative z-10">
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #1A2E5A, #0891b2)' }}
            >
              <PawPrint className="h-8 w-8 text-white" />
            </div>
            <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-900">
              Planilha Laboratorial
            </h2>
            <p className="mx-auto mb-8 max-w-md leading-relaxed text-slate-500">
              Cadastre pacientes e acompanhe a evolução dos exames laboratoriais com planilha visual interativa e exportação em PDF.
            </p>

            <div className="mb-8 flex flex-col gap-4 text-left sm:flex-row">
              {[
                { step: '1', title: 'Cadastre o Pet', desc: 'Nome, espécie, tutor e dados básicos.' },
                { step: '2', title: 'Insira os Exames', desc: 'Adicione parâmetros laboratoriais manualmente.' },
                { step: '3', title: 'Exporte em PDF', desc: 'Baixe a planilha evolutiva formatada.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{step}</span>
                    <p className="font-semibold text-slate-700">{title}</p>
                  </div>
                  <p className="ml-8 text-xs leading-relaxed text-slate-400">{desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onNew}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-8 py-3.5 text-base font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-2xl"
            >
              <Plus className="h-5 w-5" /> Cadastrar Primeiro Paciente <ArrowRight className="ml-1 h-4 w-4" />
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white py-12 text-center shadow-sm">
          <p className="text-slate-500">Nenhum paciente encontrado para &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p, idx) => {
            const examCount = patientStats[p.id] ?? 0
            const emoji = SPECIES_EMOJI[p.species] ?? '🐾'
            const grad = SPECIES_GRADIENTS[p.species] ?? SPECIES_GRADIENTS.default
            return (
              <div
                key={p.id}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-md animate-fade-up"
                style={{ animationDelay: `${idx * 40}ms` }}
                onClick={() => onSelect(p)}
              >
                {/* Avatar */}
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-2xl shadow-sm`}>
                  {emoji}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold tracking-tight text-slate-900">{p.petName}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {p.species}{p.breed ? ` · ${p.breed}` : ''} · Tutor: {p.tutorName}
                  </p>
                  {examCount > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                        <FlaskConical className="h-3 w-3" />{examCount} lab
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); setPendingDelete(p) }}
                    className="rounded-xl p-2 text-slate-400 transition-all duration-150 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Excluir paciente ${p.petName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirm */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 font-display text-lg font-bold text-slate-900">Excluir paciente?</h3>
            <p className="mb-5 text-sm text-slate-500">
              {pendingDelete.petName} e todos os seus exames serão removidos. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(pendingDelete)}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600"
              >
                Excluir
              </button>
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
