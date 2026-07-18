'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Zap, AlertTriangle, CheckCircle2, Info, ExternalLink, ArrowRight } from 'lucide-react'
import { gradeAKI } from '@/lib/aki-grading'

// ─── Types ────────────────────────────────────────────────────────────────────

type UOStatus = 'normal' | 'oliguria' | 'anuria' | 'nao_avaliado'

interface AKIResult {
  grade: 1 | 2 | 3 | 4 | 5
  gradeName: string
  gradeColor: 'green' | 'yellow' | 'orange' | 'red' | 'darkred'
  creatCriteria: string
  uoCriteria: string
  deltaCriteria?: string
  interpretation: string
  interventions: string[]
  urgency: 'monitorar' | 'tratar' | 'urgencia' | 'emergencia'
}

// ─── IRIS AKI Grading Table ───────────────────────────────────────────────────
// Source: IRIS AKI Grading Guidelines 2026 (iris-kidney.com)

const IRIS_AKI_GRADES = [
  {
    grade: 1 as const,
    gradeName: 'Grau I — Não azotêmico',
    gradeColor: 'green' as const,
    creatMax: 1.6,
    description: 'Creatinina < 1,6 mg/dL com evidência de IRA (biomarcadores, aumento ≥ 0,3 mg/dL em 48h)',
  },
  {
    grade: 2 as const,
    gradeName: 'Grau II — Azotemia leve',
    gradeColor: 'yellow' as const,
    creatMin: 1.7,
    creatMax: 2.5,
    description: 'Creatinina 1,7–2,5 mg/dL',
  },
  {
    grade: 3 as const,
    gradeName: 'Grau III — Azotemia moderada',
    gradeColor: 'orange' as const,
    creatMin: 2.6,
    creatMax: 5.0,
    description: 'Creatinina 2,6–5,0 mg/dL',
  },
  {
    grade: 4 as const,
    gradeName: 'Grau IV — Azotemia grave',
    gradeColor: 'red' as const,
    creatMin: 5.1,
    creatMax: 10.0,
    description: 'Creatinina 5,1–10,0 mg/dL',
  },
  {
    grade: 5 as const,
    gradeName: 'Grau V — Azotemia crítica',
    gradeColor: 'darkred' as const,
    creatMin: 10.1,
    description: 'Creatinina > 10,0 mg/dL',
  },
]

const GRADE_INTERVENTIONS: Record<number, string[]> = {
  1: [
    'Confirmar a evidência de injúria renal aguda e investigar a causa.',
    'Reavaliar creatinina, tendência clínica, hidratação e débito urinário.',
    'Revisar exposições e medicamentos potencialmente nefrotóxicos com o veterinário.',
    'Definir exames e suporte de forma individualizada.',
  ],
  2: [
    'Confirmar IRA e diferenciar de DRC ou injúria aguda sobre DRC.',
    'Avaliar balanço hídrico, eletrólitos, pressão arterial e débito urinário.',
    'Definir necessidade de internação e suporte pelo estado clínico, não pelo grau isolado.',
    'Considerar avaliação por especialista em nefrologia veterinária.',
  ],
  3: [
    'Realizar avaliação veterinária urgente e monitoramento seriado.',
    'Avaliar balanço hídrico, eletrólitos, acidose, pressão arterial e complicações urêmicas.',
    'Individualizar suporte e frequência de reavaliação.',
    'Discutir precocemente o caso com centro de nefrologia quando disponível.',
  ],
  4: [
    'Realizar avaliação veterinária emergencial e monitoramento intensivo conforme o quadro.',
    'Pesquisar e tratar complicações potencialmente fatais com protocolo individualizado.',
    'Avaliar terapia de substituição renal pelas complicações e resposta ao suporte, não pelo grau isolado.',
    'Discutir prognóstico e opções terapêuticas com o tutor.',
  ],
  5: [
    'Realizar avaliação veterinária emergencial em ambiente com suporte intensivo, quando disponível.',
    'Avaliar complicações, reversibilidade e terapia de substituição renal de forma individual.',
    'Discutir prognóstico, limites terapêuticos e qualidade de vida com o tutor.',
    'Registrar decisões compartilhadas e reavaliar a resposta clínica.',
  ],
}

const GRADE_COLORS = {
  green:   { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', badge: 'bg-emerald-500' },
  yellow:  { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-800',   badge: 'bg-amber-500'   },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-800',  badge: 'bg-orange-500'  },
  red:     { bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-800',     badge: 'bg-red-500'     },
  darkred: { bg: 'bg-red-100',    border: 'border-red-500',     text: 'text-red-900',     badge: 'bg-red-700'     },
}

const URGENCY_LABELS = {
  monitorar: { label: 'Avaliação necessária', cls: 'bg-emerald-100 text-emerald-700' },
  tratar:    { label: 'Avaliação prioritária', cls: 'bg-amber-100 text-amber-700' },
  urgencia:  { label: 'Avaliação urgente', cls: 'bg-orange-100 text-orange-700' },
  emergencia:{ label: 'Avaliação emergencial', cls: 'bg-red-100 text-red-800' },
}

// ─── Core classification logic ────────────────────────────────────────────────

function classifyAKI(
  creat: number,
  prevCreat: number | null,
  hoursInterval: number | null,
  uoStatus: UOStatus,
  hasClinicalEvidence: boolean,
): AKIResult | null {
  const grading = gradeAKI({
    creatinineMgDl: creat,
    previousCreatinineMgDl: prevCreat,
    intervalHours: hoursInterval,
    urineOutputStatus: uoStatus,
    hasClinicalEvidence,
  })
  if (!grading) return null

  const finalGrade = grading.grade
  const finalEntry = IRIS_AKI_GRADES.find(g => g.grade === finalGrade) ?? IRIS_AKI_GRADES[0]
  const deltaCriteria = grading.deltaMgDl !== undefined
    ? `Δ creatinina = ${grading.deltaMgDl.toFixed(2)} mg/dL em ${hoursInterval}h (> 0,3 mg/dL / 48h)`
    : undefined
  const uoCriteria = grading.urineSubgrade
    ? `Subgrau urinário ${grading.urineSubgrade} — o débito urinário não altera o grau IRIS AKI`
    : 'Débito urinário não avaliado'

  const urgencyMap: Record<number, AKIResult['urgency']> = {
    1: 'monitorar', 2: 'tratar', 3: 'urgencia', 4: 'emergencia', 5: 'emergencia',
  }

  const interpretMap: Record<number, string> = {
    1: 'Faixa não azotêmica ou inicial, aplicável apenas quando há evidência documentada de injúria renal aguda.',
    2: 'Faixa de azotemia leve. Correlacionar com tendência, hidratação e evidência clínica de IRA.',
    3: 'Faixa de azotemia moderada. Avaliar prontamente tendência e complicações.',
    4: 'Faixa de azotemia grave. A urgência depende do estado clínico e das complicações.',
    5: 'Faixa de azotemia muito grave. Requer avaliação emergencial e prognóstico individualizado.',
  }

  return {
    grade: finalGrade as 1|2|3|4|5,
    gradeName: finalEntry.gradeName,
    gradeColor: finalEntry.gradeColor,
    creatCriteria: finalEntry.description,
    uoCriteria,
    deltaCriteria,
    interpretation: interpretMap[finalGrade],
    interventions: GRADE_INTERVENTIONS[finalGrade],
    urgency: urgencyMap[finalGrade],
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const inputCls  = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white'
const selectCls = inputCls

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function References() {
  const refs = [
    { a: 'IRIS (International Renal Interest Society).', t: 'IRIS AKI Grading Guidelines', j: '2026. iris-kidney.com', url: 'https://www.iris-kidney.com/s/IRIS-AKI-Grading_2026.pdf', doi: 'IRIS-AKI-Grading_2026.pdf' },
    { a: 'Kellum JA et al.', t: 'KDIGO Clinical Practice Guideline for Acute Kidney Injury', j: 'Kidney Int Suppl. 2012;2(1):1-138', url: 'https://doi.org/10.1038/kisup.2012.1', doi: '10.1038/kisup.2012.1' },
    { a: 'Cowgill LD, Langston C.', t: 'Acute Kidney Insufficiency. In: Nephrology and Urology of Small Animals', j: 'Wiley-Blackwell; 2011:472-523', url: null, doi: null },
    { a: 'Segev G et al.', t: 'Epidemiology of acute kidney injury in veterinary medicine', j: 'J Vet Intern Med. 2008;22(5):1162-1167', url: 'https://doi.org/10.1111/j.1939-1676.2008.0163.x', doi: '10.1111/j.1939-1676.2008.0163.x' },
    { a: 'Langston C.', t: 'Managing Fluid and Electrolyte Disorders in Renal Failure', j: 'Vet Clin North Am Small Anim Pract. 2008;38(3):677-697', url: 'https://doi.org/10.1016/j.cvsm.2008.01.003', doi: '10.1016/j.cvsm.2008.01.003' },
    { a: 'Vaden SL, Levine J, Breitschwerdt EB.', t: 'A retrospective case-control of acute renal failure in 99 dogs', j: 'J Vet Intern Med. 1997;11(2):58-64', url: 'https://doi.org/10.1111/j.1939-1676.1997.tb00079.x', doi: '10.1111/j.1939-1676.1997.tb00079.x' },
  ]
  return (
    <div className="mt-10 rounded-2xl border border-slate-100 bg-slate-50 p-6">
      <h2 className="font-display font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
        <ExternalLink className="h-4 w-4 text-brand-500" aria-hidden />
        Referências Científicas
      </h2>
      <ol className="space-y-3">
        {refs.map((r, i) => (
          <li key={i} className="text-xs text-slate-600 leading-relaxed flex gap-2">
            <span className="shrink-0 font-bold text-brand-500">[{i+1}]</span>
            <span>
              <span className="font-semibold">{r.a}</span> <em>{r.t}</em>. {r.j}.{' '}
              {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">{r.doi}</a>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IRACalculator() {
  const [result, setResult] = useState<AKIResult | null>(null)
  const [showPrev, setShowPrev] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const creat     = parseFloat(fd.get('creat') as string)
    const prevCreat = showPrev ? parseFloat(fd.get('prevCreat') as string) : null
    const hours     = showPrev ? parseFloat(fd.get('hours') as string) : null
    const uoStatus  = fd.get('uoStatus') as UOStatus
    const hasClinicalEvidence = fd.get('acuteEvidence') === 'on'
    if (!creat || creat <= 0) return
    const nextResult = classifyAKI(
      creat,
      prevCreat,
      hours,
      uoStatus,
      hasClinicalEvidence,
    )
    setResult(nextResult)
    setValidationMessage(
      nextResult
        ? ''
        : 'Não foi possível classificar. Confirme evidência de IRA e use valores laboratoriais reportados nas faixas IRIS; intervalos entre cortes exigem interpretação veterinária.',
    )
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
      <div className="p-6 sm:p-8">

        {/* Criteria banner */}
        <div className="mb-6 rounded-xl bg-brand-50 border border-brand-100 p-4 flex gap-3">
          <Info className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-brand-700 leading-relaxed">
            Faixas baseadas no sistema <strong>IRIS AKI 2026</strong> (Graus I–V).
            O débito urinário define o subgrau O/NO e não eleva o grau da creatinina.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            <Field id="creat" label="Creatinina sérica atual (mg/dL) *"
              hint="A faixa de creatinina não diferencia IRA de DRC sem contexto clínico.">
              <input id="creat" name="creat" type="number" step="0.01" min="0.1" max="40"
                placeholder="Ex: 3.8" className={inputCls} required />
            </Field>

            <Field id="uoStatus" label="Débito urinário (após fluidoterapia)"
              hint="IRIS 2026: subgrau O se < 1 mL/kg/h ou ausência de urina por 6h.">
              <select id="uoStatus" name="uoStatus" className={selectCls}>
                <option value="normal">Normal (≥ 1 mL/kg/h)</option>
                <option value="oliguria">Oligúria (&lt; 1 mL/kg/h)</option>
                <option value="anuria">Sem produção de urina por 6h</option>
                <option value="nao_avaliado">Não avaliado</option>
              </select>
            </Field>

            <Field id="cause" label="Causa suspeita (informativo)">
              <select id="cause" name="cause" className={selectCls}>
                <option value="">Não identificada</option>
                <option value="prerenal">Pré-renal (desidratação, hipotensão, choque)</option>
                <option value="isquemia">Isquemia renal</option>
                <option value="nefrotoxina">Nefrotóxico (AINEs, aminoglicosídeos, contraste)</option>
                <option value="ureteral">Obstrução ureteral</option>
                <option value="infeccioso">Infeccioso (leptospirose, pielonefrite)</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
          </div>

          {/* Toggle creatinina anterior */}
          <div className="mt-4">
            <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-600">
              <input
                type="checkbox"
                name="acuteEvidence"
                className="mt-0.5 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              Há evidência clínica ou laboratorial documentada de injúria renal aguda
              (além de um valor isolado de creatinina).
            </label>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" checked={showPrev}
                onChange={e => setShowPrev(e.target.checked)}
                className="rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
              Tenho creatinina anterior (critério de Δ ≥ 0,3 mg/dL / 48h)
            </label>
          </div>

          {showPrev && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <Field id="prevCreat" label="Creatinina anterior (mg/dL)">
                <input id="prevCreat" name="prevCreat" type="number" step="0.01" min="0.1" max="40"
                  placeholder="Ex: 1.2" className={inputCls} />
              </Field>
              <Field id="hours" label="Intervalo entre dosagens (horas)">
                <input id="hours" name="hours" type="number" step="1" min="1" max="168"
                  placeholder="Ex: 24" className={inputCls} />
              </Field>
            </div>
          )}

          <button type="submit"
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20">
            <Zap className="h-4 w-4" aria-hidden />
            Classificar Injúria Renal Aguda
          </button>
          {validationMessage && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {validationMessage}
            </p>
          )}
        </form>

        {/* Result */}
        {result && (() => {
          const colors = GRADE_COLORS[result.gradeColor]
          const urgency = URGENCY_LABELS[result.urgency]
          return (
            <div className="mt-8 space-y-5" aria-live="polite">

              {/* Grade card */}
              <div className={`rounded-2xl border-2 p-5 ${colors.bg} ${colors.border}`}>
                <div className="flex items-start gap-4">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-xl shrink-0 ${colors.badge}`}>
                    {result.grade}
                  </span>
                  <div>
                    <h2 className={`font-display font-bold text-xl ${colors.text}`}>{result.gradeName}</h2>
                    <p className={`text-sm mt-1 leading-relaxed ${colors.text} opacity-80`}>{result.creatCriteria}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {result.deltaCriteria && (
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className={colors.text}>{result.deltaCriteria}</span>
                    </div>
                  )}
                  {result.uoCriteria && (
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span className={colors.text}>{result.uoCriteria}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Urgency + RR badge */}
              <div className="flex flex-wrap gap-3">
                <span className={`px-4 py-2 rounded-full text-xs font-bold ${urgency.cls}`}>
                  {urgency.label}
                </span>
                <span className="px-4 py-2 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                  TSR depende das complicações e da resposta, não do grau isolado
                </span>
              </div>

              {/* Interpretation */}
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-sm text-slate-700 leading-relaxed">{result.interpretation}</p>
              </div>

              {/* Interventions */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-display font-semibold text-slate-900 mb-4 text-sm">
                  Pontos para avaliação veterinária — IRIS AKI Grau {result.grade}
                </h3>
                <ul className="space-y-2">
                  {result.interventions.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm text-amber-800 leading-relaxed">
                  <strong>Ferramenta de suporte clínico.</strong> A classificação de IRA deve ser sempre
                  contextualizada com a história clínica, exame físico e evolução do paciente.
                  Prescrição final sob responsabilidade do médico veterinário assistente.
                </p>
              </div>

              {/* CTA */}
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Acompanhe a evolução no Lab Evolution</p>
                  <p className="text-xs text-slate-500 mt-1">Registre creatinina seriada e condutas no prontuário digital</p>
                </div>
                <Link href="/lab" className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors">
                  Acessar Lab <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          )
        })()}
      </div>

      <References />
    </div>
  )
}
