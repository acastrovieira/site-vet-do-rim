'use client'

import { useRef, useState } from 'react'
import type { FreePatient } from '@/lib/lab-free/types'
import {
  FreeLabStorageError,
  getFreeLabMutationErrorCopy,
  isBlockingFreeLabStorageError,
  savePatient,
} from '@/lib/lab-free/storage'
import { generateId } from '@/lib/lab-free/id'
import { PawPrint, X } from 'lucide-react'
import { useAccessibleDialog } from '@/hooks/useAccessibleDialog'

interface Props {
  revision: number
  onSave: (p: FreePatient) => Promise<void>
  onCancel: () => void
  onRefresh: () => Promise<boolean>
  onStorageError: (error: unknown) => void
}

function getLocalIsoDate(now = new Date()) {
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 10)
}

/**
 * Modal de cadastro simplificado de paciente.
 * Sem campos de auth — versão gratuita.
 */
export function FreePatientForm({ revision, onSave, onCancel, onRefresh, onStorageError }: Props) {
  const [form, setForm] = useState({
    petName: '',
    species: 'Canino',
    breed: '',
    sex: 'Macho' as 'Macho' | 'Fêmea',
    birthDate: '',
    tutorName: '',
  })
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const petNameRef = useRef<HTMLInputElement>(null)
  const saveInFlightRef = useRef(false)
  const dialogRef = useAccessibleDialog({
    open: true,
    onClose: onCancel,
    closeDisabled: saving,
    initialFocusRef: petNameRef,
  })

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (!form.petName.trim()) errs.push('Nome do pet é obrigatório.')
    if (!form.tutorName.trim()) errs.push('Nome do tutor é obrigatório.')
    if (form.birthDate && form.birthDate > getLocalIsoDate()) errs.push('A data de nascimento não pode estar no futuro.')
    if (errs.length > 0) { setErrors(errs); return }
    if (saveInFlightRef.current) return
    saveInFlightRef.current = true
    setSaving(true)

    try {
      const patient: FreePatient = {
        id: generateId('PAT'),
        ...form,
        petName: form.petName.trim(),
        tutorName: form.tutorName.trim(),
        breed: form.breed.trim(),
        createdAt: new Date().toISOString(),
      }
      await savePatient(patient, revision)
      await onSave(patient)
    } catch (error) {
      saveInFlightRef.current = false
      setSaving(false)
      if (isBlockingFreeLabStorageError(error)) {
        onStorageError(error)
        return
      }
      setErrors([getFreeLabMutationErrorCopy(error)])
      if (error instanceof FreeLabStorageError && error.code === 'CONFLICT') {
        await onRefresh()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-patient-dialog-title"
        aria-describedby={errors.length > 0 ? 'free-patient-errors' : undefined}
        tabIndex={-1}
        className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto animate-fade-up rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0F2244]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
              <PawPrint className="h-4 w-4 text-brand-500" aria-hidden />
            </div>
            <h2 id="free-patient-dialog-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">Novo Paciente</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="Fechar cadastro de paciente" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-science-400 dark:hover:bg-white/5 dark:hover:text-white">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          aria-busy={saving}
          className="space-y-4 px-6 py-5 dark:[&_label]:text-science-100 dark:[&_input]:border-white/10 dark:[&_input]:bg-white/5 dark:[&_input]:text-white dark:[&_input]:placeholder:text-science-500 dark:[&_input:focus]:bg-white/10 dark:[&_select]:border-white/10 dark:[&_select]:bg-[#111827] dark:[&_select]:text-white"
          noValidate
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="free-pet-name" className="mb-1 block text-xs font-semibold text-slate-600">Nome do Pet *</label>
              <input
                ref={petNameRef}
                id="free-pet-name"
                name="petName"
                required
                autoComplete="off"
                maxLength={120}
                aria-invalid={errors.some((error) => error.startsWith('Nome do pet'))}
                aria-describedby={errors.some((error) => error.startsWith('Nome do pet')) ? 'free-patient-errors' : undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-100"
                value={form.petName}
                onChange={e => set('petName', e.target.value)}
                placeholder="Ex: Rex"
              />
            </div>
            <div>
              <label htmlFor="free-pet-species" className="mb-1 block text-xs font-semibold text-slate-600">Espécie *</label>
              <select
                id="free-pet-species"
                name="species"
                required
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
              <label htmlFor="free-pet-breed" className="mb-1 block text-xs font-semibold text-slate-600">Raça</label>
              <input
                id="free-pet-breed"
                name="breed"
                maxLength={120}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.breed}
                onChange={e => set('breed', e.target.value)}
                placeholder="Ex: Labrador"
              />
            </div>
            <div>
              <label htmlFor="free-pet-sex" className="mb-1 block text-xs font-semibold text-slate-600">Sexo *</label>
              <select
                id="free-pet-sex"
                name="sex"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.sex}
                onChange={e => set('sex', e.target.value as 'Macho' | 'Fêmea')}
              >
                <option value="Macho">Macho</option>
                <option value="Fêmea">Fêmea</option>
              </select>
            </div>
            <div>
              <label htmlFor="free-pet-birth-date" className="mb-1 block text-xs font-semibold text-slate-600">Nascimento</label>
              <input
                id="free-pet-birth-date"
                name="birthDate"
                type="date"
                max={getLocalIsoDate()}
                aria-invalid={errors.some((error) => error.includes('nascimento'))}
                aria-describedby={errors.some((error) => error.includes('nascimento')) ? 'free-patient-errors' : undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.birthDate}
                onChange={e => set('birthDate', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="free-tutor-name" className="mb-1 block text-xs font-semibold text-slate-600">Nome do Tutor *</label>
              <input
                id="free-tutor-name"
                name="tutorName"
                required
                autoComplete="name"
                maxLength={120}
                aria-invalid={errors.some((error) => error.startsWith('Nome do tutor'))}
                aria-describedby={errors.some((error) => error.startsWith('Nome do tutor')) ? 'free-patient-errors' : undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={form.tutorName}
                onChange={e => set('tutorName', e.target.value)}
                placeholder="Ex: Maria"
              />
            </div>
          </div>

          {errors.length > 0 && (
            <div id="free-patient-errors" role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="min-h-11 flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Salvando com proteção…' : 'Salvar Paciente'}
            </button>
            <button type="button" onClick={onCancel} disabled={saving} className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-science-100 dark:hover:bg-white/5">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
