'use client'

import { useState } from 'react'
import type { FreePatient, FreeLabExam } from '@/lib/lab-free/types'
import { deleteExam } from '@/lib/lab-free/storage'
import { exportToPdf } from '@/lib/lab-free/pdf-export'
import { getParamCategory, CATEGORY_ORDER } from '@/lib/lab-free/categories'
import { Download, Trash2, TableIcon, Lock } from 'lucide-react'

interface Props {
  patient: FreePatient
  exams: FreeLabExam[]
  onExamsChange: () => void
}

/**
 * Tabela evolutiva agrupada por categoria clínica.
 * Valores fora da referência em vermelho.
 * Exportação PDF gratuita, Excel bloqueado como premium.
 */
export function FreeEvolutionTable({ patient, exams, onExamsChange }: Props) {
  const [exporting, setExporting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function handleExportPdf() {
    if (exporting) return
    setExporting(true)
    try {
      await exportToPdf(patient, exams)
    } finally {
      setExporting(false)
    }
  }

  if (exams.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-emerald-50">
          <TableIcon className="h-6 w-6 text-brand-300" />
        </div>
        <p className="font-bold text-slate-600">Nenhum exame laboratorial registrado</p>
        <p className="mt-1.5 text-sm text-slate-400">Use o botão &ldquo;Adicionar Exame&rdquo; acima para começar.</p>
      </div>
    )
  }

  const allParams = Array.from(new Set(exams.flatMap(e => e.parameters.map(p => p.name)))).sort()
  const groupedParams = CATEGORY_ORDER.map(cat => ({
    category: cat,
    params: allParams.filter(n => getParamCategory(n) === cat),
  })).filter(g => g.params.length > 0)

  function getUnit(n: string) {
    for (const exam of exams) {
      const p = exam.parameters.find(par => par.name === n)
      if (p?.unit) return p.unit
    }
    return ''
  }

  function getValue(exam: FreeLabExam, n: string) {
    return exam.parameters.find(p => p.name === n)?.value ?? '—'
  }

  function isAbnormal(exam: FreeLabExam, n: string) {
    const p = exam.parameters.find(par => par.name === n)
    if (!p?.refMin || !p?.refMax) return false
    const v = parseFloat(p.value)
    const mn = parseFloat(p.refMin)
    const mx = parseFloat(p.refMax)
    return !isNaN(v) && !isNaN(mn) && !isNaN(mx) && (v < mn || v > mx)
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Planilha Evolutiva</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {exams.length} exame{exams.length !== 1 ? 's' : ''} · {allParams.length} parâmetro{allParams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
          >
            {exporting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" /> Exportar PDF
              </>
            )}
          </button>
          <button
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"
            title="Disponível no Lab Evolution Premium"
          >
            <Lock className="h-3 w-3" /> Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl shadow-sm" style={{ boxShadow: '0 0 0 1px rgba(15,31,69,.08), 0 4px 24px rgba(15,31,69,.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-brand-500 to-brand-600">
                <th className="sticky left-0 min-w-[180px] whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/80" style={{ background: 'linear-gradient(135deg, #1A2E5A 0%, #152245 100%)' }}>
                  Parâmetro
                </th>
                <th className="min-w-[80px] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Unidade
                </th>
                {exams.map(e => (
                  <th key={e.id} className="min-w-[110px] px-3 py-3">
                    <div className="text-center">
                      <div className="text-xs font-bold text-white">{e.examDate}</div>
                      {e.labName && <div className="mt-0.5 text-[10px] font-medium text-white/40">{e.labName}</div>}
                    </div>
                    <button
                      onClick={() => setPendingDeleteId(e.id)}
                      className="mx-auto mt-1 flex p-1 text-white/20 transition-colors hover:text-red-300"
                      aria-label={`Excluir exame de ${e.examDate}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {groupedParams.map(({ category, params }) => (
                <CategoryGroup
                  key={category}
                  category={category}
                  params={params}
                  exams={exams}
                  getUnit={getUnit}
                  getValue={getValue}
                  isAbnormal={isAbnormal}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
        Valores com ponto vermelho estão fora do intervalo de referência informado.
      </p>

      {/* Delete Confirm */}
      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 font-display text-lg font-bold text-slate-900">Excluir exame?</h3>
            <p className="mb-5 text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { deleteExam(pendingDeleteId); onExamsChange(); setPendingDeleteId(null) }}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600"
              >
                Excluir
              </button>
              <button
                onClick={() => setPendingDeleteId(null)}
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

function CategoryGroup({
  category, params, exams, getUnit, getValue, isAbnormal,
}: {
  category: string
  params: string[]
  exams: FreeLabExam[]
  getUnit: (n: string) => string
  getValue: (exam: FreeLabExam, n: string) => string
  isAbnormal: (exam: FreeLabExam, n: string) => boolean
}) {
  return (
    <>
      <tr>
        <td
          colSpan={exams.length + 2}
          className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"
          style={{ background: 'rgba(15,31,69,.03)', borderTop: '1px solid rgba(15,31,69,.06)' }}
        >
          {category}
        </td>
      </tr>
      {params.map((param, i) => (
        <tr key={param} className="group transition-colors duration-100" style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
          <td
            className="sticky left-0 whitespace-nowrap border-r border-slate-100/80 px-4 py-2.5 text-[13px] font-semibold text-slate-700"
            style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}
          >
            {param}
          </td>
          <td className="px-3 py-2.5 text-xs font-medium text-slate-400">{getUnit(param)}</td>
          {exams.map(e => {
            const val = getValue(e, param)
            const bad = val !== '—' && isAbnormal(e, param)
            return (
              <td
                key={e.id}
                className={`px-3 py-2.5 text-center text-[13px] font-semibold transition-colors ${
                  val === '—' ? 'text-slate-200' : bad ? 'text-red-600' : 'text-slate-800'
                }`}
                style={bad ? { background: 'rgba(254,242,242,.7)' } : {}}
              >
                {bad && <span className="mb-0.5 mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />}
                {val}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
