'use client'

import { useState, useCallback } from 'react'
import {
  salvarPeso,
  listarPesos,
  deletarPeso,
  downloadCSV,
  limparHistorico,
  type RegistroPeso,
} from '@/lib/peso-controller'
import type { Especie, ECC } from '@/lib/dieta-renal-calculator'
import { ECC_DESCRICOES } from '@/lib/dieta-renal-calculator'
import {
  Scale,
  Plus,
  Trash2,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  X,
  PawPrint,
} from 'lucide-react'

// ─── Mini gráfico SVG de linha ─────────────────────────────────────────────

function MiniLineChart({ dados }: { dados: { data: string; peso: number }[] }) {
  if (dados.length < 2) return null

  const ordered = [...dados].sort((a, b) => a.data.localeCompare(b.data))
  const pesos = ordered.map((d) => d.peso)
  const minP = Math.min(...pesos)
  const maxP = Math.max(...pesos)
  const range = maxP - minP || 1

  const W = 320
  const H = 90
  const PAD = 16

  const points = ordered.map((d, i) => {
    const x = PAD + (i / (ordered.length - 1)) * (W - PAD * 2)
    const y = PAD + ((maxP - d.peso) / range) * (H - PAD * 2)
    return { x, y, ...d }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const fillD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${H} L ${points[0].x.toFixed(1)} ${H} Z`

  const trend = pesos[pesos.length - 1] - pesos[0]
  const strokeColor = trend < -0.1 ? '#16a34a' : trend > 0.1 ? '#dc2626' : '#0ea5e9'
  const fillColor = trend < -0.1 ? '#16a34a22' : trend > 0.1 ? '#dc262622' : '#0ea5e922'

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" aria-hidden>
        <path d={fillD} fill={fillColor} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={strokeColor} stroke="white" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
        <span>{ordered[0].data.slice(5).replace('-', '/')}</span>
        <span className="font-semibold text-slate-600">
          {ordered[ordered.length - 1].peso.toFixed(1)} kg
        </span>
        <span>{ordered[ordered.length - 1].data.slice(5).replace('-', '/')}</span>
      </div>
    </div>
  )
}

// ─── Badge de Tendência ────────────────────────────────────────────────────

function TendenciaBadge({ atual, anterior }: { atual: number; anterior: number }) {
  const diff = atual - anterior
  const pct = Math.abs((diff / anterior) * 100).toFixed(1)

  if (Math.abs(diff) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
        <Minus className="h-3 w-3" aria-hidden /> Estável
      </span>
    )
  }

  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <TrendingDown className="h-3 w-3" aria-hidden /> -{pct}%
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <TrendingUp className="h-3 w-3" aria-hidden /> +{pct}%
    </span>
  )
}

// ─── Formulário de Registro ────────────────────────────────────────────────

interface FormState {
  nomePaciente: string
  especie: Especie | ''
  pesoKg: string
  ecc: ECC | ''
  data: string
  observacoes: string
}

const FORM_INICIAL: FormState = {
  nomePaciente: '',
  especie: '',
  pesoKg: '',
  ecc: '',
  data: new Date().toISOString().slice(0, 10),
  observacoes: '',
}

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

// ─── Componente Principal ──────────────────────────────────────────────────

export function ControlePesoTool() {
  const [registros, setRegistros] = useState<RegistroPeso[]>(() => listarPesos())
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [erros, setErros] = useState<Partial<Record<keyof FormState, string>>>({})
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmLimpar, setConfirmLimpar] = useState(false)
  const [eccAberto, setEccAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregarRegistros = useCallback(() => {
    setRegistros(listarPesos())
  }, [])

  function validar(): boolean {
    const e: typeof erros = {}
    if (!form.especie) e.especie = 'Selecione a espécie'
    const peso = parseFloat(form.pesoKg)
    if (isNaN(peso) || peso <= 0 || peso > 200) e.pesoKg = 'Peso inválido (0,1–200 kg)'
    if (!form.ecc) e.ecc = 'Selecione o ECC'
    if (!form.data) e.data = 'Informe a data'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return
    setSalvando(true)
    await new Promise((r) => setTimeout(r, 300))
    salvarPeso({
      nomePaciente: form.nomePaciente || undefined,
      especie: form.especie as Especie,
      pesoKg: parseFloat(form.pesoKg),
      ecc: Number(form.ecc) as ECC,
      data: form.data,
      observacoes: form.observacoes || undefined,
    })
    setForm(FORM_INICIAL)
    setErros({})
    setMostrarForm(false)
    setSalvando(false)
    carregarRegistros()
  }

  function handleDeletar(id: string) {
    deletarPeso(id)
    carregarRegistros()
  }

  function handleLimpar() {
    limparHistorico()
    setConfirmLimpar(false)
    carregarRegistros()
  }

  const chartDados = registros.slice(0, 20).map((r) => ({ data: r.data, peso: r.pesoKg }))

  const especiesLabel: Record<Especie, string> = { cao: 'Cão', gato: 'Gato' }

  return (
    <div className="space-y-6">
      {/* Header da ferramenta */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-5 w-5 text-teal-600" aria-hidden />
            <h2 className="font-display font-bold text-slate-900">Histórico de Peso</h2>
            {registros.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                {registros.length} registro{registros.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Acompanhe a evolução do peso e do ECC ao longo do tempo
          </p>
        </div>
        <div className="flex gap-2">
          {registros.length > 0 && (
            <button
              onClick={() => downloadCSV(registros)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              title="Exportar CSV"
            >
              <Download className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          )}
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Registrar Peso
          </button>
        </div>
      </div>

      {/* Formulário de registro */}
      {mostrarForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-semibold text-slate-900">Novo Registro</h3>
            <button onClick={() => setMostrarForm(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <form onSubmit={handleSalvar} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nome do paciente */}
              <InputField id="nomePaciente" label="Nome do paciente" hint="Opcional — ex: Thor">
                <input
                  id="nomePaciente"
                  value={form.nomePaciente}
                  onChange={(e) => setForm({ ...form, nomePaciente: e.target.value })}
                  placeholder="Ex: Thor, Mia…"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </InputField>

              {/* Data */}
              <InputField id="data" label="Data" required>
                <input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {erros.data && <p className="mt-1 text-xs text-red-600">{erros.data}</p>}
              </InputField>

              {/* Espécie */}
              <InputField id="especie" label="Espécie" required>
                <select
                  id="especie"
                  value={form.especie}
                  onChange={(e) => setForm({ ...form, especie: e.target.value as Especie })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="">Selecione…</option>
                  <option value="cao">Cão</option>
                  <option value="gato">Gato</option>
                </select>
                {erros.especie && <p className="mt-1 text-xs text-red-600">{erros.especie}</p>}
              </InputField>

              {/* Peso */}
              <InputField id="pesoKg" label="Peso atual (kg)" required>
                <input
                  id="pesoKg"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="200"
                  value={form.pesoKg}
                  onChange={(e) => setForm({ ...form, pesoKg: e.target.value })}
                  placeholder="Ex: 8.5"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {erros.pesoKg && <p className="mt-1 text-xs text-red-600">{erros.pesoKg}</p>}
              </InputField>

              {/* ECC com dropdown visual */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Escore de Condição Corporal (ECC) <span className="text-brand-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEccAberto(!eccAberto)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 hover:bg-slate-50 transition-colors"
                  >
                    {form.ecc
                      ? <span className={ECC_DESCRICOES[form.ecc as ECC].cor + ' font-medium'}>{ECC_DESCRICOES[form.ecc as ECC].label}</span>
                      : <span className="text-slate-400">Selecione o ECC (1–9)…</span>
                    }
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${eccAberto ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                  {eccAberto && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                      {(Object.entries(ECC_DESCRICOES) as [string, { label: string; descricao: string; cor: string }][]).map(([ecc, info]) => (
                        <button
                          key={ecc}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, ecc: Number(ecc) as ECC })
                            setEccAberto(false)
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${form.ecc === Number(ecc) ? 'bg-teal-50' : ''}`}
                        >
                          <p className={`text-sm font-semibold ${info.cor}`}>{info.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{info.descricao}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {erros.ecc && <p className="mt-1 text-xs text-red-600">{erros.ecc}</p>}
              </div>

              {/* Observações */}
              <div className="sm:col-span-2">
                <InputField id="observacoes" label="Observações" hint="Opcional — condição clínica, eventos relevantes…">
                  <textarea
                    id="observacoes"
                    rows={2}
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    placeholder="Ex: Consulta de retorno, paciente hidratado…"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </InputField>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="submit"
                disabled={salvando}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-60"
              >
                {salvando ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Salvando…
                  </span>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Salvar Registro
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setMostrarForm(false); setForm(FORM_INICIAL); setErros({}) }}
                className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Gráfico de evolução */}
      {registros.length >= 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-teal-600" aria-hidden />
            <h3 className="font-display font-semibold text-slate-900 text-sm">Evolução do Peso</h3>
          </div>
          <p className="text-xs text-slate-400 mb-2">Últimos {Math.min(registros.length, 20)} registros</p>
          <MiniLineChart dados={chartDados} />
        </div>
      )}

      {/* Estado vazio */}
      {registros.length === 0 && !mostrarForm && (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 mx-auto mb-4">
            <PawPrint className="h-7 w-7 text-teal-500" aria-hidden />
          </div>
          <h3 className="font-display font-semibold text-slate-700 mb-2">Nenhum registro ainda</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mb-5">
            Registre o primeiro peso para começar o acompanhamento evolutivo do seu paciente.
          </p>
          <button
            onClick={() => setMostrarForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Registrar primeiro peso
          </button>
        </div>
      )}

      {/* Tabela de registros */}
      {registros.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-display font-semibold text-slate-900 text-sm">Registros</h3>
            <button
              onClick={() => setConfirmLimpar(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Limpar tudo
            </button>
          </div>

          {/* Confirmação de limpar */}
          {confirmLimpar && (
            <div className="mx-4 my-3 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" aria-hidden />
              <p className="text-sm text-red-700 flex-1">
                Apagar todos os {registros.length} registros? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <button onClick={handleLimpar} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors">
                  Apagar tudo
                </button>
                <button onClick={() => setConfirmLimpar(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-50">
            {registros.map((r, i) => {
              const anterior = registros[i + 1]
              return (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  {/* Data */}
                  <div className="w-24 shrink-0">
                    <p className="text-xs font-semibold text-slate-700">
                      {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(r.data + 'T12:00:00').getFullYear()}
                    </p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.nomePaciente && (
                        <span className="text-sm font-semibold text-slate-800">{r.nomePaciente}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                        {especiesLabel[r.especie]}
                      </span>
                      <span className={`text-[10px] font-semibold ${ECC_DESCRICOES[r.ecc].cor}`}>
                        ECC {r.ecc}
                      </span>
                    </div>
                    {r.observacoes && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{r.observacoes}</p>
                    )}
                  </div>

                  {/* Peso + tendência */}
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-slate-900">{r.pesoKg.toFixed(2)} <span className="text-xs font-normal text-slate-400">kg</span></p>
                    {anterior && <TendenciaBadge atual={r.pesoKg} anterior={anterior.pesoKg} />}
                  </div>

                  {/* Deletar */}
                  <button
                    onClick={() => handleDeletar(r.id)}
                    className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remover registro"
                    aria-label="Remover registro"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Aviso de privacidade */}
      <p className="text-center text-xs text-slate-400 leading-relaxed">
        🔒 Todos os dados ficam armazenados apenas neste navegador (localStorage). Nenhuma informação é enviada para servidores.
      </p>
    </div>
  )
}
