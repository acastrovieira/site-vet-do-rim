'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Info, Activity, Droplets, Heart, ChevronRight } from 'lucide-react'

type Species = 'cao' | 'gato'
type Stage = 1 | 2 | 3 | 4
type ProtSubstage = 'NP' | 'BP' | 'P'
type BPSubstage = 'NT' | 'PH' | 'H' | 'SH'
type ViewMode = 'tutor' | 'vet'

interface StagingResult {
  stage: Stage
  basis: 'creatinina' | 'sdma' | 'ambos'
  prot: ProtSubstage | null
  bp: BPSubstage | null
}

const CREAT: Record<Species, [number, number, number]> = {
  cao:  [1.4, 2.0, 5.0],
  gato: [1.6, 2.8, 5.0],
}

const SDMA_CUTS = [25, 35, 54]

function stageFromCreat(sp: Species, v: number): Stage {
  const [s2, s3, s4] = CREAT[sp]
  return v < s2 ? 1 : v <= s3 ? 2 : v <= s4 ? 3 : 4
}
function stageFromSDMA(v: number): Stage {
  return v < 18 ? 1 : v <= SDMA_CUTS[0] ? 2 : v <= SDMA_CUTS[1] ? 3 : 4
}
function protStage(v: number): ProtSubstage { return v < 0.2 ? 'NP' : v <= 0.5 ? 'BP' : 'P' }
function bpStage(v: number): BPSubstage { return v < 140 ? 'NT' : v < 160 ? 'PH' : v < 180 ? 'H' : 'SH' }

const STAGE_META = {
  1: {
    color: 'emerald',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-400',
    ring: 'ring-emerald-400',
    label: 'Estágio 1',
    sub: 'Não Azotêmico',
    creat: { cao: '< 1,4 mg/dL', gato: '< 1,6 mg/dL' },
    sdmaRange: '< 18 μg/dL',
    tutorDesc: 'A função renal ainda está relativamente preservada. Alterações precoces podem ser detectadas pelos exames antes de qualquer sintoma aparecer.',
    vetDesc: 'Marcadores renais sugestivos de DRC sem azotemia. SDMA ≥ 18 μg/dL pode identificar este estágio precocemente.',
    tutorRecs: ['Exames de controle a cada 6 meses', 'Ofereça sempre água fresca e limpa', 'Alimentação de qualidade, consulte o veterinário sobre a dieta', 'Observe sinais de sede excessiva ou mudança no volume urinário'],
    vetRecs: ['Confirmar diagnóstico com repetição dos exames', 'Investigar causa subjacente', 'Avaliar proteinúria (UPC) e pressão arterial', 'Considerar biópsia renal se indicado'],
    signs: { tutor: 'Geralmente ausentes', vet: 'Não azotêmico; USG ↓ pode estar presente' },
  },
  2: {
    color: 'amber',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-400',
    ring: 'ring-amber-400',
    label: 'Estágio 2',
    sub: 'Azotemia Leve',
    creat: { cao: '1,4–2,0 mg/dL', gato: '1,6–2,8 mg/dL' },
    sdmaRange: '18–35 μg/dL',
    tutorDesc: 'A função renal está reduzida, mas muitos pets ainda parecem saudáveis. Pode haver aumento na ingestão de água e na produção de urina.',
    vetDesc: 'Azotemia leve. GFR reduzida em ~33-66%. Iniciar manejo específico para DRC.',
    tutorRecs: ['Dieta renal específica (indicada pelo veterinário)', 'Sempre água fresca disponível', 'Monitorar apetite e peso quinzenalmente', 'Retorno veterinário a cada 3-6 meses'],
    vetRecs: ['Tratar hipertensão se PAM ≥ 160 mmHg (RAAS inibidores)', 'Reduzir proteinúria se UPC > 0,5', 'Dieta com restrição de fósforo', 'Reavaliação em 3 meses'],
    signs: { tutor: 'Possível aumento na sede e na urina', vet: 'PU/PD pode estar presente; perda de peso leve' },
  },
  3: {
    color: 'orange',
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-800',
    bar: 'bg-orange-400',
    ring: 'ring-orange-400',
    label: 'Estágio 3',
    sub: 'Azotemia Moderada',
    creat: { cao: '2,1–5,0 mg/dL', gato: '2,9–5,0 mg/dL' },
    sdmaRange: '36–54 μg/dL',
    tutorDesc: 'A função renal está comprometida de forma significativa. Sintomas como náusea, perda de apetite e cansaço podem afetar a qualidade de vida.',
    vetDesc: 'Azotemia moderada. GFR reduzida em >66%. Sinais urêmicos possíveis. Manejo intensivo necessário.',
    tutorRecs: ['Dieta renal estrita — fundamental neste estágio', 'Hidratação subcutânea pode ser indicada', 'Medicamentos antiêmese se houver náusea', 'Retorno veterinário mensal'],
    vetRecs: ['Manejo de sinais urêmicos (antiêmese, protetor gástrico)', 'Quelantes de fósforo se fósforo > referência', 'Considerar eritropoietina se anemia', 'Fluidoterapia subcutânea domiciliar'],
    signs: { tutor: 'Náusea, perda de apetite, perda de peso, letargia', vet: 'Síndrome urêmica inicial; anemia, hiperfosfatemia' },
  },
  4: {
    color: 'red',
    border: 'border-red-200',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-800',
    bar: 'bg-red-500',
    ring: 'ring-red-400',
    label: 'Estágio 4',
    sub: 'Azotemia Grave',
    creat: { cao: '> 5,0 mg/dL', gato: '> 5,0 mg/dL' },
    sdmaRange: '> 54 μg/dL',
    tutorDesc: 'A função renal está gravemente comprometida. Seu pet precisa de cuidados intensivos. Converse com o veterinário sobre as melhores opções de conforto e qualidade de vida.',
    vetDesc: 'Azotemia grave. GFR reduzida em >75%. Crise urêmica iminente. Considerar hospitalização e diálise.',
    tutorRecs: ['Hospitalização pode ser necessária', 'Foco em conforto e qualidade de vida', 'Mantenha comunicação aberta com o veterinário', 'Considere cuidados paliativos'],
    vetRecs: ['Hospitalização e fluidoterapia IV', 'Considerar hemodiálise se disponível', 'Manejo agressivo da uremia', 'Discussão de prognóstico e cuidados paliativos com o tutor'],
    signs: { tutor: 'Vômitos frequentes, prostração, possível recusa alimentar', vet: 'Uremia grave, acidose, hipocalemia, anemia grave' },
  },
} as const

const PROT_META: Record<ProtSubstage, { label: string; color: string; desc: string }> = {
  NP: { label: 'Não Proteinúrico', color: 'bg-emerald-100 text-emerald-700', desc: 'UPC < 0,2 — sem perda proteica significativa' },
  BP: { label: 'Limítrofe', color: 'bg-amber-100 text-amber-700', desc: 'UPC 0,2–0,5 — perda proteica limítrofe, monitorar' },
  P:  { label: 'Proteinúrico', color: 'bg-red-100 text-red-700', desc: 'UPC > 0,5 — perda proteica clinicamente relevante' },
}

const BP_META: Record<BPSubstage, { label: string; color: string; desc: string }> = {
  NT: { label: 'Normotenso', color: 'bg-emerald-100 text-emerald-700', desc: '< 140 mmHg — pressão arterial normal' },
  PH: { label: 'Pré-hipertenso', color: 'bg-amber-100 text-amber-700', desc: '140–159 mmHg — risco baixo de lesão orgânica' },
  H:  { label: 'Hipertenso', color: 'bg-orange-100 text-orange-700', desc: '160–179 mmHg — risco moderado, tratar' },
  SH: { label: 'Hiper. Grave', color: 'bg-red-100 text-red-700', desc: '≥ 180 mmHg — risco alto de lesão orgânica, tratar urgente' },
}

export function IRISStagingModel() {
  const [species, setSpecies] = useState<Species>('cao')
  const [creat, setCreat] = useState('')
  const [sdma, setSdma] = useState('')
  const [upc, setUpc] = useState('')
  const [sbp, setSbp] = useState('')
  const [mode, setMode] = useState<ViewMode>('tutor')

  const result = useMemo<StagingResult | null>(() => {
    const c = parseFloat(creat.replace(',', '.'))
    if (isNaN(c) || c <= 0) return null

    const creatStage = stageFromCreat(species, c)
    const sdmaVal = parseFloat(sdma.replace(',', '.'))
    const sdmaStage = !isNaN(sdmaVal) && sdmaVal > 0 ? stageFromSDMA(sdmaVal) : null
    const stage = sdmaStage ? (Math.max(creatStage, sdmaStage) as Stage) : creatStage
    const basis = sdmaStage
      ? sdmaStage > creatStage ? 'sdma' : sdmaStage === creatStage ? 'ambos' : 'creatinina'
      : 'creatinina'

    const upcVal = parseFloat(upc.replace(',', '.'))
    const sbpVal = parseFloat(sbp.replace(',', '.'))

    return {
      stage,
      basis,
      prot: !isNaN(upcVal) && upcVal >= 0 ? protStage(upcVal) : null,
      bp: !isNaN(sbpVal) && sbpVal > 0 ? bpStage(sbpVal) : null,
    }
  }, [species, creat, sdma, upc, sbp])

  const meta = result ? STAGE_META[result.stage] : null

  return (
    <div className="space-y-8">
      {/* ── Controles ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* Species toggle */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Espécie</p>
            <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
              {(['cao', 'gato'] as Species[]).map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSpecies(sp)}
                  className={`px-5 py-2 text-sm font-semibold transition-colors ${
                    species === sp
                      ? 'bg-brand-500 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {sp === 'cao' ? '🐕 Cão' : '🐈 Gato'}
                </button>
              ))}
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Linguagem</p>
            <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
              {(['tutor', 'vet'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    mode === m ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m === 'tutor' ? '👤 Tutor' : '🩺 Veterinário'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Creatinina sérica *', value: creat, set: setCreat, unit: 'mg/dL', required: true, hint: species === 'cao' ? 'Normal: < 1,4' : 'Normal: < 1,6' },
            { label: 'SDMA', value: sdma, set: setSdma, unit: 'μg/dL', required: false, hint: 'Normal: < 18' },
            { label: 'Razão P:C Urinária (UPC)', value: upc, set: setUpc, unit: '', required: false, hint: 'Normal: < 0,2' },
            { label: 'Pressão arterial sistólica', value: sbp, set: setSbp, unit: 'mmHg', required: false, hint: 'Normal: < 140' },
          ].map(({ label, value, set, unit, required, hint }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {label}
                {!required && <span className="text-slate-400 font-normal ml-1">(opcional)</span>}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                {unit && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Resultado ──────────────────────────────── */}
      {result && meta ? (
        <div className={`rounded-2xl border-2 ${meta.border} ${meta.bg} p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Stage badge */}
            <div className="shrink-0">
              <div className={`h-20 w-20 rounded-2xl flex flex-col items-center justify-center ${meta.badge} ring-4 ${meta.ring}`}>
                <span className="text-3xl font-black leading-none">{result.stage}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">IRIS</span>
              </div>
            </div>

            {/* Stage info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="font-display text-xl font-bold text-slate-900">{meta.label}</h2>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${meta.badge}`}>{meta.sub}</span>
                <span className="text-xs text-slate-400">via {result.basis}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">
                {mode === 'tutor' ? meta.tutorDesc : meta.vetDesc}
              </p>

              {/* Sub-stagings */}
              <div className="flex flex-wrap gap-2">
                {result.prot && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${PROT_META[result.prot].color}`}>
                    <Droplets className="h-3.5 w-3.5" aria-hidden />
                    Proteinúria: {PROT_META[result.prot].label}
                    <span className="font-normal">· {PROT_META[result.prot].desc}</span>
                  </div>
                )}
                {result.bp && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${BP_META[result.bp].color}`}>
                    <Heart className="h-3.5 w-3.5" aria-hidden />
                    PA: {BP_META[result.bp].label}
                    <span className="font-normal">· {BP_META[result.bp].desc}</span>
                  </div>
                )}
              </div>

              {/* Signs */}
              <div className="mt-3 flex items-start gap-2 text-xs text-slate-600 bg-white/60 rounded-xl px-3 py-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden />
                <span>
                  <strong>Sinais clínicos:</strong>{' '}
                  {mode === 'tutor' ? meta.signs.tutor : meta.signs.vet}
                </span>
              </div>
            </div>

            {/* Recommendations */}
            <div className="sm:w-56 shrink-0">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {mode === 'tutor' ? 'O que fazer' : 'Conduta recomendada'}
              </p>
              <ul className="space-y-1.5">
                {(mode === 'tutor' ? meta.tutorRecs : meta.vetRecs).map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <Activity className="h-10 w-10 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-slate-500 font-medium text-sm">Insira a creatinina sérica para calcular o estadiamento</p>
          <p className="text-slate-400 text-xs mt-1">Os demais campos são opcionais e refinam o resultado</p>
        </div>
      )}

      {/* ── Progressão visual — todos os estágios ──── */}
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Progressão da Doença Renal Crônica</h2>
        <p className="text-slate-500 text-sm mb-5">
          Como a DRC avança ao longo do tempo segundo as diretrizes IRIS 2023
        </p>

        {/* Progress bar */}
        <div className="relative flex h-2 rounded-full overflow-hidden mb-8">
          {([1, 2, 3, 4] as Stage[]).map((s) => (
            <div
              key={s}
              className={`flex-1 transition-all duration-500 ${STAGE_META[s].bar} ${
                result && result.stage === s ? 'opacity-100' : result ? 'opacity-30' : 'opacity-60'
              }`}
            />
          ))}
        </div>

        {/* Stage indicators over bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([1, 2, 3, 4] as Stage[]).map((s) => {
            const m = STAGE_META[s]
            const isActive = result?.stage === s
            const isPast = result ? s < result.stage : false
            const isFuture = result ? s > result.stage : false

            return (
              <div
                key={s}
                className={`relative rounded-2xl border-2 p-4 transition-all duration-300 ${
                  isActive
                    ? `${m.border} ${m.bg} shadow-lg ring-2 ${m.ring} ring-offset-2`
                    : isPast
                    ? `${m.border} ${m.bg} opacity-50`
                    : isFuture
                    ? 'border-slate-100 bg-slate-50 opacity-60'
                    : 'border-slate-100 bg-white'
                }`}
              >
                {/* Status icon */}
                {isPast && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  </div>
                )}
                {isActive && (
                  <div className="absolute top-3 right-3">
                    <span className={`flex h-3 w-3`}>
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${m.bar} opacity-50`} />
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${m.bar}`} />
                    </span>
                  </div>
                )}
                {isFuture && (
                  <div className="absolute top-3 right-3">
                    <AlertTriangle className="h-4 w-4 text-slate-300" />
                  </div>
                )}

                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${m.badge}`}>
                  Estágio {s}
                </span>
                <p className="font-display font-bold text-sm text-slate-900 leading-tight">{m.sub}</p>
                <p className="text-[11px] text-slate-500 mt-1">{m.creat[species]}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">SDMA {m.sdmaRange}</p>

                <div className="mt-3 pt-3 border-t border-slate-100/80">
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                    {mode === 'tutor' ? m.tutorDesc : m.vetDesc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Sub-estadiamentos ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Proteinúria */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="h-4 w-4 text-brand-500" aria-hidden />
            <h3 className="font-semibold text-slate-900 text-sm">Sub-estadiamento por Proteinúria (UPC)</h3>
          </div>
          <div className="space-y-2">
            {(Object.entries(PROT_META) as [ProtSubstage, typeof PROT_META[ProtSubstage]][]).map(([key, val]) => (
              <div key={key} className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                result?.prot === key ? val.color + ' ring-1 ring-current' : 'bg-slate-50'
              }`}>
                <span className="text-xs font-semibold">{val.label}</span>
                <span className="text-xs text-slate-500">{val.desc.split('—')[0].trim()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pressão arterial */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-4 w-4 text-rose-500" aria-hidden />
            <h3 className="font-semibold text-slate-900 text-sm">Sub-estadiamento por Pressão Arterial</h3>
          </div>
          <div className="space-y-2">
            {(Object.entries(BP_META) as [BPSubstage, typeof BP_META[BPSubstage]][]).map(([key, val]) => (
              <div key={key} className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                result?.bp === key ? val.color + ' ring-1 ring-current' : 'bg-slate-50'
              }`}>
                <span className="text-xs font-semibold">{val.label}</span>
                <span className="text-xs text-slate-500">{val.desc.split('—')[0].trim()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
