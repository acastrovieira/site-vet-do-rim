'use client'

import { useRef, useState } from 'react'
import type { FreePatient, FreeLabExam } from '@/lib/lab-free/types'
import {
  deleteExam,
  FreeLabStorageError,
  getFreeLabMutationErrorCopy,
  getFreeLabSnapshot,
  isBlockingFreeLabStorageError,
} from '@/lib/lab-free/storage'
import { exportToPdf } from '@/lib/lab-free/pdf-export'
import { getParamCategory, CATEGORY_ORDER } from '@/lib/lab-free/categories'
import { Download, Trash2, TableIcon, Lock } from 'lucide-react'
import { useAccessibleDialog } from '@/hooks/useAccessibleDialog'
import { getLabReferenceStatus, type LabReferenceStatus } from '@/lib/lab-free/reference-status'

interface Props {
  patient: FreePatient
  exams: FreeLabExam[]
  revision: number
  onExamsChange: () => Promise<boolean>
  onStorageError: (error: unknown) => void
}

/**
 * Tabela evolutiva agrupada por categoria clínica.
 * Valores fora da referência em vermelho.
 * Exportação PDF gratuita, Excel bloqueado como premium.
 */
export function FreeEvolutionTable({ patient, exams, revision, onExamsChange, onStorageError }: Props) {
  const [exporting, setExporting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; revision: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [operationError, setOperationError] = useState('')
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const deleteDialogRef = useAccessibleDialog({
    open: pendingDelete !== null,
    onClose: () => { setPendingDelete(null); setOperationError('') },
    closeDisabled: deleting,
    initialFocusRef: deleteCancelRef,
    fallbackFocusRef: tableContainerRef,
  })

  async function handleExportPdf() {
    if (exporting) return
    setExporting(true)
    setOperationError('')
    try {
      const snapshot = await getFreeLabSnapshot()
      const currentPatient = snapshot.patients.find((item) => item.id === patient.id)
      if (!currentPatient) {
        setOperationError('Este paciente foi excluído em outra aba. O PDF não foi gerado.')
        await onExamsChange()
        return
      }
      await exportToPdf(
        currentPatient,
        snapshot.exams.filter((exam) => exam.patientId === patient.id),
      )
      if (snapshot.revision !== revision) await onExamsChange()
    } catch {
      setOperationError('Não foi possível gerar o PDF neste navegador. Nenhum exame foi alterado.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteExam() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      await deleteExam(pendingDelete.id, pendingDelete.revision)
      await onExamsChange()
      setPendingDelete(null)
      setOperationError('')
    } catch (error) {
      if (isBlockingFreeLabStorageError(error)) {
        setPendingDelete(null)
        onStorageError(error)
        return
      }
      const copy = getFreeLabMutationErrorCopy(error)
      if (error instanceof FreeLabStorageError && error.code === 'CONFLICT') {
        setPendingDelete(null)
        setOperationError(copy)
        await onExamsChange()
      } else {
        setOperationError(copy)
      }
    } finally {
      setDeleting(false)
    }
  }

  if (exams.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm dark:border-white/10 dark:bg-[#0F2244]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-emerald-50">
          <TableIcon className="h-6 w-6 text-brand-300" />
        </div>
        <p className="font-bold text-slate-600 dark:text-science-100">Nenhum exame laboratorial registrado</p>
        <p className="mt-1.5 text-sm text-slate-400 dark:text-science-400">Use o botão &ldquo;Adicionar Exame&rdquo; acima para começar.</p>
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

  function getReferenceStatus(exam: FreeLabExam, n: string): LabReferenceStatus {
    const p = exam.parameters.find(par => par.name === n)
    return p ? getLabReferenceStatus(p) : 'unavailable'
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-white">Planilha Evolutiva</h3>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-science-400">
            {exams.length} exame{exams.length !== 1 ? 's' : ''} · {allParams.length} parâmetro{allParams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-science-100"
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
            type="button"
            disabled
            className="inline-flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-science-500"
            title="Disponível no Lab Evolution Premium"
          >
            <Lock className="h-3 w-3" /> Excel
          </button>
        </div>
      </div>

      {operationError && !pendingDelete && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {operationError}
        </p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl shadow-sm" style={{ boxShadow: '0 0 0 1px rgba(15,31,69,.08), 0 4px 24px rgba(15,31,69,.06)' }}>
        <div
          ref={tableContainerRef}
          className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset"
          tabIndex={0}
          aria-label="Planilha evolutiva; deslize horizontalmente para consultar todas as datas"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Valores laboratoriais do paciente por parâmetro e data de exame</caption>
            <thead>
              <tr className="bg-gradient-to-r from-brand-500 to-brand-600">
                <th scope="col" className="sticky left-0 min-w-[180px] whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/80" style={{ background: 'linear-gradient(135deg, #1A2E5A 0%, #152245 100%)' }}>
                  Parâmetro
                </th>
                <th scope="col" className="min-w-[80px] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Unidade
                </th>
                {exams.map(e => (
                  <th scope="col" key={e.id} className="min-w-[110px] px-3 py-3">
                    <div className="text-center">
                      <div className="text-xs font-bold text-white">{e.examDate}</div>
                      {e.labName && <div className="mt-0.5 text-[10px] font-medium text-white/40">{e.labName}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPendingDelete({ id: e.id, revision }); setOperationError('') }}
                      className="mx-auto mt-1 inline-flex min-h-11 min-w-11 items-center justify-center text-white/40 transition-colors hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                      aria-label={`Excluir exame de ${e.examDate}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            {groupedParams.map(({ category, params }) => (
              <tbody key={category} className="bg-white dark:bg-[#0F2244]">
                <CategoryGroup
                  category={category}
                  params={params}
                  exams={exams}
                  getUnit={getUnit}
                  getValue={getValue}
                  getReferenceStatus={getReferenceStatus}
                />
              </tbody>
            ))}
          </table>
        </div>
      </div>

      {/* Legend */}
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-science-400">
        <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
        Valores com ponto vermelho estão fora do intervalo de referência informado.
      </p>

      {/* Delete Confirm */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="free-delete-exam-title"
            aria-describedby="free-delete-exam-description"
            tabIndex={-1}
            className="w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0F2244]"
          >
            <h3 id="free-delete-exam-title" className="mb-2 font-display text-lg font-bold text-slate-900 dark:text-white">Excluir exame?</h3>
            <p id="free-delete-exam-description" className="mb-5 text-sm text-slate-500 dark:text-science-200">Esta ação não pode ser desfeita.</p>
            {operationError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{operationError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { void handleDeleteExam() }}
                disabled={deleting}
                className="min-h-11 flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
              <button
                ref={deleteCancelRef}
                type="button"
                onClick={() => { setPendingDelete(null); setOperationError('') }}
                disabled={deleting}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-science-100 dark:hover:bg-white/5"
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
  category, params, exams, getUnit, getValue, getReferenceStatus,
}: {
  category: string
  params: string[]
  exams: FreeLabExam[]
  getUnit: (n: string) => string
  getValue: (exam: FreeLabExam, n: string) => string
  getReferenceStatus: (exam: FreeLabExam, n: string) => LabReferenceStatus
}) {
  return (
    <>
      <tr>
        <th
          scope="rowgroup"
          colSpan={exams.length + 2}
          className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-science-400"
        >
          {category}
        </th>
      </tr>
      {params.map((param, i) => (
        <tr
          key={param}
          className={`group transition-colors duration-100 ${
            i % 2 === 0 ? 'bg-white dark:bg-[#0F2244]' : 'bg-slate-50 dark:bg-white/[0.03]'
          }`}
        >
          <th
            scope="row"
            className={`sticky left-0 whitespace-nowrap border-r border-slate-100/80 px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:border-white/10 dark:text-science-100 ${
              i % 2 === 0 ? 'bg-white dark:bg-[#0F2244]' : 'bg-slate-50 dark:bg-[#13284d]'
            }`}
          >
            {param}
          </th>
          <td className="px-3 py-2.5 text-xs font-medium text-slate-400 dark:text-science-400">{getUnit(param)}</td>
          {exams.map(e => {
            const val = getValue(e, param)
            const referenceStatus = val === '—' ? 'unavailable' : getReferenceStatus(e, param)
            const bad = referenceStatus === 'abnormal'
            return (
              <td
                key={e.id}
                className={`px-3 py-2.5 text-center text-[13px] font-semibold transition-colors ${
                  val === '—'
                    ? 'text-slate-200 dark:text-science-700'
                    : bad
                      ? 'bg-red-50/70 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                      : 'text-slate-800 dark:text-science-100'
                }`}
              >
                {bad && <span className="mb-0.5 mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />}
                {val}
                {val !== '—' && (
                  <span className="sr-only">
                    {referenceStatus === 'abnormal'
                      ? ', fora do intervalo de referência'
                      : referenceStatus === 'normal'
                        ? ', dentro do intervalo de referência informado'
                        : ', intervalo de referência não informado ou inválido'}
                  </span>
                )}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
