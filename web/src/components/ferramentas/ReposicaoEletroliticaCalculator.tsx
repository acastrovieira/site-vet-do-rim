'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FlaskConical, AlertTriangle, Info, ExternalLink, ArrowRight, CheckCircle2 } from 'lucide-react'

type Tab = 'potassio' | 'bicarbonato' | 'calcio' | 'fosforo' | 'magnesio'

const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white'
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

function Metric({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${accent ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100'}`}>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-brand-700' : 'text-slate-800'}`}>{value}</p>
      {unit && <p className="text-[11px] text-slate-400 mt-0.5">{unit}</p>}
    </div>
  )
}

function Alert({ type, children }: { type: 'warning' | 'info' | 'danger'; children: React.ReactNode }) {
  const styles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={`rounded-xl border p-4 flex gap-3 ${styles[type]}`}>
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  )
}

// ─── POTÁSSIO ────────────────────────────────────────────────────────────────

const K_TABLE = [
  { max: 2.0,  kcl250: 20, maxRate: 0.50, label: '< 2,0' },
  { max: 2.5,  kcl250: 15, maxRate: 0.25, label: '2,0 – 2,5' },
  { max: 3.0,  kcl250: 10, maxRate: 0.15, label: '2,5 – 3,0' },
  { max: 3.5,  kcl250:  7, maxRate: 0.10, label: '3,0 – 3,5' },
  { max: 99,   kcl250:  5, maxRate: 0.05, label: '3,5 – 5,0 (manutenção)' },
]

// KCl concentrations available in Brazil
const KCL_CONCENTRATIONS = [
  { label: 'KCl 10% (1,34 mEq/mL)',   value: 1.34 },
  { label: 'KCl 19,1% (2,56 mEq/mL)', value: 2.56 },
] as const

const BAG_SIZES_ML = [100, 250, 500, 1000] as const

function PotassioCalc() {
  interface KRes {
    kclMeqPerBag: number; kclMlToAdd: number
    kclConcInBag: number; deliveryRateMeqH: number; deliveryRatePerKg: number
    exceedsLimit: boolean; safeFluidRate: number; safeKclMlToAdd: number
    row: typeof K_TABLE[0]; bagSize: number; kclConc: number; fluidRateMlH: number
  }
  const [res, setRes] = useState<KRes | null>(null)

  function calc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd        = new FormData(e.currentTarget)
    const k         = parseFloat(fd.get('kSerum') as string)
    const w         = parseFloat(fd.get('weight') as string)
    const fluidRate = parseFloat(fd.get('fluidRate') as string)
    const bagSize   = parseInt(fd.get('bagSize') as string)
    const kclConc   = parseFloat(fd.get('kclConc') as string)
    if (!k || !w || !fluidRate || !bagSize) return

    const row           = K_TABLE.find(r => k < r.max) ?? K_TABLE[K_TABLE.length - 1]
    const kclMeqPerBag  = row.kcl250 * (bagSize / 250)      // escala p/ tamanho do frasco
    const kclMlToAdd    = kclMeqPerBag / kclConc             // mL de KCl a adicionar
    const kclConcInBag  = kclMeqPerBag / bagSize             // mEq/mL no frasco
    const deliveryRateMeqH  = kclConcInBag * fluidRate
    const deliveryRatePerKg = deliveryRateMeqH / w
    const exceedsLimit      = deliveryRatePerKg > 0.5
    const safeFluidRate     = (0.5 * w) / kclConcInBag
    const safeKclMeq        = 0.5 * w * (bagSize / fluidRate)
    const safeKclMlToAdd    = safeKclMeq / kclConc

    setRes({ kclMeqPerBag, kclMlToAdd, kclConcInBag, deliveryRateMeqH,
      deliveryRatePerKg, exceedsLimit, safeFluidRate, safeKclMlToAdd,
      row, bagSize, kclConc, fluidRateMlH: fluidRate })
  }

  return (
    <div className="space-y-5">
      <form onSubmit={calc} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="kSerum" label="K⁺ sérico (mEq/L)">
          <input id="kSerum" name="kSerum" type="number" step="0.1" min="0.5" max="8" placeholder="Ex: 2.3" className={inputCls} />
        </Field>
        <Field id="weight" label="Peso (kg)">
          <input id="weight" name="weight" type="number" step="0.1" min="0.5" max="200" placeholder="Ex: 10" className={inputCls} />
        </Field>
        <Field id="fluidRate" label="Taxa do fluido IV (mL/h)" hint="Taxa total prescrita na fluidoterapia">
          <input id="fluidRate" name="fluidRate" type="number" step="1" min="1" max="500" placeholder="Ex: 50" className={inputCls} />
        </Field>
        <Field id="bagSize" label="Tamanho do frasco disponível">
          <select id="bagSize" name="bagSize" className={selectCls}>
            {BAG_SIZES_ML.map(s => (
              <option key={s} value={s}>{s === 1000 ? '1 Litro (1000 mL)' : `${s} mL`}</option>
            ))}
          </select>
        </Field>
        <Field id="kclConc" label="Concentração do KCl disponível"
          hint="KCl 19,1% = padrão das ampolas hospitalares brasileiras">
          <select id="kclConc" name="kclConc" className={selectCls}>
            {KCL_CONCENTRATIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors">
            Calcular suplementão de K⁺
          </button>
        </div>
      </form>

      {res && (
        <div className="space-y-4" aria-live="polite">
          {res.exceedsLimit ? (
            <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <p className="font-bold text-red-800">⛔ LIMITE ULTRAPASSADO — PROTOCOLO REAJUSTADO</p>
              </div>
              <p className="text-sm text-red-700 mb-4 leading-relaxed">
                A concentração calculada entregaria{' '}
                <strong>{res.deliveryRatePerKg.toFixed(3)} mEq/kg/h</strong> de K⁺,
                ultrapassando o limite máximo absoluto de <strong>0,5 mEq/kg/h</strong>.
                Duas opções seguras:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-white border border-red-200 p-4">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Opção A — reduzir taxa de infusão</p>
                  <p className="text-xl font-bold text-red-700">{Math.floor(res.safeFluidRate)} mL/h</p>
                  <p className="text-xs text-slate-500 mt-1">Com {res.kclMeqPerBag.toFixed(1)} mEq KCl / {res.bagSize}mL</p>
                </div>
                <div className="rounded-xl bg-white border border-red-200 p-4">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Opção B — reduzir KCl no frasco</p>
                  <p className="text-xl font-bold text-red-700">{res.safeKclMlToAdd.toFixed(2)} mL</p>
                  <p className="text-xs text-slate-500 mt-1">de KCl para {res.bagSize}mL a {res.fluidRateMlH}mL/h</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800 font-semibold">
                ✅ Protocolo seguro — {res.deliveryRatePerKg.toFixed(3)} mEq/kg/h (limite: 0,5 mEq/kg/h)
              </p>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-xs text-slate-500 mb-3 font-medium">
              K⁺ = <strong>{res.row.label} mEq/L</strong> · Frasco {res.bagSize}mL · {res.fluidRateMlH} mL/h
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="KCl a adicionar" value={res.kclMlToAdd.toFixed(2)} unit={`mL de KCl ${res.kclConc === 1.34 ? '10%' : '19,1%'}`} accent />
              <Metric label="mEq KCl/frasco" value={res.kclMeqPerBag.toFixed(1)} unit="mEq" />
              <Metric label="Conc. no frasco" value={(res.kclConcInBag * 1000).toFixed(2)} unit="mEq/100mL" />
              <Metric label="Taxa K⁺ entregue" value={res.deliveryRateMeqH.toFixed(3)} unit="mEq/h" />
            </div>
            <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Retirar {res.kclMlToAdd.toFixed(1)} mL do frasco antes de adicionar o KCl para manter o volume total em {res.bagSize} mL.
              O volume de KCl adicionado deve ser descontado do volume total de fluido prescrito.
            </p>
          </div>
          <Alert type="danger">
            <strong>Limite absoluto: 0,5 mEq/kg/h</strong> — nunca ultrapassar. ECG contínuo e ionograma a cada 4–6h.
            Nunca administrar KCl puro IV direto (parada cardíaca).
          </Alert>
        </div>
      )}
    </div>
  )
}

function BicarbonatoCalc() {
  const [res, setRes] = useState<{ deficit: number; dose25: number; dose50: number; volume84: number } | null>(null)

  function calc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const hco3m = parseFloat(fd.get('hco3m') as string)
    const w = parseFloat(fd.get('weight') as string)
    const target = parseFloat(fd.get('target') as string) || 14
    if (!hco3m || !w) return
    const deficit = (target - hco3m) * 0.3 * w
    setRes({
      deficit: Math.round(deficit * 10) / 10,
      dose25: Math.round(deficit * 0.25 * 10) / 10,
      dose50: Math.round(deficit * 0.50 * 10) / 10,
      volume84: Math.round(deficit * 10) / 10,  // NaHCO3 8,4% = 1 mEq/mL
    })
  }

  return (
    <div className="space-y-5">
      <form onSubmit={calc} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field id="hco3m" label="HCO₃⁻ medido (mEq/L)">
          <input id="hco3m" name="hco3m" type="number" step="0.1" min="1" max="40" placeholder="Ex: 8" className={inputCls} />
        </Field>
        <Field id="weight" label="Peso (kg)">
          <input id="weight" name="weight" type="number" step="0.1" min="0.5" max="200" placeholder="Ex: 10" className={inputCls} />
        </Field>
        <Field id="target" label="HCO₃⁻ alvo (mEq/L)" hint="Padrão: 14 mEq/L (não normalizar totalmente)">
          <input id="target" name="target" type="number" step="1" min="8" max="24" placeholder="14" className={inputCls} />
        </Field>
        <div className="sm:col-span-3">
          <button type="submit" className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors">
            Calcular déficit de bicarbonato
          </button>
        </div>
      </form>

      {res && (
        <div className="space-y-4" aria-live="polite">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Déficit total" value={res.deficit.toString()} unit="mEq" />
            <Metric label="Volume NaHCO₃ 8,4%" value={res.volume84.toString()} unit="mL (= total)" />
            <Metric label="Dose 25% (2h)" value={res.dose25.toString()} unit="mEq" accent />
            <Metric label="Dose 50% (4h)" value={res.dose50.toString()} unit="mEq" accent />
          </div>
          <Alert type="warning">
            <strong>Indicação:</strong> pH &lt; 7,1 ou HCO₃⁻ &lt; 12 mEq/L. Administrar 25–50% da dose em 2–4h, depois reavalie.
            NaHCO₃ 8,4% = 1 mEq/mL. Diluir em SG 5% ou NaCl 0,45%. Risco de alcalose rebote e hipocalemia — monitorizar ionograma.
          </Alert>
        </div>
      )}
    </div>
  )
}

// ─── CÁLCIO ──────────────────────────────────────────────────────────────────

function CalcioCalc() {
  const [res, setRes] = useState<{ product: string; volume: number; elementalCa: number; infTime: string } | null>(null)

  function calc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const w = parseFloat(fd.get('weight') as string)
    const product = fd.get('product') as string
    const dose = parseFloat(fd.get('dose') as string)
    if (!w || !dose) return
    const volume = dose * w
    const elementalPerMl = product === 'gluconato' ? 9.3 : 27.2
    setRes({
      product: product === 'gluconato' ? 'Gluconato de Ca 10%' : 'Cloreto de Ca 10%',
      volume: Math.round(volume * 10) / 10,
      elementalCa: Math.round(volume * elementalPerMl),
      infTime: product === 'gluconato' ? '10–20 min (hipocalcemia) / 5–15 min (hipercalemia)' : '10–20 min (apenas IV central)',
    })
  }

  return (
    <div className="space-y-5">
      <form onSubmit={calc} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field id="product" label="Produto">
          <select id="product" name="product" className={selectCls}>
            <option value="gluconato">Gluconato de Ca 10% (9,3 mg Ca/mL)</option>
            <option value="cloreto">Cloreto de Ca 10% (27,2 mg Ca/mL) — IV central</option>
          </select>
        </Field>
        <Field id="weight" label="Peso (kg)">
          <input id="weight" name="weight" type="number" step="0.1" min="0.5" max="200" placeholder="Ex: 10" className={inputCls} />
        </Field>
        <Field id="dose" label="Dose (mL/kg)" hint="Gluconato: 0,5–1,5 mL/kg | CaCl₂: 0,1–0,2 mL/kg">
          <input id="dose" name="dose" type="number" step="0.1" min="0.1" max="3" placeholder="Ex: 1.0" className={inputCls} />
        </Field>
        <div className="sm:col-span-3">
          <button type="submit" className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors">
            Calcular reposição de Ca²⁺
          </button>
        </div>
      </form>

      {res && (
        <div className="space-y-4" aria-live="polite">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Metric label="Volume total" value={res.volume.toString()} unit="mL" accent />
            <Metric label="Ca elementar" value={res.elementalCa.toString()} unit="mg" />
            <Metric label="Tempo de infusão" value={res.infTime} />
          </div>
          <Alert type="danger">
            Monitorização de ECG obrigatória durante infusão. Bradicardia ou alteração no traçado: interromper imediatamente.
            CaCl₂ é mais potente (~3×) e causa necrose tecidual grave se extravasar — apenas IV central.
          </Alert>
        </div>
      )}
    </div>
  )
}

// ─── FÓSFORO ─────────────────────────────────────────────────────────────────

function FosforoCalc() {
  const [res, setRes] = useState<{ mmolH: number; duration: number; totalMmol: number } | null>(null)

  function calc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const w = parseFloat(fd.get('weight') as string)
    const level = fd.get('level') as string
    if (!w) return
    const rate = level === 'grave' ? 0.045 : 0.02
    const duration = level === 'grave' ? 6 : 6
    setRes({ mmolH: Math.round(rate * w * 100) / 100, duration, totalMmol: Math.round(rate * w * duration * 100) / 100 })
  }

  return (
    <div className="space-y-5">
      <form onSubmit={calc} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="weight" label="Peso (kg)">
          <input id="weight" name="weight" type="number" step="0.1" min="0.5" max="200" placeholder="Ex: 10" className={inputCls} />
        </Field>
        <Field id="level" label="Gravidade da hipofosfatemia">
          <select id="level" name="level" className={selectCls}>
            <option value="moderada">Moderada (1,0–2,0 mg/dL) — 0,01–0,03 mmol/kg/h</option>
            <option value="grave">Grave (&lt; 1,0 mg/dL) — 0,03–0,06 mmol/kg/h</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors">
            Calcular reposição de PO₄³⁻
          </button>
        </div>
      </form>

      {res && (
        <div className="space-y-4" aria-live="polite">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Taxa" value={res.mmolH.toString()} unit="mmol/kg/h" accent />
            <Metric label="Duração" value={res.duration.toString()} unit="horas" />
            <Metric label="Total (dose)" value={res.totalMmol.toString()} unit="mmol" />
          </div>
          <Alert type="warning">
            Diluir KH₂PO₄ em NaCl 0,9% ou NaCl 0,45%. Não misturar com soluções contendo Ca²⁺ (precipitação).
            Reavalie fosfatemia e calcemia após cada ciclo. Pode precipitar hipocalcemia.
          </Alert>
        </div>
      )}
    </div>
  )
}

// ─── MAGNÉSIO ────────────────────────────────────────────────────────────────

function MagnesioCalc() {
  const [res, setRes] = useState<{ dailyMeq: number; dailyMl: number; ratePerH: number } | null>(null)

  function calc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const w = parseFloat(fd.get('weight') as string)
    const sp = fd.get('species') as string
    if (!w) return
    const mEqKgDay = sp === 'cao' ? 0.875 : 0.225
    const dailyMeq = mEqKgDay * w
    const dailyMl = dailyMeq / 4   // MgSO4 50% = 4 mEq/mL
    setRes({ dailyMeq: Math.round(dailyMeq * 10) / 10, dailyMl: Math.round(dailyMl * 100) / 100, ratePerH: Math.round(dailyMl / 24 * 1000) / 1000 })
  }

  return (
    <div className="space-y-5">
      <form onSubmit={calc} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="species" label="Espécie">
          <select id="species" name="species" className={selectCls}>
            <option value="cao">Cão — 0,75–1,0 mEq/kg/dia</option>
            <option value="gato">Gato — 0,15–0,3 mEq/kg/dia</option>
          </select>
        </Field>
        <Field id="weight" label="Peso (kg)">
          <input id="weight" name="weight" type="number" step="0.1" min="0.5" max="200" placeholder="Ex: 10" className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors">
            Calcular CRI de MgSO₄
          </button>
        </div>
      </form>

      {res && (
        <div className="space-y-4" aria-live="polite">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Dose/dia" value={res.dailyMeq.toString()} unit="mEq/dia" accent />
            <Metric label="Vol. MgSO₄ 50%/dia" value={res.dailyMl.toString()} unit="mL/dia" />
            <Metric label="Taxa CRI" value={res.ratePerH.toString()} unit="mL/h" />
          </div>
          <Alert type="info">
            MgSO₄ 50% = 4 mEq/mL. Diluir em NaCl 0,9% ou SG 5% antes de infundir. Taxa máxima IV: 0,15 mEq/kg/h.
            Monitorizar reflexos patelares (hiporreflexia = toxicidade). Manter Ca²⁺ disponível como antídoto.
          </Alert>
        </div>
      )}
    </div>
  )
}

// ─── References ───────────────────────────────────────────────────────────────

const REFS = [
  { a: 'DiBartola SP.', t: 'Fluid, Electrolyte, and Acid-Base Disorders in Small Animal Practice', j: '4ª ed. Elsevier Saunders; 2012', url: null, doi: null },
  { a: 'Kogika MM, de Morais HA.', t: 'A quick reference on hypokalemia', j: 'Vet Clin North Am Small Anim Pract. 2017;47(2):229-234', url: 'https://doi.org/10.1016/j.cvsm.2016.10.010', doi: '10.1016/j.cvsm.2016.10.010' },
  { a: 'Dhupa N.', t: 'Magnesium therapy', j: 'Vet Clin North Am Small Anim Pract. 1995;25(2):451-462', url: 'https://pubmed.ncbi.nlm.nih.gov/7597045/', doi: 'PMID: 7597045' },
  { a: 'Schermerhorn T.', t: 'Hypophosphatemia in small animals', j: 'J Vet Emerg Crit Care. 2014;24(4):373-382', url: 'https://doi.org/10.1111/vec.12208', doi: '10.1111/vec.12208' },
  { a: 'Hopper K, Epstein SE.', t: 'Overcorrection of sodium and its relationship to clinical outcome in dogs with hypo- and hypernatremia', j: 'J Vet Intern Med. 2012;26(6):1385-1391', url: 'https://doi.org/10.1111/j.1939-1676.2012.01001.x', doi: '10.1111/j.1939-1676.2012.01001.x' },
]

// ─── Main Component ──────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'potassio',    label: 'Potássio K⁺',      emoji: '🧪' },
  { id: 'bicarbonato', label: 'Bicarbonato HCO₃⁻', emoji: '⚗️' },
  { id: 'calcio',      label: 'Cálcio Ca²⁺',       emoji: '🦴' },
  { id: 'fosforo',     label: 'Fósforo PO₄³⁻',     emoji: '🔬' },
  { id: 'magnesio',    label: 'Magnésio Mg²⁺',      emoji: '💊' },
]

export function ReposicaoEletroliticaCalculator() {
  const [tab, setTab] = useState<Tab>('potassio')

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-slate-100 px-6 pt-6">
        <div className="flex gap-1 overflow-x-auto pb-px">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all duration-200 border-b-2 ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700 bg-brand-50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="mr-1.5">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {tab === 'potassio'    && <PotassioCalc />}
        {tab === 'bicarbonato' && <BicarbonatoCalc />}
        {tab === 'calcio'      && <CalcioCalc />}
        {tab === 'fosforo'     && <FosforoCalc />}
        {tab === 'magnesio'    && <MagnesioCalc />}

        {/* Disclaimer */}
        <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4 flex gap-3">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-slate-500 leading-relaxed">
            Ferramenta de suporte clínico. Reavalie sempre os eletrólitos séricos antes, durante e após a reposição.
            A prescrição final é responsabilidade do médico veterinário assistente.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800 text-sm">Registre no prontuário digital</p>
            <p className="text-xs text-slate-500 mt-1">Lab Evolution — acompanhamento longitudinal de eletrólitos</p>
          </div>
          <Link href="/lab" className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors">
            Acessar Lab <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {/* References */}
      <div className="mx-6 mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-6">
        <h2 className="font-display font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-brand-500" aria-hidden />
          Referências Científicas
        </h2>
        <ol className="space-y-3">
          {REFS.map((r, i) => (
            <li key={i} className="text-xs text-slate-600 leading-relaxed flex gap-2">
              <span className="shrink-0 font-bold text-brand-500">[{i + 1}]</span>
              <span>
                <span className="font-semibold">{r.a}</span> <em>{r.t}</em>. {r.j}.{' '}
                {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">{r.doi}</a>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
