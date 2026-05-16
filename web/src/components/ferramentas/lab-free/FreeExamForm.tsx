'use client'

import { useState } from 'react'
import type { FreeLabExam, LabParameter } from '@/lib/lab-free/types'
import { KNOWN_PARAMETERS } from '@/lib/lab-free/types'
import { saveExam } from '@/lib/lab-free/storage'
import { generateId } from '@/lib/lab-free/id'
import { FileText, X, Plus, Check, Trash2 } from 'lucide-react'
import { LeadGate } from './LeadGate'

interface Props {
  patientId: string
  onSaved: () => void
  onCancel: () => void
}

/**
 * Modal de inserção manual de exame laboratorial.
 * Modo file/OCR bloqueado exigindo cadastro.
 */
export function FreeExamForm({ patientId, onSaved, onCancel }: Props) {
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10))
  const [labName, setLabName] = useState('')
  const [params, setParams] = useState<LabParameter[]>([
    { name: '', value: '', unit: '' },
  ])
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null)

  function updateParam(idx: number, field: keyof LabParameter, value: string) {
    setParams(ps => ps.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  function removeParam(idx: number) {
    setParams(ps => ps.filter((_, i) => i !== idx))
  }

  function addParam() {
    setParams(ps => [...ps, { name: '', value: '', unit: '' }])
  }

  function getSuggestions(query: string): string[] {
    if (!query.trim()) return []
    const lower = query.toLowerCase()
    return KNOWN_PARAMETERS.filter(p =>
      p.toLowerCase().includes(lower) && !params.some(existing => existing.name === p)
    ).slice(0, 6)
  }

  function handleSave() {
    const validParams = params.filter(p => p.name.trim() && p.value.trim())
    if (validParams.length === 0) return

    const exam: FreeLabExam = {
      id: generateId('EXAM'),
      patientId,
      examDate,
      labName,
      parameters: validParams,
      createdAt: new Date().toISOString(),
    }
    saveExam(exam)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl animate-fade-up rounded-2xl border border-slate-100 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
              <FileText className="h-4 w-4 text-brand-500" />
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900">Adicionar Exame Laboratorial</h2>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Metadados */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Data do Exame *</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-300 focus:bg-white"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Laboratório</label>
              <input
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
              <span className="text-xs text-slate-400">{params.filter(p => p.name && p.value).length} parâmetro(s)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Parâmetro</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Unidade</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ref Min</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ref Max</th>
                    <th className="w-10 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {params.map((p, i) => {
                    const suggestions = showSuggestions === i ? getSuggestions(p.name) : []
                    return (
                      <tr key={i} className="group transition-colors hover:bg-slate-50/50">
                        <td className="relative px-2 py-1.5">
                          <input
                            className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300 focus:ring-1 focus:ring-brand-100"
                            value={p.name}
                            onChange={e => { updateParam(i, 'name', e.target.value); setShowSuggestions(i) }}
                            onFocus={() => setShowSuggestions(i)}
                            onBlur={() => setTimeout(() => setShowSuggestions(null), 200)}
                            placeholder="Ex: Creatinina"
                          />
                          {suggestions.length > 0 && (
                            <div className="absolute left-2 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                              {suggestions.map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                                  onMouseDown={() => { updateParam(i, 'name', s); setShowSuggestions(null) }}
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
                            onChange={e => updateParam(i, 'value', e.target.value)}
                            placeholder="0.0"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300"
                            value={p.unit}
                            onChange={e => updateParam(i, 'unit', e.target.value)}
                            placeholder="mg/dL"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300"
                            value={p.refMin ?? ''}
                            onChange={e => updateParam(i, 'refMin', e.target.value)}
                            placeholder="Min"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-300"
                            value={p.refMax ?? ''}
                            onChange={e => updateParam(i, 'refMax', e.target.value)}
                            placeholder="Max"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => removeParam(i)}
                            className="rounded-lg p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
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
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Parâmetro
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={!params.some(p => p.name.trim() && p.value.trim())}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Check className="h-4 w-4" /> Salvar Exame
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
