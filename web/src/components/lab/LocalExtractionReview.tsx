'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  CircleStop,
  Cpu,
  Loader2,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import type { ResultadoIA } from '@/lib/lab/transform-laudo-data'
import { LOCAL_PARAMETER_CATALOG } from '@/lib/lab/local-extraction/parameter-catalog'
import { extractLocalDraftFromPdf } from '@/lib/lab/local-extraction/pdf-extractor.client'
import type { LocalPdfExtractionProgress } from '@/lib/lab/local-extraction/pdf-extractor.client'
import type {
  LocalExtractedItem,
  LocalExtractionDraft,
} from '@/lib/lab/local-extraction/types'

interface Props {
  file: File
  laudoId: string | null
  disabled?: boolean
  onSaved: (result: ResultadoIA) => void
}

function parseEditableNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^[+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(trimmed)) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000_000 ? parsed : null
}

function optionalEditableNumber(value: string) {
  return value.trim() ? parseEditableNumber(value) : null
}

function confidenceLabel(item: LocalExtractedItem) {
  if (item.confidence === 'high') return 'Boa leitura'
  if (item.confidence === 'medium') return 'Conferir'
  return 'Revisão necessária'
}

export function LocalExtractionReview({ file, laudoId, disabled = false, onSaved }: Props) {
  const [draft, setDraft] = useState<LocalExtractionDraft | null>(null)
  const [progress, setProgress] = useState<LocalPdfExtractionProgress | null>(null)
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'review' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [manualKey, setManualKey] = useState(LOCAL_PARAMETER_CATALOG[0].key)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const selectedItems = useMemo(
    () => draft?.items.filter((item) => item.selected && item.value !== null) ?? [],
    [draft],
  )
  const duplicateSelected = new Set(selectedItems.map((item) => item.key)).size !== selectedItems.length

  function updateItem(id: string, updater: (item: LocalExtractedItem) => LocalExtractedItem) {
    setDraft((current) => current
      ? { ...current, items: current.items.map((item) => item.id === id ? updater(item) : item) }
      : current)
    setConfirmed(false)
  }

  async function extract() {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setPhase('extracting')
    setError(null)
    setConfirmed(false)

    try {
      const extracted = await extractLocalDraftFromPdf(file, {
        signal: controller.signal,
        onProgress: setProgress,
      })
      setDraft(extracted)
      setPhase('review')
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setPhase('idle')
        setError('Extração cancelada. O PDF não foi alterado.')
      } else {
        setPhase('error')
        setError(reason instanceof Error ? reason.message : 'Não foi possível ler o PDF localmente.')
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  function cancelExtraction() {
    controllerRef.current?.abort()
  }

  function addManualItem() {
    if (!draft) return
    const definition = LOCAL_PARAMETER_CATALOG.find((item) => item.key === manualKey)
    if (!definition) return
    const item: LocalExtractedItem = {
      id: `manual-${definition.key}-${crypto.randomUUID()}`,
      key: definition.key,
      label: definition.label,
      value: null,
      valueText: '',
      qualifier: null,
      unit: null,
      referenceMin: null,
      referenceMax: null,
      referenceMinText: '',
      referenceMaxText: '',
      referenceText: null,
      rawLine: 'Adicionado manualmente',
      page: 0,
      confidence: 'low',
      flags: ['manual'],
      selected: false,
    }
    setDraft({ ...draft, items: [...draft.items, item] })
    setConfirmed(false)
  }

  async function saveReviewedResults() {
    if (!draft || !laudoId || !confirmed || selectedItems.length === 0 || duplicateSelected) return
    setPhase('saving')
    setError(null)

    try {
      const response = await fetch(`/api/laudos/${laudoId}/results-local`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            key: item.key,
            value: item.value,
            valueText: item.valueText,
            unit: item.unit,
            referenceMin: item.referenceMin,
            referenceMax: item.referenceMax,
            referenceText: item.referenceText,
            page: item.page,
          })),
          laboratory: draft.metadata.laboratory,
          collectionDate: draft.metadata.collectionDate,
          resultDate: draft.metadata.resultDate,
          source: draft.source,
        }),
      })
      const body = await response.json().catch(() => null) as {
        ok?: boolean
        error?: string
        data?: ResultadoIA
      } | null
      if (!response.ok || !body?.ok || !body.data) {
        throw new Error(body?.error ?? 'Não foi possível salvar os valores revisados.')
      }
      setPhase('saved')
      onSaved(body.data)
    } catch (reason) {
      setPhase('review')
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar os valores revisados.')
    }
  }

  if (phase === 'saved') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10" role="status">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Resultados salvos sem API paga</p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Os valores conferidos já podem aparecer na evolução e na exportação.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5" aria-labelledby="local-extraction-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/15">
          <Cpu className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden />
        </div>
        <div>
          <h3 id="local-extraction-title" className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Extração gratuita no dispositivo</h3>
          <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
            Sem OpenAI ou Gemini. O texto é processado neste navegador; você confere cada número antes de salvar.
          </p>
        </div>
      </div>

      {(phase === 'idle' || phase === 'error') && (
        <button
          type="button"
          onClick={() => void extract()}
          disabled={disabled}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Cpu className="h-4 w-4" aria-hidden />
          Extrair parâmetros gratuitamente
        </button>
      )}

      {phase === 'extracting' && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-500/20 dark:bg-white/5">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-science-100">
              {progress?.message ?? 'Preparando extração local…'}
            </p>
            <button type="button" onClick={cancelExtraction} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-science-200 dark:hover:bg-white/10">
              <CircleStop className="h-4 w-4" aria-hidden />
              Cancelar
            </button>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Em PDFs escaneados, o OCR pode demorar mais em celulares e tablets.</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {draft && (phase === 'review' || phase === 'saving') && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-white p-3 text-xs text-slate-600 dark:border-emerald-500/20 dark:bg-white/5 dark:text-science-200">
            <p className="font-semibold text-slate-800 dark:text-white">
              {draft.items.length} leitura{draft.items.length === 1 ? '' : 's'} encontrada{draft.items.length === 1 ? '' : 's'} · {draft.source === 'ocr' ? 'OCR local' : 'texto do PDF'}
            </p>
            {draft.warnings.map((warning) => <p key={warning} className="mt-1 text-amber-700 dark:text-amber-300">{warning}</p>)}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-science-200 sm:col-span-1">
              Laboratório
              <input
                value={draft.metadata.laboratory ?? ''}
                onChange={(event) => {
                  setDraft({ ...draft, metadata: { ...draft.metadata, laboratory: event.target.value.slice(0, 120) || null } })
                  setConfirmed(false)
                }}
                maxLength={120}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0F2244] dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-science-200">
              Data da coleta
              <input
                type="date"
                value={draft.metadata.collectionDate ?? ''}
                onChange={(event) => {
                  setDraft({ ...draft, metadata: { ...draft.metadata, collectionDate: event.target.value || null } })
                  setConfirmed(false)
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0F2244] dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-science-200">
              Data do resultado
              <input
                type="date"
                value={draft.metadata.resultDate ?? ''}
                onChange={(event) => {
                  setDraft({ ...draft, metadata: { ...draft.metadata, resultDate: event.target.value || null } })
                  setConfirmed(false)
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0F2244] dark:text-white"
              />
            </label>
          </div>

          <div className="space-y-3">
            {draft.items.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0F2244]">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Incluir ${item.label}`}
                    checked={item.selected}
                    disabled={item.value === null}
                    onChange={(event) => updateItem(item.id, (current) => ({ ...current, selected: event.target.checked }))}
                    className="mt-1 h-5 w-5 shrink-0 accent-emerald-700"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.confidence === 'high'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : item.confidence === 'medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
                      }`}>{confidenceLabel(item)}</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-400" title={item.rawLine}>{item.rawLine}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-science-300">
                        Valor
                        <input
                          value={item.valueText}
                          inputMode="decimal"
                          onChange={(event) => {
                            const valueText = event.target.value.slice(0, 24)
                            const value = parseEditableNumber(valueText)
                            updateItem(item.id, (current) => ({
                              ...current,
                              valueText,
                              value,
                              selected: value !== null ? current.selected : false,
                              flags: current.flags.filter((flag) => flag !== 'ambiguous_number' && flag !== 'qualified_value'),
                            }))
                          }}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-science-300">
                        Unidade
                        <input
                          value={item.unit ?? ''}
                          onChange={(event) => updateItem(item.id, (current) => ({ ...current, unit: event.target.value.slice(0, 32) || null }))}
                          maxLength={32}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-science-300">
                        Ref. mínima
                        <input
                          value={item.referenceMinText}
                          inputMode="decimal"
                          onChange={(event) => {
                            const referenceMinText = event.target.value.slice(0, 24)
                            updateItem(item.id, (current) => ({
                              ...current,
                              referenceMinText,
                              referenceMin: optionalEditableNumber(referenceMinText),
                              referenceText: referenceMinText.trim() && current.referenceMaxText.trim()
                                ? `${referenceMinText.trim()} - ${current.referenceMaxText.trim()}`
                                : null,
                            }))
                          }}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-science-300">
                        Ref. máxima
                        <input
                          value={item.referenceMaxText}
                          inputMode="decimal"
                          onChange={(event) => {
                            const referenceMaxText = event.target.value.slice(0, 24)
                            updateItem(item.id, (current) => ({
                              ...current,
                              referenceMaxText,
                              referenceMax: optionalEditableNumber(referenceMaxText),
                              referenceText: current.referenceMinText.trim() && referenceMaxText.trim()
                                ? `${current.referenceMinText.trim()} - ${referenceMaxText.trim()}`
                                : null,
                            }))
                          }}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={manualKey}
              onChange={(event) => setManualKey(event.target.value as typeof manualKey)}
              className="min-h-11 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0F2244] dark:text-white"
              aria-label="Parâmetro para adicionar manualmente"
            >
              {LOCAL_PARAMETER_CATALOG.map((parameter) => (
                <option key={parameter.key} value={parameter.key}>{parameter.label}</option>
              ))}
            </select>
            <button type="button" onClick={addManualItem} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-science-100">
              <Plus className="h-4 w-4" aria-hidden />
              Adicionar manualmente
            </button>
          </div>

          {duplicateSelected && (
            <p className="text-xs font-semibold text-red-700 dark:text-red-300" role="alert">Mantenha apenas um valor selecionado para cada parâmetro.</p>
          )}

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-science-100">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700" />
            <span>Conferi os parâmetros selecionados, os números, as unidades e as faixas comparando com o PDF original.</span>
          </label>

          {!laudoId && (
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
              Revisão pronta. Use “Enviar PDF ao histórico” acima; depois salve estes valores sem precisar repetir a extração.
            </p>
          )}

          <button
            type="button"
            onClick={() => void saveReviewedResults()}
            disabled={disabled || phase === 'saving' || !laudoId || !confirmed || selectedItems.length === 0 || duplicateSelected}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            Salvar valores conferidos e gerar tabela
          </button>
        </div>
      )}
    </section>
  )
}
