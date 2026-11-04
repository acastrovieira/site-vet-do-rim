'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestJsonMutation } from '@/lib/client-mutation'
import type { HemogramaKey } from '@/lib/lab/reference-values'
import type { ReviewedLocalItem } from '@/lib/lab/local-extraction/types'

export interface ManualExamFormProps {
  petId: string
  petSpecies?: string
}

interface ParameterDefinition {
  key: HemogramaKey
  label: string
  defaultUnit: string
}

interface ParameterCategory {
  id: string
  title: string
  description: string
  parameters: ParameterDefinition[]
}

const PARAMETER_CATEGORIES: ParameterCategory[] = [
  {
    id: 'bioquimica_renal',
    title: 'Bioquímica Renal e Eletrólitos',
    description: 'Marcadores principais para acompanhamento nefrológico e estadiamento IRIS.',
    parameters: [
      { key: 'creatinina', label: 'Creatinina', defaultUnit: 'mg/dL' },
      { key: 'ureia', label: 'Ureia', defaultUnit: 'mg/dL' },
      { key: 'fosforo', label: 'Fósforo', defaultUnit: 'mg/dL' },
      { key: 'potassio', label: 'Potássio', defaultUnit: 'mEq/L' },
      { key: 'sodio', label: 'Sódio', defaultUnit: 'mEq/L' },
      { key: 'albumina', label: 'Albumina', defaultUnit: 'g/dL' },
      { key: 'proteina_total', label: 'Proteína Total', defaultUnit: 'g/dL' },
    ],
  },
  {
    id: 'bioquimica_hepatica',
    title: 'Bioquímica Hepática',
    description: 'Enzimas hepáticas complementares.',
    parameters: [
      { key: 'alt_tgp', label: 'ALT / TGP', defaultUnit: 'U/L' },
      { key: 'ast_tgo', label: 'AST / TGO', defaultUnit: 'U/L' },
    ],
  },
  {
    id: 'serie_vermelha',
    title: 'Série Vermelha (Eritrograma)',
    description: 'Avaliação de anemia e índices hematimétricos.',
    parameters: [
      { key: 'hemacias', label: 'Hemácias', defaultUnit: 'milhões/µL' },
      { key: 'hemoglobina', label: 'Hemoglobina', defaultUnit: 'g/dL' },
      { key: 'hematocrito', label: 'Hematócrito', defaultUnit: '%' },
      { key: 'vcm', label: 'VCM', defaultUnit: 'fL' },
      { key: 'hcm', label: 'HCM', defaultUnit: 'pg' },
      { key: 'chcm', label: 'CHCM', defaultUnit: 'g/dL' },
      { key: 'rdw', label: 'RDW', defaultUnit: '%' },
    ],
  },
  {
    id: 'serie_branca',
    title: 'Série Branca (Leucograma)',
    description: 'Contagem global e diferencial de leucócitos.',
    parameters: [
      { key: 'leucocitos_totais', label: 'Leucócitos totais', defaultUnit: '/µL' },
      { key: 'neutrofilos_segmentados', label: 'Neutrófilos segmentados', defaultUnit: '/µL' },
      { key: 'neutrofilos_bastoes', label: 'Bastões', defaultUnit: '/µL' },
      { key: 'linfocitos', label: 'Linfócitos', defaultUnit: '/µL' },
      { key: 'monocitos', label: 'Monócitos', defaultUnit: '/µL' },
      { key: 'eosinofilos', label: 'Eosinófilos', defaultUnit: '/µL' },
      { key: 'basofilos', label: 'Basófilos', defaultUnit: '/µL' },
    ],
  },
  {
    id: 'plaquetas',
    title: 'Plaquetas',
    description: 'Contagem plaquetária e volume plaquetário médio.',
    parameters: [
      { key: 'plaquetas_contagem', label: 'Contagem', defaultUnit: '/µL' },
      { key: 'plaquetas_vpm', label: 'VPM', defaultUnit: 'fL' },
    ],
  },
]

interface ParameterInputState {
  value: string
  unit: string
  refMin: string
  refMax: string
}

function createInitialParamState(): Record<HemogramaKey, ParameterInputState> {
  const initial = {} as Record<HemogramaKey, ParameterInputState>
  for (const category of PARAMETER_CATEGORIES) {
    for (const param of category.parameters) {
      initial[param.key] = {
        value: '',
        unit: param.defaultUnit,
        refMin: '',
        refMax: '',
      }
    }
  }
  return initial
}

function parseNumericField(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return null
  if (!/^\d+(\.\d+)?$/.test(normalized)) return Number.NaN
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function ManualExamForm({ petId, petSpecies }: ManualExamFormProps) {
  const router = useRouter()
  const submitInFlightRef = useRef(false)

  const [isOpen, setIsOpen] = useState(false)
  const [collectionDate, setCollectionDate] = useState('')
  const [resultDate, setResultDate] = useState('')
  const [laboratory, setLaboratory] = useState('')
  const [paramState, setParamState] = useState<Record<HemogramaKey, ParameterInputState>>(createInitialParamState)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function updateParameter(key: HemogramaKey, field: keyof ParameterInputState, nextValue: string) {
    setParamState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: nextValue,
      },
    }))
  }

  function resetForm() {
    setCollectionDate('')
    setResultDate('')
    setLaboratory('')
    setParamState(createInitialParamState())
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitInFlightRef.current) return

    setErrorMessage(null)
    setSuccessMessage(null)

    if (!collectionDate.trim()) {
      setErrorMessage('Informe a data da coleta do exame.')
      return
    }

    if (resultDate.trim() && resultDate.trim() < collectionDate.trim()) {
      setErrorMessage('A data do resultado não pode ser anterior à data da coleta.')
      return
    }

    const items: ReviewedLocalItem[] = []

    for (const category of PARAMETER_CATEGORIES) {
      for (const param of category.parameters) {
        const entry = paramState[param.key]
        const rawVal = entry.value.trim()
        if (!rawVal) continue

        const numericValue = parseNumericField(rawVal)
        if (numericValue === null || Number.isNaN(numericValue) || numericValue < 0) {
          setErrorMessage(`Valor inválido para ${param.label}. Informe um número válido (ex: 1.8).`)
          return
        }

        const hasRefMin = entry.refMin.trim().length > 0
        const hasRefMax = entry.refMax.trim().length > 0

        let referenceMin: number | null = null
        let referenceMax: number | null = null
        let referenceText: string | null = null

        if (hasRefMin || hasRefMax) {
          if (!hasRefMin || !hasRefMax) {
            setErrorMessage(
              `Para ${param.label}, informe tanto a referência mínima quanto a máxima (ou deixe ambas em branco).`,
            )
            return
          }
          const parsedMin = parseNumericField(entry.refMin)
          const parsedMax = parseNumericField(entry.refMax)
          if (
            parsedMin === null
            || parsedMax === null
            || Number.isNaN(parsedMin)
            || Number.isNaN(parsedMax)
            || parsedMin < 0
            || parsedMax < 0
            || parsedMin > parsedMax
          ) {
            setErrorMessage(`Faixa de referência inválida para ${param.label}.`)
            return
          }
          referenceMin = parsedMin
          referenceMax = parsedMax
          referenceText = `${parsedMin} a ${parsedMax}`
        }

        items.push({
          key: param.key,
          value: numericValue,
          valueText: String(numericValue),
          unit: entry.unit.trim() || param.defaultUnit || null,
          referenceMin,
          referenceMax,
          referenceText,
          page: 0,
        })
      }
    }

    if (items.length === 0) {
      setErrorMessage('Preencha ao menos 1 parâmetro laboratorial antes de salvar.')
      return
    }

    submitInFlightRef.current = true
    setSubmitting(true)

    const payload = {
      collectionDate: collectionDate.trim(),
      resultDate: resultDate.trim() ? resultDate.trim() : null,
      laboratory: laboratory.trim() ? laboratory.trim() : null,
      items,
    }

    try {
      await requestJsonMutation(`/api/lab/pacientes/${petId}/exames-manuais`, payload)

      resetForm()
      setSuccessMessage(
        `${items.length} parâmetro${items.length === 1 ? '' : 's'} registrado${items.length === 1 ? '' : 's'} com sucesso na planilha evolutiva.`,
      )
      setIsOpen(false)
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar o lançamento manual.')
    } finally {
      submitInFlightRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-label="Lançamento manual de exame laboratorial"
      className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0F2244] dark:text-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Lançar Exame Manualmente (Sem PDF / Custo Zero IA)
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
            Digite valores diretamente na planilha evolutiva{petSpecies ? ` (${petSpecies})` : ''}, sem upload de arquivo e sem consumo de cota de IA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev)
            setErrorMessage(null)
          }}
          aria-expanded={isOpen}
          className="inline-flex items-center gap-2 rounded-lg border border-teal-600/30 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 dark:border-teal-400/30 dark:bg-teal-500/15 dark:text-teal-200 dark:hover:bg-teal-500/25"
        >
          {isOpen ? 'Fechar formulário manual' : '+ Lançar exame manual'}
        </button>
      </div>

      {successMessage && (
        <div
          role="status"
          className="mx-4 mb-4 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200 sm:mx-5"
        >
          {successMessage}
        </div>
      )}

      {isOpen && (
        <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4 dark:border-white/10 sm:p-5">
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-rose-500/30 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:bg-rose-500/15 dark:text-rose-200"
            >
              {errorMessage}
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="manual-exam-collection-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Data da coleta <span className="text-rose-500">*</span>
              </label>
              <input
                id="manual-exam-collection-date"
                type="date"
                required
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/15 dark:bg-slate-900/60 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="manual-exam-result-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Data do resultado (opcional)
              </label>
              <input
                id="manual-exam-result-date"
                type="date"
                value={resultDate}
                onChange={(e) => setResultDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/15 dark:bg-slate-900/60 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="manual-exam-laboratory"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Laboratório (opcional)
              </label>
              <input
                id="manual-exam-laboratory"
                type="text"
                maxLength={120}
                placeholder="Ex: LabVet Central"
                value={laboratory}
                onChange={(e) => setLaboratory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none dark:border-white/15 dark:bg-slate-900/60 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            {PARAMETER_CATEGORIES.map((category, categoryIndex) => (
              <details
                key={category.id}
                open={categoryIndex === 0}
                className="group rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-white/10 dark:bg-slate-900/40"
              >
                <summary className="cursor-pointer list-none font-medium text-slate-900 dark:text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold">{category.title}</span>
                      <p className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {category.description}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 transition group-open:rotate-180 dark:text-slate-400">
                      ▼
                    </span>
                  </div>
                </summary>

                <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {category.parameters.map((param) => {
                    const state = paramState[param.key]
                    return (
                      <div
                        key={param.key}
                        className="rounded-lg border border-slate-200/80 bg-white p-2.5 dark:border-white/10 dark:bg-[#0F2244]"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <label
                            htmlFor={`param-val-${param.key}`}
                            className="text-xs font-semibold text-slate-800 dark:text-slate-100"
                          >
                            {param.label}
                          </label>
                          <span className="text-[11px] text-slate-400 dark:text-slate-400">
                            {state.unit || param.defaultUnit}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            id={`param-val-${param.key}`}
                            type="text"
                            inputMode="decimal"
                            placeholder="Valor"
                            value={state.value}
                            onChange={(e) => updateParameter(param.key, 'value', e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/15 dark:bg-slate-900/70 dark:text-white"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Referência mínima de ${param.label}`}
                            placeholder="Ref. mín"
                            value={state.refMin}
                            onChange={(e) => updateParameter(param.key, 'refMin', e.target.value)}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Referência máxima de ${param.label}`}
                            placeholder="Ref. máx"
                            value={state.refMax}
                            onChange={(e) => updateParameter(param.key, 'refMax', e.target.value)}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                resetForm()
                setErrorMessage(null)
              }}
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              Limpar campos
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50"
            >
              {submitting ? 'Salvando lançamento...' : 'Salvar Exame Manual'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export default ManualExamForm
