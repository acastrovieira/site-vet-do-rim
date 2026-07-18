'use client'

import { useState, useMemo } from 'react'
import type { FreeLabExam } from '@/lib/lab-free/types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useTheme } from 'next-themes'
import { parseLabNumber } from '@/lib/lab-free/reference-status'

interface Props {
  exams: FreeLabExam[]
}

const LIGHT_PALETTE = ['#1A2E5A', '#0d9488', '#8E7020', '#dc2626', '#7c3aed', '#db2777', '#0f766e', '#ea580c']
const DARK_PALETTE = ['#7DC4F9', '#5eead4', '#D8C8A4', '#fca5a5', '#c4b5fd', '#f9a8d4', '#2dd4bf', '#fdba74']

/**
 * Wrapper que remonta o componente interno quando allParams muda.
 * Isso evita useEffect + setState e refs durante render.
 */
export function FreeChartsView({ exams }: Props) {
  const allParams = useMemo(() => {
    const s = new Set<string>()
    exams.forEach(e =>
      e.parameters.forEach(p => {
        if (parseLabNumber(p.value) !== null) s.add(p.name)
      })
    )
    return Array.from(s).sort()
  }, [exams])

  // key based on allParams content forces re-mount when params change
  const paramsKey = allParams.join(',')

  return <FreeChartsViewInner key={paramsKey} exams={exams} allParams={allParams} />
}

function FreeChartsViewInner({ exams, allParams }: { exams: FreeLabExam[]; allParams: string[] }) {
  const [selected, setSelected] = useState<string[]>(allParams.slice(0, 3))
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE
  const gridColor = isDark ? 'rgba(172,197,231,0.14)' : '#e2e8f0'
  const axisColor = isDark ? '#7A9BC8' : '#64748b'
  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${isDark ? 'rgba(200,169,122,0.2)' : '#e2e8f0'}`,
    backgroundColor: isDark ? '#0F2244' : '#ffffff',
    color: isDark ? '#D5E2F3' : '#1e293b',
    fontSize: 12,
  }

  const chartData = useMemo(
    () =>
      exams.map(exam => {
        const pt: Record<string, string | number> = { date: exam.examDate }
        for (const param of selected) {
          const p = exam.parameters.find(par => par.name === param)
          if (p) {
            const v = parseLabNumber(p.value)
            if (v !== null) pt[param] = v
          }
        }
        return pt
      }),
    [exams, selected]
  )

  const refMap = useMemo(() => {
    const map = new Map<string, { min?: number; max?: number }>()
    for (const exam of exams) {
      for (const p of exam.parameters) {
        if (!map.has(p.name) && (p.refMin || p.refMax)) {
          const minimum = parseLabNumber(p.refMin)
          const maximum = parseLabNumber(p.refMax)
          if (minimum !== null || maximum !== null) {
            map.set(p.name, {
              min: minimum ?? undefined,
              max: maximum ?? undefined,
            })
          }
        }
      }
    }
    return map
  }, [exams])

  function getRef(param: string) {
    return refMap.get(param) ?? null
  }

  if (exams.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm dark:border-white/10 dark:bg-[#0F2244]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          <TrendingUp className="h-6 w-6 text-brand-300" />
        </div>
        <p className="font-semibold text-slate-600 dark:text-science-100">Gráficos disponíveis a partir de 2 exames</p>
        <p className="mt-1 text-sm text-slate-400 dark:text-science-400">Adicione mais exames para visualizar a evolução.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Parameter selector */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-science-400">Parâmetros</p>
        <div className="flex flex-wrap gap-2">
          {allParams.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelected(s => (s.includes(p) ? s.filter(x => x !== p) : [...s, p]))}
              className={`max-w-full break-all rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition-all ${
                selected.includes(p)
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-science-200 dark:hover:border-gold-400/30'
              }`}
              style={
                selected.includes(p)
                  ? { backgroundColor: palette[i % palette.length], borderColor: palette[i % palette.length] }
                  : {}
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      {selected.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#0F2244]">
          <p className="text-slate-400 dark:text-science-400">Selecione ao menos um parâmetro acima.</p>
        </div>
      ) : selected.length <= 3 ? (
        <div className="space-y-5">
          {selected.map((param, ci) => {
            const refs = getRef(param)
            const unit = exams.flatMap(e => e.parameters).find(p => p.name === param)?.unit ?? ''
            const color = palette[ci % palette.length]
            return (
              <div key={param} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0F2244]">
                <h4 className="mb-4 break-all font-semibold text-slate-800 dark:text-white">
                  {param}
                  {unit && <span className="ml-2 text-sm font-normal text-slate-400 dark:text-science-400">({unit})</span>}
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ fontWeight: 600, color: isDark ? '#D5E2F3' : '#1e293b' }}
                    />
                    {refs?.min !== undefined && (
                      <ReferenceLine
                        y={refs.min} stroke="#f59e0b" strokeDasharray="4 3"
                        label={{ value: 'Mín', fontSize: 10, fill: '#f59e0b', position: 'insideTopRight' }}
                      />
                    )}
                    {refs?.max !== undefined && (
                      <ReferenceLine
                        y={refs.max} stroke="#ef4444" strokeDasharray="4 3"
                        label={{ value: 'Máx', fontSize: 10, fill: '#ef4444', position: 'insideBottomRight' }}
                      />
                    )}
                    <Line
                      type="monotone" dataKey={param} stroke={color} strokeWidth={2.5}
                      dot={{ r: 4, fill: color, strokeWidth: 2, stroke: 'white' }}
                      activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0F2244]">
          <h4 className="mb-4 font-semibold text-slate-800 dark:text-white">Evolução Comparativa</h4>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12, color: axisColor }}
                formatter={(value) => {
                  const label = String(value)
                  return label.length > 28 ? `${label.slice(0, 27)}…` : label
                }}
              />
              {selected.map((param, i) => (
                <Line
                  key={param} type="monotone" dataKey={param}
                  stroke={palette[i % palette.length]} strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0 }} connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
