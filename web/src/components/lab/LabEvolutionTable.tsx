'use client'

import { useMemo, useState } from 'react'
import type { EvolutionDataPoint, LaudoRow } from '@/lib/lab/transform-laudo-data'
import {
  transformLaudosToEvolution,
  detectTrend,
  formatLabValue,
  resolveLaudoChronology,
  sortLaudosChronologically,
} from '@/lib/lab/transform-laudo-data'
import { observationsHaveComparableUnits } from '@/lib/lab/canonical-observation'
import { LOCAL_PARAMETER_CATALOG } from '@/lib/lab/local-extraction/parameter-catalog'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react'

interface Props {
  laudos: LaudoRow[]
  especie: string
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Bioquímica Renal': '🧪',
  'Série Vermelha': '🔴',
  'Série Branca': '⚪',
  'Plaquetas': '💊',
  'Bioquímica Hepática': '🟡',
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'subindo':
      return <><TrendingUp className="h-3 w-3 text-amber-500" aria-hidden /><span className="sr-only">Subindo</span></>
    case 'descendo':
      return <><TrendingDown className="h-3 w-3 text-blue-500" aria-hidden /><span className="sr-only">Descendo</span></>
    case 'estavel':
      return <><Minus className="h-3 w-3 text-green-500" aria-hidden /><span className="sr-only">Estável</span></>
    default:
      return null
  }
}

/**
 * Tabela evolutiva de parâmetros laboratoriais para a área logada (Lab Evolution).
 * Exibe dados extraídos por IA opcional ou pelo fluxo local revisado.
 * No fluxo local, a faixa impressa no próprio laudo prevalece; ausências não
 * recebem classificação clínica automática.
 * Inclui indicadores de tendência (subindo/descendo/estável).
 */
export function LabEvolutionTable({ laudos, especie }: Props) {
  void especie
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const groups = useMemo(
    () => transformLaudosToEvolution(laudos, especie),
    [laudos, especie],
  )

  // Datas (colunas) — laudos concluídos ordenados cronologicamente
  const validLaudos = useMemo(
    () =>
      sortLaudosChronologically(
        laudos.filter((l) => l.status === 'concluido' && l.resultado_ia),
      ),
    [laudos],
  )

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-emerald-50">
          <Activity className="h-6 w-6 text-brand-300" />
        </div>
        <p className="font-bold text-slate-600 dark:text-science-100">Nenhum exame estruturado ainda</p>
        <p className="mt-1.5 text-sm text-slate-400 dark:text-science-400">
          Envie um laudo e extraia os valores gratuitamente no dispositivo para gerar a tabela evolutiva.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-500" />
            Evolução Laboratorial
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-science-400">
            {validLaudos.length} exame{validLaudos.length !== 1 ? 's' : ''} estruturado{validLaudos.length !== 1 ? 's' : ''}
            {' · '}
            Faixa impressa no laudo quando completa; registros sem evidência permanecem sem classificação
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div
        className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm dark:border-white/10"
        style={{ boxShadow: '0 0 0 1px rgba(15,31,69,.08), 0 4px 24px rgba(15,31,69,.06)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Evolução dos parâmetros laboratoriais do paciente ao longo dos exames analisados.
            </caption>
            {/* Header com datas */}
            <thead>
              <tr className="bg-gradient-to-r from-brand-500 to-brand-600">
                <th
                  className="sticky left-0 z-10 min-w-[180px] whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/80"
                  style={{ background: 'linear-gradient(135deg, #1A2E5A 0%, #152245 100%)' }}
                >
                  Parâmetro
                </th>
                <th className="min-w-[70px] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Unidade
                </th>
                <th className="min-w-[80px] px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Ref.
                </th>
                {validLaudos.map((laudo) => {
                  const chronology = resolveLaudoChronology(laudo)
                  const lab = laudo.resultado_ia?.laboratorio
                  return (
                    <th key={laudo.id} className="min-w-[100px] px-3 py-3">
                      <div className="text-center">
                        <div className="text-xs font-bold text-white">{chronology.displayDate}</div>
                        {chronology.source !== 'collection' && (
                          <div className="mt-0.5 text-[9px] font-medium text-amber-200/80">
                            {chronology.source === 'upload' ? 'data do upload' : 'data indisponível'}
                          </div>
                        )}
                        {lab && (
                          <div className="mt-0.5 text-[10px] font-medium text-white/40 truncate max-w-[90px]">
                            {lab}
                          </div>
                        )}
                      </div>
                    </th>
                  )
                })}
                <th className="min-w-[50px] px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Tend.
                </th>
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-[#0F2244]">
              {groups.map(({ category, rows }) => {
                const isCollapsed = collapsedCategories.has(category)
                return (
                  <CategorySection
                    key={category}
                    category={category}
                    rows={rows}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleCategory(category)}
                    totalColumns={validLaudos.length}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 dark:text-science-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          Acima da referência
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          Abaixo da referência
        </span>
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-amber-500" />
          Subindo
        </span>
        <span className="flex items-center gap-1.5">
          <TrendingDown className="h-3 w-3 text-blue-500" />
          Descendo
        </span>
        <span className="flex items-center gap-1.5">
          <Minus className="h-3 w-3 text-green-500" />
          Estável
        </span>
      </div>
    </div>
  )
}

// ── Seção de categoria ──────────────────────────────────────────────────

interface CategorySectionProps {
  category: string
  rows: EvolutionDataPoint[]
  isCollapsed: boolean
  onToggle: () => void
  totalColumns: number
}

function CategorySection({
  category, rows, isCollapsed, onToggle, totalColumns,
}: CategorySectionProps) {
  return (
    <>
      {/* Category header */}
      <tr>
        <td
          colSpan={totalColumns + 4}
          className="border-t border-slate-100 bg-slate-50/70 p-0 dark:border-white/10 dark:bg-white/5"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
          >
            <span className="text-sm">{CATEGORY_EMOJI[category] ?? '📋'}</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-science-200">
              {category}
            </span>
            {isCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span className="text-[10px] text-slate-300 dark:text-science-500 ml-auto">
              {rows.length} parâmetro{rows.length !== 1 ? 's' : ''}
            </span>
          </button>
        </td>
      </tr>

      {/* Parameter rows */}
      {!isCollapsed &&
        rows.map((row, i) => {
          const parameterLabel = LOCAL_PARAMETER_CATALOG.find(
            (parameter) => parameter.key === row.key,
          )?.label ?? row.key
          const laboratoryUnits = new Set(
            row.values
              .filter((value) => value.unit)
              .map((value) => value.unit),
          )
          const hasLaboratoryReference = row.values.some(
            (value) => value.referenceSource === 'laboratory'
              && value.referenceMin !== null
              && value.referenceMax !== null,
          )
          const unitLabel = laboratoryUnits.size === 1
            ? [...laboratoryUnits][0]
            : laboratoryUnits.size > 1
              ? 'varia'
              : '—'
          const trend = observationsHaveComparableUnits(row.values)
            ? detectTrend(row.values)
            : 'insuficiente'
          const rowBackground = i % 2 === 0
            ? 'bg-white dark:bg-transparent'
            : 'bg-slate-50 dark:bg-white/[0.03]'

          return (
            <tr
              key={row.key}
              className={`group transition-colors duration-100 ${rowBackground}`}
            >
              {/* Nome do parâmetro */}
              <td
                className={`sticky left-0 z-10 whitespace-nowrap border-r border-slate-100/80 px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:border-white/10 dark:text-science-100 ${rowBackground}`}
              >
                {parameterLabel}
              </td>

              {/* Unidade */}
              <td className="px-3 py-2.5 text-xs font-medium text-slate-400 dark:text-science-400">
                {unitLabel}
              </td>

              {/* Referência */}
              <td className="px-3 py-2.5 text-center text-[11px] text-slate-300 dark:text-science-500">
                {hasLaboratoryReference ? 'por laudo' : '—'}
              </td>

              {/* Valores por data */}
              {row.values.map((v) => {
                const isAbove = v.referenceStatus === 'above'
                const isBelow = v.referenceStatus === 'below'
                const isAbnormal = isAbove || isBelow

                return (
                  <td
                    key={v.laudoId}
                    className={`px-3 py-2.5 text-center text-[13px] font-semibold transition-colors ${
                      v.value === null
                        ? 'text-slate-200 dark:text-science-700'
                        : isAbove
                        ? 'bg-red-50/70 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                        : isBelow
                        ? 'bg-blue-50/70 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                        : 'text-slate-800 dark:text-white'
                    }`}
                  >
                    {isAbnormal && (
                      <>
                        <span
                          className={`mb-0.5 mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                            isAbove ? 'bg-red-400' : 'bg-blue-400'
                          }`}
                          aria-hidden
                        />
                        <span className="sr-only">{isAbove ? 'Acima da referência: ' : 'Abaixo da referência: '}</span>
                      </>
                    )}
                    {formatLabValue(v.value)}
                  </td>
                )
              })}

              {/* Tendência */}
              <td className="px-2 py-2.5 text-center">
                <TrendIcon trend={trend} />
              </td>
            </tr>
          )
        })}
    </>
  )
}
