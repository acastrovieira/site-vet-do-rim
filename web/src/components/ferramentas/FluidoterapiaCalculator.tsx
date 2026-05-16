'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Droplets, AlertTriangle, CheckCircle2, ExternalLink, ArrowRight, Info } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Species = 'cao' | 'gato'
type Goal    = 'manutencao' | 'deficit_manutencao' | 'choque'
type BagSize = 100 | 250 | 500 | 1000
type FluidType = 'rl' | 'rs' | 'nacl09'

const FLUID_LABELS: Record<FluidType, string> = {
  rl:     'Ringer Lactato (isotônico balanceado)',
  rs:     'Ringer Simples (isotônico)',
  nacl09: 'NaCl 0,9% (soro fisiológico)',
}

const FLUID_NOTES: Record<FluidType, string> = {
  rl:     'Escolha preferencial em acidose metabólica leve, desidratação geral e choque.',
  rs:     'Alternativa ao RL. Sem lactato — evitar em hepatopatia grave.',
  nacl09: 'Preferido em alcalose metabólica, hipercalemia e quando o RL é contraindicado. Risco de acidose hiperclorêmica em grandes volumes.',
}

const BAG_SIZES: BagSize[] = [100, 250, 500, 1000]

interface FluidResult {
  maintenancePerDay: number
  maintenancePerHour: number
  deficitVolume: number
  deficitRatePerHour: number
  additionalLossesPerHour: number
  totalRatePerHour: number
  shockBolusVolume?: number
  shockBolusDurationMin?: number
  maxShockDog?: number
  goal: Goal
  dehydrationPct: number
  species: Species
  weightKg: number
  correctionHours: number
  bagSize: BagSize
  fluidType: FluidType
  bagDurationHours: number      // quantas horas dura 1 frasco
  bagsPerDay: number            // frascos necessários por dia
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const DEHYDRATION_OPTIONS = [
  { value: '0',  label: '0% — Sem desidratação',                          pct: 0,    severity: 'ok'       },
  { value: '5',  label: '<5% — Sutil (apenas histórico clínico)',          pct: 4,    severity: 'low'      },
  { value: '6',  label: '5–6% — Leve perda de elasticidade cutânea',      pct: 5.5,  severity: 'low'      },
  { value: '8',  label: '6–8% — Turgor reduzido, mucosas pegajosas',      pct: 7,    severity: 'moderate' },
  { value: '10', label: '8–10% — Turgor prolongado, taquicardia',         pct: 9,    severity: 'high'     },
  { value: '12', label: '10–12% — Olhos fundos, pulso fraco',             pct: 11,   severity: 'critical' },
  { value: '15', label: '12–15% — Crítico, choque iminente',              pct: 13.5, severity: 'critical' },
] as const

const RECOMMENDED_HOURS: Record<string, number> = {
  '0': 24, '5': 24, '6': 24, '8': 12, '10': 8, '12': 6, '15': 4,
}

const DEHYDRATION_SIGNS: Record<string, string[]> = {
  '0':  ['Sem sinais clínicos de desidratação'],
  '5':  ['Anamnese sugere possível perda hídrica', 'Sem sinais físicos detectáveis'],
  '6':  ['Leve perda de elasticidade cutânea (turgor < 2s)', 'Mucosas levemente pegajosas'],
  '8':  ['Turgor cutâneo reduzido (2–3s)', 'Mucosas pegajosas', 'Olhos levemente fundos', 'Considerar acesso venoso'],
  '10': ['Turgor cutâneo prolongado (> 3s)', 'Taquicardia leve-moderada', 'Mucosas secas', 'Pulsos fracos', 'Acesso IV obrigatório'],
  '12': ['Turgor muito prolongado', 'Olhos fundos, lacrimejamento reduzido', 'Pulsos fracos a ausentes', 'Torpor/depressão', 'Emergência clínica'],
  '15': ['Choque iminente ou instalado', 'Colapso cardiovascular', 'Requer bolus IV imediato', 'Monitorização contínua'],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcMaintenance(species: Species, weightKg: number): number {
  // DiBartola 4ª ed. / AAHA-AAFP 2013
  return species === 'cao'
    ? 132 * Math.pow(weightKg, 0.75)   // mL/dia
    : 80  * Math.pow(weightKg, 0.75)   // mL/dia
}

function round1(n: number) { return Math.round(n * 10) / 10 }
function round0(n: number) { return Math.round(n) }

function calculate(
  species: Species,
  weightKg: number,
  dehydrationKey: string,
  goal: Goal,
  correctionHours: number,
  additionalLossesPerHour: number,
  bagSize: BagSize,
  fluidType: FluidType,
): FluidResult {
  const option = DEHYDRATION_OPTIONS.find(d => d.value === dehydrationKey)!
  const maintenancePerDay  = calcMaintenance(species, weightKg)
  const maintenancePerHour = maintenancePerDay / 24
  const deficitVolume      = (option.pct / 100) * weightKg * 1000

  let deficitRatePerHour = 0
  let shockBolusVolume: number | undefined
  let shockBolusDurationMin: number | undefined
  let maxShockDog: number | undefined

  if (goal === 'manutencao') {
    deficitRatePerHour = 0
  } else if (goal === 'deficit_manutencao') {
    deficitRatePerHour = correctionHours > 0 ? deficitVolume / correctionHours : 0
  } else {
    shockBolusVolume      = species === 'cao' ? 20 * weightKg : 10 * weightKg
    shockBolusDurationMin = species === 'cao' ? 20 : 30
    maxShockDog           = species === 'cao' ? 90 * weightKg : undefined
    deficitRatePerHour    = correctionHours > 0 ? deficitVolume / correctionHours : 0
  }

  const totalRatePerHour   = maintenancePerHour + deficitRatePerHour + additionalLossesPerHour
  const bagDurationHours   = totalRatePerHour > 0 ? bagSize / totalRatePerHour : 999
  const bagsPerDay         = totalRatePerHour > 0 ? (24 * totalRatePerHour) / bagSize : 0

  return {
    maintenancePerDay, maintenancePerHour, deficitVolume, deficitRatePerHour,
    additionalLossesPerHour, totalRatePerHour, shockBolusVolume, shockBolusDurationMin,
    maxShockDog, goal, dehydrationPct: option.pct, species, weightKg, correctionHours,
    bagSize, fluidType, bagDurationHours, bagsPerDay,
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({ id, label, hint, children }: {
  id: string; label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white'
const selectCls = inputCls

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ok:       { cls: 'bg-emerald-100 text-emerald-700', label: 'Normal'   },
    low:      { cls: 'bg-sky-100 text-sky-700',         label: 'Leve'     },
    moderate: { cls: 'bg-amber-100 text-amber-700',     label: 'Moderada' },
    high:     { cls: 'bg-orange-100 text-orange-700',   label: 'Grave'    },
    critical: { cls: 'bg-red-100 text-red-700',         label: 'Crítica'  },
  }
  const { cls, label } = map[severity] ?? map.ok
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

function MetricCard({ label, value, unit, accent }: {
  label: string; value: string; unit?: string; accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 text-center ${accent ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100'}`}>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-brand-700' : 'text-slate-800'}`}>{value}</p>
      {unit && <p className="text-[11px] text-slate-400 mt-0.5">{unit}</p>}
    </div>
  )
}

function ResultPanel({ result, dehydrationKey }: { result: FluidResult; dehydrationKey: string }) {
  const signs = DEHYDRATION_SIGNS[dehydrationKey] ?? []
  const option = DEHYDRATION_OPTIONS.find(d => d.value === dehydrationKey)!

  return (
    <div className="mt-8 space-y-5" aria-live="polite">
      {/* Sinais clínicos */}
      <div className={`rounded-2xl border-2 p-5 ${
        option.severity === 'critical' ? 'bg-red-50 border-red-200' :
        option.severity === 'high'     ? 'bg-orange-50 border-orange-200' :
        option.severity === 'moderate' ? 'bg-amber-50 border-amber-200' :
        'bg-emerald-50 border-emerald-100'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          {option.severity === 'ok' || option.severity === 'low'
            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            : <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
          }
          <span className="text-sm font-semibold text-slate-800">Sinais clínicos esperados</span>
          <SeverityBadge severity={option.severity} />
        </div>
        <ul className="space-y-1">
          {signs.map(s => (
            <li key={s} className="text-sm text-slate-700 flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Bolus de choque */}
      {result.goal === 'choque' && result.shockBolusVolume !== undefined && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden />
            <span className="font-semibold text-red-800">Bolus de Ressuscitação</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard label="Volume do bolus" value={round0(result.shockBolusVolume).toString()} unit="mL" accent />
            <MetricCard label="Infundir em" value={result.shockBolusDurationMin!.toString()} unit="minutos" />
            <MetricCard
              label="Taxa do bolus"
              value={round1(result.shockBolusVolume / (result.shockBolusDurationMin! / 60)).toString()}
              unit="mL/h"
            />
          </div>
          {result.maxShockDog && (
            <p className="mt-3 text-xs text-red-700 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Cão: dose máxima cumulativa de ressuscitação = {round0(result.maxShockDog)} mL
              ({result.weightKg} kg × 90 mL/kg). Repetir bolus se necessário com reavaliação contínua.
            </p>
          )}
          {result.species === 'gato' && (
            <p className="mt-3 text-xs text-red-700 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Gatos: doses conservadoras devido à sensibilidade cardíaca à sobrecarga de volume.
              Monitorizar FC, PA e ausculta a cada bolus.
            </p>
          )}
        </div>
      )}

      {/* Métricas principais */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Volumes calculados</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Manutenção"
            value={round1(result.maintenancePerDay).toString()}
            unit="mL/dia"
          />
          <MetricCard
            label="Manutenção"
            value={round1(result.maintenancePerHour).toString()}
            unit="mL/h"
          />
          {result.goal !== 'manutencao' && (
            <MetricCard
              label="Déficit total"
              value={round0(result.deficitVolume).toString()}
              unit={`mL (${result.dehydrationPct}%)`}
            />
          )}
          {result.goal !== 'manutencao' && (
            <MetricCard
              label="Reposição déficit"
              value={round1(result.deficitRatePerHour).toString()}
              unit={`mL/h × ${result.correctionHours}h`}
            />
          )}
        </div>
      </div>

      {/* Prescrição por frasco */}
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <h3 className="text-sm font-semibold text-brand-800 mb-3">Prescrição por frasco ({result.bagSize} mL — {FLUID_LABELS[result.fluidType]})</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Taxa de infusão" value={round1(result.totalRatePerHour).toString()} unit="mL/h" accent />
          <MetricCard label="Duração do frasco" value={round1(result.bagDurationHours).toString()} unit="horas" />
          <MetricCard label="Frascos / 24h" value={round1(result.bagsPerDay).toString()} unit="frascos" />
        </div>
        <p className="mt-3 text-xs text-brand-700">
          ⚠️ O volume de suplementos adicionados ao frasco (KCl, glicose, etc.) deve ser descontado
          do volume de fluido prescrito para manter o volume total correto.
        </p>
      </div>

      {/* Taxa total */}
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #1A2E5A 0%, #1e6fa8 100%)' }}>
        <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
          {result.goal === 'choque' ? 'Taxa de manutenção pós-bolus' : 'Taxa total de infusão'}
        </p>
        <div className="flex items-end gap-3">
          <p className="text-4xl font-bold text-white">{round1(result.totalRatePerHour)}</p>
          <p className="text-white/70 text-lg mb-1">mL/h</p>
        </div>
        {result.additionalLossesPerHour > 0 && (
          <p className="mt-2 text-white/50 text-xs">
            Inclui {round1(result.additionalLossesPerHour)} mL/h de perdas adicionais estimadas
          </p>
        )}
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Tempo de correção</p>
            <p className="text-white font-semibold text-sm">{result.correctionHours} horas</p>
          </div>
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Volume total (24h)</p>
            <p className="text-white font-semibold text-sm">
              {round0(result.totalRatePerHour * 24)} mL
            </p>
          </div>
        </div>
      </div>

      {/* Alerta importante */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Uso clínico — reavalie sempre</p>
          <p className="leading-relaxed text-amber-700">
            Reavalie o estado de hidratação a cada 4–6h. Ajuste a taxa conforme débito urinário
            (alvo: 1–2 mL/kg/h), evolução clínica e monitorização laboratorial.
            Esta calculadora é de suporte — a prescrição final é responsabilidade do médico veterinário.
          </p>
        </div>
      </div>

      {/* CTA Lab */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-800 text-sm">Acompanhe a evolução no Lab Evolution</p>
          <p className="text-xs text-slate-500 mt-1">Registre o protocolo de fluido no prontuário digital do paciente</p>
        </div>
        <Link
          href="/lab"
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          Acessar Lab
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  )
}

// ─── Scientific References ────────────────────────────────────────────────────

function References() {
  const refs = [
    {
      authors: 'Davis H, Jensen T, Johnson A et al.',
      title: '2013 AAHA/AAFP Fluid Therapy Guidelines for Dogs and Cats',
      journal: 'J Am Anim Hosp Assoc. 2013;49(3):149-159',
      url: 'https://doi.org/10.5326/JAAHA-MS-5868',
      doi: '10.5326/JAAHA-MS-5868',
    },
    {
      authors: 'DiBartola SP, Bateman S.',
      title: 'Introduction to Fluid Therapy. In: Fluid, Electrolyte, and Acid-Base Disorders in Small Animal Practice',
      journal: '4ª ed. Elsevier Saunders; 2012:331-350',
      url: null,
      doi: null,
    },
    {
      authors: 'Mazzaferro EM.',
      title: 'Fluid Therapy in Small Animal Practice',
      journal: 'Vet Clin North Am Small Anim Pract. 2020;50(6):1417-1435',
      url: 'https://doi.org/10.1016/j.cvsm.2020.07.012',
      doi: '10.1016/j.cvsm.2020.07.012',
    },
    {
      authors: 'Rudloff E, Kirby R.',
      title: 'Fluid Resuscitation and the Trauma Patient',
      journal: 'Vet Clin North Am Small Anim Pract. 2008;38(3):645-652',
      url: 'https://doi.org/10.1016/j.cvsm.2007.12.003',
      doi: '10.1016/j.cvsm.2007.12.003',
    },
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
            <span className="shrink-0 font-bold text-brand-500">[{i + 1}]</span>
            <span>
              <span className="font-semibold">{r.authors}</span>{' '}
              <em>{r.title}</em>. {r.journal}.{' '}
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline font-medium"
                >
                  DOI: {r.doi}
                </a>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FluidoterapiaCalculator() {
  const [result, setResult]         = useState<FluidResult | null>(null)
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [dehydrationKey, setDehydrationKey] = useState('0')
  const [goal, setGoal]             = useState<Goal>('manutencao')
  const [fluidType, setFluidType]   = useState<FluidType>('rl')
  const [bagSize, setBagSize]       = useState<BagSize>(500)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd   = new FormData(e.currentTarget)
    const errs: Record<string, string> = {}

    const species = fd.get('species') as Species
    if (!species) errs.species = 'Selecione a espécie'

    const weight = parseFloat(fd.get('weight') as string)
    if (!weight || weight <= 0 || weight > 200) errs.weight = 'Peso inválido (0,1–200 kg)'

    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})

    const corrHours = parseInt(fd.get('correctionHours') as string) || RECOMMENDED_HOURS[dehydrationKey]
    const addLosses = parseFloat(fd.get('additionalLosses') as string) || 0

    setResult(calculate(species, weight, dehydrationKey, goal, corrHours, addLosses, bagSize, fluidType))
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
      <div className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Espécie */}
            <Field id="species" label="Espécie *">
              <select id="species" name="species" defaultValue="" className={selectCls}>
                <option value="" disabled>Selecione…</option>
                <option value="cao">Cão</option>
                <option value="gato">Gato</option>
              </select>
              {errors.species && <p className="mt-1 text-xs text-red-600">{errors.species}</p>}
            </Field>

            {/* Peso */}
            <Field id="weight" label="Peso corporal (kg) *">
              <input id="weight" name="weight" type="number" step="0.1" min="0.1" max="200"
                placeholder="Ex: 8.5" className={inputCls} />
              {errors.weight && <p className="mt-1 text-xs text-red-600">{errors.weight}</p>}
            </Field>

            {/* Desidratação */}
            <Field id="dehydration" label="Grau de desidratação *"
              hint="Avalie clinicamente: turgor cutâneo, mucosas, olhos, pulso">
              <select id="dehydration" name="dehydration" className={selectCls}
                value={dehydrationKey}
                onChange={e => setDehydrationKey(e.target.value)}>
                {DEHYDRATION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            {/* Objetivo */}
            <Field id="goal" label="Objetivo da fluidoterapia *">
              <select id="goal" name="goal" className={selectCls}
                value={goal}
                onChange={e => setGoal(e.target.value as Goal)}>
                <option value="manutencao">Manutenção (sem déficit)</option>
                <option value="deficit_manutencao">Reposição de déficit + manutenção</option>
                <option value="choque">Bolus de ressuscitação (choque)</option>
              </select>
            </Field>

            {/* Tipo de fluido */}
            <Field id="fluidType" label="Tipo de fluido *"
              hint={FLUID_NOTES[fluidType]}>
              <select id="fluidType" name="fluidType" className={selectCls}
                value={fluidType}
                onChange={e => setFluidType(e.target.value as FluidType)}>
                {(Object.entries(FLUID_LABELS) as [FluidType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>

            {/* Tamanho do frasco */}
            <Field id="bagSize" label="Tamanho do frasco disponível *"
              hint="Influencia o cálculo de trocas e prescrição por frasco">
              <select id="bagSize" name="bagSize" className={selectCls}
                value={bagSize}
                onChange={e => setBagSize(Number(e.target.value) as BagSize)}>
                {BAG_SIZES.map(s => (
                  <option key={s} value={s}>{s === 1000 ? '1 Litro (1000 mL)' : `${s} mL`}</option>
                ))}
              </select>
            </Field>

            {/* Tempo de correção */}
            {goal !== 'manutencao' && (
              <Field id="correctionHours" label="Horas para corrigir o déficit"
                hint={`Recomendado para este grau: ${RECOMMENDED_HOURS[dehydrationKey]}h`}>
                <input id="correctionHours" name="correctionHours" type="number"
                  step="1" min="1" max="48"
                  defaultValue={RECOMMENDED_HOURS[dehydrationKey]}
                  className={inputCls} />
              </Field>
            )}

            {/* Perdas adicionais */}
            <Field id="additionalLosses" label="Perdas adicionais estimadas (mL/h)"
              hint="Ex: vômito, diarreia, poliúria. Deixe 0 se não souber.">
              <input id="additionalLosses" name="additionalLosses" type="number"
                step="0.1" min="0" max="500" placeholder="0" className={inputCls} />
            </Field>

          </div>

          <button
            type="submit"
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            <Droplets className="h-4 w-4" aria-hidden />
            Calcular fluidoterapia
          </button>
        </form>

        {result && <ResultPanel result={result} dehydrationKey={dehydrationKey} />}
      </div>

      <References />
    </div>
  )
}
