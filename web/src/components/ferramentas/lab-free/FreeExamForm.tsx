'use client'

import { useRef, useState } from 'react'
import type { FreeLabExam, LabParameter } from '@/lib/lab-free/types'
import { FREE_LAB_LIMITS, KNOWN_PARAMETERS } from '@/lib/lab-free/types'
import {
  FreeLabStorageError,
  getFreeLabMutationErrorCopy,
  isBlockingFreeLabStorageError,
  saveExam,
} from '@/lib/lab-free/storage'
import { generateId } from '@/lib/lab-free/id'
import { FileText, X, Plus, Check, Trash2 } from 'lucide-react'
import { LeadGate } from './LeadGate'
import { useAccessibleDialog } from '@/hooks/useAccessibleDialog'

interface Props {
  patientId: string
  revision: number
  onSaved: () => Promise<void>
  onCancel: () => void
  onRefresh: () => Promise<boolean>
  onStorageError: (error: unknown) => void
}

function getLocalIsoDate(now = new Date()) {
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 10)
}

/**
 * Modal de inserção manual de exame laboratorial.
 * Modo file/OCR bloqueado exigindo cadastro.
 */
export function FreeExamForm({ patientId, revision, onSaved, onCancel, onRefresh, onStorageError }: Props) {
  const today = getLocalIsoDate()
  const [examDate, setExamDate] = useState(today)
  const [labName, setLabName] = useState('')
  const [params, setParams] = useState<LabParameter[]>([
    { name: '', value: '', unit: '' },
  ])
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const saveInFlightRef = useRef(false)
  const examDateRef = useRef<HTMLInputElement>(null)
  const dialogRef = useAccessibleDialog({
    open: true,
    onClose: onCancel,
    closeDisabled: saving,
    initialFocusRef: examDateRef,
  })

  function updateParam(idx: number, field: keyof LabParameter, value: string) {
    setParams(ps => ps.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
    setErrorMsg('')
  }

  function removeParam(idx: number) {
    setParams(ps => ps.filter((_, i) => i !== idx))
  }

  function addParam() {
    if (params.length >= FREE_LAB_LIMITS.parametersPerExam) {
      setErrorMsg(`Cada exame aceita no máximo ${FREE_LAB_LIMITS.parametersPerExam} parâmetros.`)
      return
    }
    setParams(ps => [...ps, { name: '', value: '', unit: '' }])
  }

  function getSuggestions(query: string): string[] {
    if (!query.trim()) return []
    const lower = query.toLowerCase()
    return KNOWN_PARAMETERS.filter(p =>
      p.toLowerCase().includes(lower) && !params.some(existing => existing.name === p)
    ).slice(0, 6)
  }

  async function handleSave() {
    const validParams = params.filter(p => p.name.trim() && p.value.trim())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || examDate > today) {
      setErrorMsg('Informe uma data de exame válida, igual ou anterior à data local de hoje.')
      examDateRef.current?.focus()
      return
    }
    if (validParams.length === 0) {
      setErrorMsg('Informe ao menos um parâmetro e seu respectivo valor.')
      return
    }
    if (saveInFlightRef.current) return
    saveInFlightRef.current = true
    setSaving(true)

    try {
      const exam: FreeLabExam = {
        id: generateId('EXAM'),
        patientId,
        examDate,
        labName: labName.trim(),
        parameters: validParams.map((parameter) => ({
          ...parameter,
          name: parameter.name.trim(),
          value: parameter.value.trim(),
          unit: parameter.unit.trim(),
          refMin: parameter.refMin?.trim(),
          refMax: parameter.refMax?.trim(),
        })),
        createdAt: new Date().toISOString(),
      }
      await saveExam(exam, revision)
      await onSaved()
    } catch (error) {
      saveInFlightRef.current = false
      setSaving(false)
      if (isBlockingFreeLabStorageError(error)) {
        onStorageError(error)
        return
      }
      setErrorMsg(getFreeLabMutationErrorCopy(error))
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
        aria-labelledby="free-exam-dialog-title"
        aria-describedby={errorMsg ? 'free-exam-error' : undefined}
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] animate-fade-up overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0F2244]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
              <FileText className="h-4 w-4 text-brand-500" aria-hidden />
            </div>
            <h2 id="free-exam-dialog-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">Adicionar Exame Laboratorial</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="Fechar cadastro de exame" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-science-400 dark:hover:bg-white/5 dark:hover:text-white">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div aria-busy={saving} className="space-y-5 px-4 py-5 sm:px-6 dark:[&_h2]:text-white dark:[&_h3]:text-white dark:[&_label]:text-science-100 dark:[&_th]:text-science-400 dark:[&_input]:border-white/10 dark:[&_input]:bg-white/5 dark:[&_input]:text-white dark:[&_input]:placeholder:text-science-500 dark:[&_input:focus]:bg-white/10">
          {/* Metadados */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="free-exam-date" className="mb-1 block text-xs font-semibold text-slate-600">Data do Exame *</label>
              <input
                ref={examDateRef}
                id="free-exam-date"
                type="date"
                required
                max={today}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={examDate}
                onChange={e => { setExamDate(e.target.value); setErrorMsg('') }}
              />
            </div>
            <div>
              <label htmlFor="free-exam-lab" className="mb-1 block text-xs font-semibold text-slate-600">Laboratório</label>
              <input
                id="free-exam-lab"
                maxLength={120}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={labName}
                onChange={e => setLabName(e.target.value)}
                placeholder="Nome do laboratório"
              />
            </div>
          </div>

          {/* Zona Lead — Upload bloqueado */}
          <LeadGate
            title="Upload Automático de Exames"
            description="Envie PDFs, fotos ou imagens de exames e o sistema extrai os parâmetros automaticamente via IA. Crie uma conta gratuita para testar."
          />

          {/* Inserção Manual */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-700">Inserção Manual de Parâmetros</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Gratuito
                </span>
              </div>
              <span className="text-xs text-slate-400 dark:text-science-400">{params.filter(p => p.name && p.value).length} parâmetro(s)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left dark:border-white/10 dark:bg-white/5">
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Parâmetro</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Unidade</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ref Min</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ref Max</th>
                    <th className="w-10 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {params.map((p, i) => {
                    const suggestions = showSuggestions === i ? getSuggestions(p.name) : []
                    return (
                      <tr key={i} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.03]">
                        <td className="relative px-2 py-1.5">
                          <input
                            className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300 focus:ring-1 focus:ring-brand-100"
                            value={p.name}
                            maxLength={FREE_LAB_LIMITS.parameterName}
                            onChange={e => { updateParam(i, 'name', e.target.value); setShowSuggestions(i) }}
                            onFocus={() => setShowSuggestions(i)}
                            onBlur={(event) => {
                              if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
                                setShowSuggestions(null)
                              }
                            }}
                            aria-label={`Parâmetro ${i + 1}`}
                            placeholder="Ex: Creatinina"
                          />
                          {suggestions.length > 0 && (
                            <div className="absolute left-2 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#111827]">
                              {suggestions.map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-science-100 dark:hover:bg-white/5 dark:hover:text-gold-400"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => { updateParam(i, 'name', s); setShowSuggestions(null) }}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300"
                            value={p.value}
                            maxLength={FREE_LAB_LIMITS.parameterValue}
                            onChange={e => updateParam(i, 'value', e.target.value)}
                            aria-label={`Valor do parâmetro ${p.name || i + 1}`}
                            placeholder="0.0"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300"
                            value={p.unit}
                            maxLength={FREE_LAB_LIMITS.unit}
                            onChange={e => updateParam(i, 'unit', e.target.value)}
                            aria-label={`Unidade do parâmetro ${p.name || i + 1}`}
                            placeholder="mg/dL"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300"
                            value={p.refMin ?? ''}
                            maxLength={FREE_LAB_LIMITS.reference}
                            onChange={e => updateParam(i, 'refMin', e.target.value)}
                            aria-label={`Referência mínima do parâmetro ${p.name || i + 1}`}
                            placeholder="Min"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300"
                            value={p.refMax ?? ''}
                            maxLength={FREE_LAB_LIMITS.reference}
                            onChange={e => updateParam(i, 'refMax', e.target.value)}
                            aria-label={`Referência máxima do parâmetro ${p.name || i + 1}`}
                            placeholder="Max"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => removeParam(i)}
                            disabled={saving}
                            aria-label={`Remover parâmetro ${p.name || i + 1}`}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-science-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addParam}
              disabled={saving || params.length >= FREE_LAB_LIMITS.parametersPerExam}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-science-200 dark:hover:border-gold-400/30 dark:hover:bg-gold-400/5 dark:hover:text-gold-400"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Parâmetro
            </button>
          </div>

          {errorMsg && (
            <p id="free-exam-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {errorMsg}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !params.some(p => p.name.trim() && p.value.trim())}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Check className="h-4 w-4" /> {saving ? 'Salvando com proteção…' : 'Salvar Exame'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-science-100 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
