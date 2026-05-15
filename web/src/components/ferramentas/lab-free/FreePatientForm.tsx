'use client'

import { useState } from 'react'
import type { FreePatient } from '@/lib/lab-free/types'
import { savePatient } from '@/lib/lab-free/storage'
import { generateId } from '@/lib/lab-free/id'
import { PawPrint, X } from 'lucide-react'

interface Props {
  onSave: (p: FreePatient) => void
  onCancel: () => void
}

/**
 * Modal de cadastro simplificado de paciente.
 * Sem campos de auth — versão gratuita.
 */
export function FreePatientForm({ onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    petName: '',
    species: 'Canino',
    breed: '',
    sex: 'Macho' as 'Macho' | 'Fêmea',
    birthDate: '',
    tutorName: '',
  })
  const [errors, setErrors] = useState<string[]>([])

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors([])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (!form.petName.trim()) errs.push('Nome do pet é obrigatório.')
    if (!form.tutorName.trim()) errs.push('Nome do tutor é obrigatório.')
    if (errs.length > 0) { setErrors(errs); return }

    const patient: FreePatient = {
      id: generateId('PAT'),
      ...form,
      createdAt: new Date().toISOString(),
    }
    savePatient(patient)
    onSave(patient)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-fade-up rounded-2xl border border-slate-100 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
              <PawPrint className="h-4 w-4 text-brand-500" />
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900">Novo Paciente</h2>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nome do Pet *</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-100"
                value={form.petName}
                onChange={e => set('petName', e.target.value)}
                placeholder="Ex: Rex"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Espécie *</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.species}
                onChange={e => set('species', e.target.value)}
              >
                {['Canino', 'Felino', 'Equino', 'Bovino', 'Ovino', 'Caprino', 'Ave', 'Réptil', 'Outro'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Raça</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.breed}
                onChange={e => set('breed', e.target.value)}
                placeholder="Ex: Labrador"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Sexo *</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.sex}
                onChange={e => set('sex', e.target.value as 'Macho' | 'Fêmea')}
              >
                <option value="Macho">Macho</option>
                <option value="Fêmea">Fêmea</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nascimento</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.birthDate}
                onChange={e => set('birthDate', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nome do Tutor *</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.tutorName}
                onChange={e => set('tutorName', e.target.value)}
                placeholder="Ex: Maria"
              />
            </div>
          </div>

          {errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              {errors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" className="flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg">
              Salvar Paciente
            </button>
            <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
