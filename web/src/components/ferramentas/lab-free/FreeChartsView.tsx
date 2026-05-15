'use client'

import { useState, useMemo, useEffect } from 'react'
import type { FreeLabExam } from '@/lib/lab-free/types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

interface Props {
  exams: FreeLabExam[]
}

const PALETTE = ['#1A2E5A', '#0d9488', '#D4AF37', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

/**
 * Gráficos de evolução temporal de parâmetros laboratoriais.
 * Seleção por pills, linhas de referência min/max.
 */
export function FreeChartsView({ exams }: Props) {
  const allParams = useMemo(() => {
    const s = new Set<string>()
    exams.forEach(e =>
      e.parameters.forEach(p => {
        if (!isNaN(parseFloat(p.value.replace(',', '.')))) s.add(p.name)
      })
    )
    return Array.from(s).sort()
  }, [exams])

  const [selected, setSelected] = useState<string[]>(allParams.slice(0, 3))

  useEffect(() => {
    setSelected(allParams.slice(0, 3))
  }, [allParams])

  const chartData = useMemo(
    () =>
      exams.map(exam => {
        const pt: Record<string, string | number> = { date: exam.examDate }
        for (const param of selected) {
          const p = exam.parameters.find(par => par.name === param)
          if (p) {
            const v = parseFloat(p.value.replace(',', '.'))
            if (!isNaN(v)) pt[param] = v
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
          map.set(p.name, {
            min: p.refMin ? parseFloat(p.refMin) : undefined,
            max: p.refMax ? parseFloat(p.refMax) : undefined,
          })
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
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          <TrendingUp className="h-6 w-6 text-brand-300" />
        </div>
        <p className="font-semibold text-slate-600">Gráficos disponíveis a partir de 2 exames</p>
        <p className="mt-1 text-sm text-slate-400">Adicione mais exames para visualizar a evolução.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Parameter selector */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Parâmetros</p>
        <div className="flex flex-wrap gap-2">
          {allParams.map((p, i) => (
            <button
              key={p}
              onClick={() => setSelected(s => (s.includes(p) ? s.filter(x => x !== p) : [...s, p]))}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                selected.includes(p)
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300'
              }`}
              style={
                selected.includes(p)
                  ? { backgroundColor: PALETTE[i % PALETTE.length], borderColor: PALETTE[i % PALETTE.length] }
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
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-400">Selecione ao menos um parâmetro acima.</p>
        </div>
      ) : selected.length <= 3 ? (
        <div className="space-y-5">
          {selected.map((param, ci) => {
            const refs = getRef(param)
            const unit = exams.flatMap(e => e.parameters).find(p => p.name === param)?.unit ?? ''
            const color = PALETTE[ci % PALETTE.length]
            return (
              <div key={param} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h4 className="mb-4 font-semibold text-slate-800">
                  {param}
                  {unit && <span className="ml-2 text-sm font-normal text-slate-400">({unit})</span>}
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      labelStyle={{ fontWeight: 600, color: '#1e293b' }}
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
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h4 className="mb-4 font-semibold text-slate-800">Evolução Comparativa</h4>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              {selected.map((param, i) => (
                <Line
                  key={param} type="monotone" dataKey={param}
                  stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5}
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
