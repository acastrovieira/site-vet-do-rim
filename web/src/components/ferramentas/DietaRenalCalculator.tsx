'use client'

import { useState } from 'react'
import {
  calcularDietaRenal,
  calcularDietaMultimarca,
  estimarPesoIdeal,
  ECC_DESCRICOES,
  MARCAS_LABELS,
  MARCAS_CORES,
  type Especie,
  type ECC,
  type Marca,
  type ResultadoDieta,
} from '@/lib/dieta-renal-calculator'
import {
  UtensilsCrossed,
  ChevronDown,
  ArrowRight,
  AlertTriangle,
  Info,
  Layers,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

// ─── Marcas disponíveis ───────────────────────────────────────────────────────

const MARCAS: Marca[] = ['royal-canin', 'hills', 'premier', 'vetlife']

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function InputField({
  id, label, hint, required, children,
}: {
  id: string; label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-brand-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function EccSelector({
  value,
  onChange,
}: {
  value: ECC | ''
  onChange: (v: ECC) => void
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 hover:bg-slate-50 transition-colors"
        aria-expanded={aberto}
        aria-haspopup="listbox"
      >
        {value ? (
          <span className={`font-medium ${ECC_DESCRICOES[value].cor}`}>
            {ECC_DESCRICOES[value].label}
          </span>
        ) : (
          <span className="text-slate-400">Selecione o ECC (1–9)…</span>
        )}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {aberto && (
        <div
          role="listbox"
          className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/60 z-30 overflow-hidden max-h-72 overflow-y-auto"
        >
          {(Object.entries(ECC_DESCRICOES) as [string, { label: string; descricao: string; cor: string }][]).map(
            ([ecc, info]) => (
              <button
                key={ecc}
                type="button"
                role="option"
                aria-selected={value === Number(ecc)}
                onClick={() => {
                  onChange(Number(ecc) as ECC)
                  setAberto(false)
                }}
                className={`w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors border-b border-slate-50 last:border-0 ${
                  value === Number(ecc) ? 'bg-orange-50' : ''
                }`}
              >
                <p className={`text-sm font-semibold ${info.cor}`}>{info.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{info.descricao}</p>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card de resultado por marca ──────────────────────────────────────────────

function ResultadoCard({
  resultado,
  destaque = false,
}: {
  resultado: ResultadoDieta
  destaque?: boolean
}) {
  const cores = MARCAS_CORES[resultado.marca]

  return (
    <div
      className={`rounded-2xl border-2 p-5 transition-all ${destaque ? `${cores.bg} ${cores.border} shadow-sm` : 'border-slate-100 bg-white'}`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cores.bg} ${cores.border} border ${cores.text}`}>
            {resultado.nomeMarca}
          </span>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">{resultado.nomeLinha}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="font-display font-bold text-2xl text-slate-900">{resultado.gramsPerDay}</p>
          <p className="text-xs text-slate-400 font-medium">g/dia</p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Por refeição', value: `${resultado.gramsPerRefeicao}g` },
          { label: 'Refeições/dia', value: resultado.refeicoesPerDay.toString() },
          { label: 'Total kcal', value: `${resultado.kcalTotal} kcal` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/80 rounded-xl border border-slate-100 p-2.5 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Copo medidor */}
      {resultado.coposMedidores && (
        <div className="flex items-center gap-2 text-xs text-slate-600 mb-3 px-3 py-2 bg-slate-50 rounded-xl">
          <UtensilsCrossed className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden />
          <span>≈ <strong>{resultado.coposMedidores}</strong> copos medidores/dia (copo do fabricante)</span>
        </div>
      )}

      {/* Nota + advertência */}
      {resultado.nota && (
        <div className="flex items-start gap-2 text-xs text-slate-500 mb-2">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden />
          <span>{resultado.nota}</span>
        </div>
      )}
      {resultado.advertencia && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>{resultado.advertencia}</span>
        </div>
      )}

      {/* Link fabricante */}
      {resultado.urlProduto && (
        <a
          href={resultado.urlProduto}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-xs font-semibold mt-1 hover:underline ${cores.text}`}
        >
          Ver produto no site do fabricante
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface FormState {
  especie: Especie | ''
  pesoKg: string
  ecc: ECC | ''
  marca: Marca | 'todas'
  refeicoes: '1' | '2' | '3'
}

const FORM_INICIAL: FormState = {
  especie: '',
  pesoKg: '',
  ecc: '',
  marca: 'todas',
  refeicoes: '2',
}

/**
 * Calculadora de dieta terapêutica renal com suporte a múltiplas marcas.
 * Ferramenta gratuita para tutores e médicos veterinários.
 */
export function DietaRenalCalculator() {
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [erros, setErros] = useState<Partial<Record<keyof FormState, string>>>({})
  const [resultados, setResultados] = useState<ResultadoDieta[] | null>(null)
  const [calculando, setCalculando] = useState(false)

  function validar(): boolean {
    const e: typeof erros = {}
    if (!form.especie) e.especie = 'Selecione a espécie'
    const peso = parseFloat(form.pesoKg)
    if (isNaN(peso) || peso <= 0 || peso > 200) e.pesoKg = 'Peso inválido (0,1–200 kg)'
    if (!form.ecc) e.ecc = 'Selecione o ECC'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleCalcular(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return

    setCalculando(true)
    await new Promise((r) => setTimeout(r, 500))

    const especie = form.especie as Especie
    const pesoAtualKg = parseFloat(form.pesoKg)
    const ecc = Number(form.ecc) as ECC
    const refeicoesPerDay = Number(form.refeicoes)

    if (form.marca === 'todas') {
      const { resultados: res } = calcularDietaMultimarca({ especie, pesoAtualKg, ecc, refeicoesPerDay })
      setResultados(res)
    } else {
      const res = calcularDietaRenal({ especie, pesoAtualKg, ecc, marca: form.marca, refeicoesPerDay })
      setResultados([res])
    }

    setCalculando(false)
  }

  function handleReset() {
    setForm(FORM_INICIAL)
    setErros({})
    setResultados(null)
  }

  // Peso ideal estimado para exibir no painel de resultado
  const pesoIdeal =
    form.ecc && form.pesoKg
      ? estimarPesoIdeal(parseFloat(form.pesoKg) || 0, Number(form.ecc) as ECC)
      : null

  const ajustouPeso = pesoIdeal !== null && form.pesoKg && Math.abs(pesoIdeal - parseFloat(form.pesoKg)) > 0.05

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <form onSubmit={handleCalcular} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Espécie */}
            <InputField id="especie" label="Espécie" required>
              <select
                id="especie"
                value={form.especie}
                onChange={(e) => {
                  setForm({ ...form, especie: e.target.value as Especie })
                  setResultados(null)
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="">Selecione…</option>
                <option value="cao">Cão</option>
                <option value="gato">Gato</option>
              </select>
              {erros.especie && <p className="mt-1 text-xs text-red-600">{erros.especie}</p>}
            </InputField>

            {/* Peso */}
            <InputField
              id="pesoKg"
              label="Peso atual (kg)"
              hint="Peso registrado na consulta"
              required
            >
              <input
                id="pesoKg"
                type="number"
                step="0.05"
                min="0.1"
                max="200"
                value={form.pesoKg}
                onChange={(e) => { setForm({ ...form, pesoKg: e.target.value }); setResultados(null) }}
                placeholder="Ex: 8.5"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {erros.pesoKg && <p className="mt-1 text-xs text-red-600">{erros.pesoKg}</p>}
            </InputField>

            {/* ECC */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Escore de Condição Corporal (ECC) <span className="text-brand-500">*</span>
              </label>
              <EccSelector
                value={form.ecc}
                onChange={(v) => { setForm({ ...form, ecc: v }); setResultados(null) }}
              />
              {erros.ecc && <p className="mt-1 text-xs text-red-600">{erros.ecc}</p>}

              {/* Preview do ajuste de peso */}
              {pesoIdeal !== null && form.pesoKg && !isNaN(parseFloat(form.pesoKg)) && (
                <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${ajustouPeso ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {ajustouPeso
                    ? `ECC indica sobrepeso — o cálculo usará peso ideal estimado de ${pesoIdeal.toFixed(1)} kg`
                    : `ECC ideal — o cálculo usará o peso atual de ${pesoIdeal.toFixed(1)} kg`}
                </div>
              )}
            </div>

            {/* Marca */}
            <InputField id="marca" label="Marca da dieta" hint="Selecione uma marca ou compare todas">
              <select
                id="marca"
                value={form.marca}
                onChange={(e) => { setForm({ ...form, marca: e.target.value as Marca | 'todas' }); setResultados(null) }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="todas">🔄 Comparar todas as marcas</option>
                {MARCAS.map((m) => (
                  <option key={m} value={m}>{MARCAS_LABELS[m]}</option>
                ))}
              </select>
            </InputField>

            {/* Refeições */}
            <InputField id="refeicoes" label="Refeições por dia">
              <select
                id="refeicoes"
                value={form.refeicoes}
                onChange={(e) => { setForm({ ...form, refeicoes: e.target.value as '1' | '2' | '3' }); setResultados(null) }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="1">1 refeição/dia</option>
                <option value="2">2 refeições/dia</option>
                <option value="3">3 refeições/dia</option>
              </select>
            </InputField>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={calculando}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-all duration-200 shadow-lg shadow-orange-500/20 disabled:opacity-60"
            >
              {calculando ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Calculando…
                </span>
              ) : (
                <>
                  <UtensilsCrossed className="h-4 w-4" aria-hidden />
                  Calcular quantidade diária
                </>
              )}
            </button>
            {resultados && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                title="Recalcular"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Resultados */}
      {resultados && (
        <div aria-live="polite" className="space-y-4">
          {/* Painel de resumo */}
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[10px] text-orange-600 uppercase tracking-wider font-semibold mb-0.5">Espécie</p>
                <p className="font-bold text-orange-900">{form.especie === 'cao' ? 'Cão' : 'Gato'}</p>
              </div>
              <div>
                <p className="text-[10px] text-orange-600 uppercase tracking-wider font-semibold mb-0.5">Peso atual</p>
                <p className="font-bold text-orange-900">{parseFloat(form.pesoKg).toFixed(2)} kg</p>
              </div>
              {ajustouPeso && pesoIdeal !== null && (
                <div>
                  <p className="text-[10px] text-orange-600 uppercase tracking-wider font-semibold mb-0.5">Peso ideal usado</p>
                  <p className="font-bold text-orange-900">{pesoIdeal.toFixed(1)} kg</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-orange-600 uppercase tracking-wider font-semibold mb-0.5">ECC</p>
                <p className="font-bold text-orange-900">{form.ecc} — {form.ecc ? ECC_DESCRICOES[form.ecc as ECC].label.split(' — ')[1] : ''}</p>
              </div>
            </div>

            {ajustouPeso && (
              <div className="mt-3 flex items-start gap-2 text-xs text-orange-800 border-t border-orange-200 pt-3">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                <span>
                  O ECC indicou sobrepeso. A quantidade foi calculada com base no <strong>peso ideal estimado</strong>{' '}
                  ({pesoIdeal?.toFixed(1)} kg) para evitar superalimentação calórica.
                </span>
              </div>
            )}
          </div>

          {/* Cards de resultado */}
          {resultados.length === 1 ? (
            <ResultadoCard resultado={resultados[0]} destaque />
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Layers className="h-4 w-4 text-slate-400" aria-hidden />
                <span className="font-medium">Comparativo entre {resultados.length} marcas</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultados.map((r) => (
                  <ResultadoCard key={r.marca} resultado={r} />
                ))}
              </div>
            </>
          )}

          {/* CTA Lab */}
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)' }}
          >
            <p className="text-white font-semibold text-sm mb-3">
              Salve este cálculo no prontuário do paciente
            </p>
            <a
              href="/lab"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-orange-700 font-bold text-sm hover:bg-orange-50 transition-colors"
            >
              Acessar Lab Evolution
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      )}

      {/* Disclaimer do fabricante */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Aviso importante:</strong> As quantidades são estimativas baseadas nos guias nutricionais dos fabricantes (mai/2025). 
          Formulações mudam — <strong>sempre confira a tabela de alimentação na embalagem atual do produto</strong>. 
          Ajuste a quantidade conforme a resposta clínica e a orientação do médico veterinário responsável.
        </p>
      </div>

      {/* Indicações das marcas */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="font-display font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-brand-500" aria-hidden />
          Sobre as dietas terapêuticas renais
        </h3>
        <ul className="space-y-2">
          {[
            'Restrição de fósforo — reduz progressão da mineralização renal',
            'Proteína de alta digestibilidade — mantém massa muscular com menor carga nitrogenada',
            'Adição de ácidos graxos ômega-3 — efeito anti-inflamatório renal',
            'Sódio controlado — suporte à pressão arterial em hipertensos',
            'Potássio suplementado — previne hipocalemia em gatos',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-xs text-slate-600">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-500 mt-0.5 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
          Referência: Bartges JW, Polzin DJ. <em>Nephrology and Urology of Small Animals</em>, 2011. Diretrizes IRIS 2023.
        </p>
      </div>
    </div>
  )
}
