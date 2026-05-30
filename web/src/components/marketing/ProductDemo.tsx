'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  Users,
  FlaskConical,
  Activity,
  Calculator,
  Brain,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'

/* ── Cenas do demo ────────────────────────────────────────────── */

function SceneDashboard() {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs text-white/50">Bem-vindo de volta</p>
          <p className="font-display font-semibold text-white text-sm">Bom dia, Dra. Ana Castro 👋</p>
        </div>
        <div className="h-7 w-7 rounded-full bg-gold-400/20 border border-gold-400/30 flex items-center justify-center text-gold-400 text-[10px] font-bold">AC</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Users, label: 'Tutores', value: '24', color: 'text-blue-400 bg-blue-500/10' },
          { icon: FlaskConical, label: 'Pacientes', value: '38', color: 'text-emerald-400 bg-emerald-500/10' },
          { icon: Activity, label: 'Consultas', value: '12', color: 'text-violet-400 bg-violet-500/10' },
          { icon: TrendingUp, label: 'Adesão', value: '94%', color: 'text-gold-400 bg-gold-400/10' },
        ].map(({ icon: Icon, label, value, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-3 rounded-xl border border-white/5 bg-white/5 flex items-center gap-2"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-base font-bold text-white font-display">{value}</p>
              <p className="text-[10px] text-white/40">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex-1 rounded-xl border border-white/5 bg-white/5 p-3"
      >
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Pacientes recentes</p>
        {[
          { nome: 'Thor', especie: 'Labrador, 9a', status: 'DRC Est. 3' },
          { nome: 'Mimi', especie: 'Persa, 12a', status: 'Pós-obstrução' },
          { nome: 'Bella', especie: 'Shih-tzu, 7a', status: 'Acompanhamento' },
        ].map((p, i) => (
          <motion.div
            key={p.nome}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0"
          >
            <div className="h-6 w-6 rounded-full bg-brand-500/20 text-brand-300 text-[10px] font-bold flex items-center justify-center shrink-0">
              {p.nome[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{p.nome}</p>
              <p className="text-[10px] text-white/40 truncate">{p.especie}</p>
            </div>
            <span className="text-[10px] text-gold-400 font-medium shrink-0">{p.status}</span>
            <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

function SceneCadastro() {
  const [typed, setTyped] = useState('')
  const fullName = 'Ana Paula Ferreira'

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i < fullName.length) {
        setTyped(fullName.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
      }
    }, 60)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded-lg bg-brand-500/20 flex items-center justify-center">
          <Users className="w-3.5 h-3.5 text-brand-400" />
        </div>
        <p className="font-display font-semibold text-white text-sm">Novo Tutor</p>
      </div>

      {[
        { label: 'Nome completo *', value: typed, placeholder: 'Digitando...', isAnimated: true },
        { label: 'Telefone *', value: '(27) 99912-3456', placeholder: '', isAnimated: false },
        { label: 'E-mail', value: 'ana.ferreira@email.com', placeholder: '', isAnimated: false },
        { label: 'Cidade', value: 'Vitória, ES', placeholder: '', isAnimated: false },
      ].map(({ label, value, placeholder, isAnimated }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.12 }}
        >
          <p className="text-[10px] text-white/40 mb-1">{label}</p>
          <div className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white flex items-center gap-1">
            {value || <span className="text-white/20">{placeholder}</span>}
            {isAnimated && typed.length < fullName.length && (
              <span className="inline-block w-0.5 h-3.5 bg-gold-400 animate-pulse ml-0.5" />
            )}
          </div>
        </motion.div>
      ))}

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-2 w-full py-2.5 rounded-xl bg-brand-500 text-white text-xs font-semibold flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Salvar tutor
      </motion.button>
    </div>
  )
}

function SceneTFG() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      let p = 0
      const i = setInterval(() => {
        p += 4
        setProgress(Math.min(p, 100))
        if (p >= 100) clearInterval(i)
      }, 30)
      return () => clearInterval(i)
    }, 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Calculator className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <p className="font-display font-semibold text-white text-sm">Calculadora TFG</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Creatinina', value: '2.8 mg/dL' },
          { label: 'Espécie', value: 'Canino' },
          { label: 'Peso', value: '28 kg' },
          { label: 'Idade', value: '9 anos' },
        ].map(({ label, value }) => (
          <div key={label} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">
            <p className="text-[10px] text-white/40">{label}</p>
            <p className="text-xs font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-white/40">Calculando TFG…</p>
          <p className="text-[10px] text-gold-400 font-semibold">{progress}%</p>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-gold-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {progress >= 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center"
        >
          <p className="text-[10px] text-emerald-400/70 mb-0.5">TFG Estimada</p>
          <p className="text-2xl font-bold font-display text-emerald-400">23,4 <span className="text-sm font-normal">mL/min</span></p>
          <p className="text-[10px] text-white/40 mt-1">IRIS DRC — Estágio 3</p>
        </motion.div>
      )}
    </div>
  )
}

function SceneLaudo() {
  const linhas = [
    '→ Creatinina: 2.8 mg/dL ↑ (referência: 0.5–1.4)',
    '→ BUN: 68 mg/dL ↑↑',
    '→ Fósforo: 6.2 mg/dL ↑',
    '→ TFG estimada: 23,4 mL/min',
    '→ SDMA: 25 µg/dL ↑',
    '',
    '✓ Compatível com DRC Estágio 3 IRIS',
    '✓ Recomenda: dieta hipofosfatada',
    '✓ Monitorar PA e proteinúria (UPC)',
  ]
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const i = setInterval(() => {
      setShown((s) => (s < linhas.length ? s + 1 : s))
    }, 220)
    return () => clearInterval(i)
  }, [linhas.length])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Brain className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <p className="font-display font-semibold text-white text-sm">IA — Análise do Laudo</p>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20">Processando…</span>
      </div>

      <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-[10px] leading-relaxed text-white/70 min-h-[120px]">
        {linhas.slice(0, shown).map((linha, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className={linha.startsWith('✓') ? 'text-emerald-400' : linha.startsWith('→') ? 'text-white/70' : ''}
          >
            {linha || '\u00A0'}
          </motion.div>
        ))}
        {shown < linhas.length && (
          <span className="inline-block w-1.5 h-3 bg-violet-400 animate-pulse" />
        )}
      </div>
    </div>
  )
}

function SceneHistorico() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded-lg bg-gold-400/20 flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-gold-400" />
        </div>
        <p className="font-display font-semibold text-white text-sm">Histórico — Thor</p>
        <span className="ml-auto text-[10px] text-gold-400">DRC Est. 3</span>
      </div>

      <div className="space-y-2">
        {[
          { data: 'Jan/26', creat: '3.2', tfg: '19.1', cor: 'text-red-400' },
          { data: 'Fev/26', creat: '3.0', tfg: '21.3', cor: 'text-amber-400' },
          { data: 'Mar/26', creat: '2.9', tfg: '22.5', cor: 'text-amber-400' },
          { data: 'Abr/26', creat: '2.8', tfg: '23.4', cor: 'text-emerald-400' },
        ].map(({ data, creat, tfg, cor }, i) => (
          <motion.div
            key={data}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/5 bg-white/5"
          >
            <span className="text-[10px] text-white/40 w-10 shrink-0">{data}</span>
            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cor === 'text-emerald-400' ? 'bg-emerald-400' : cor === 'text-amber-400' ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${(parseFloat(tfg) / 30) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-xs font-bold ${cor}`}>{tfg}</p>
              <p className="text-[9px] text-white/30">mL/min</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
      >
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <p className="text-[10px] text-emerald-400">
          <strong>Tendência positiva:</strong> TFG melhorou 23% em 4 meses
        </p>
      </motion.div>
    </div>
  )
}

/* ── Sequência de cenas ──────────────────────────────────────── */

const cenas = [
  { id: 'dashboard', label: 'Dashboard', Component: SceneDashboard },
  { id: 'cadastro', label: 'Cadastro', Component: SceneCadastro },
  { id: 'tfg', label: 'Calculadora TFG', Component: SceneTFG },
  { id: 'laudo', label: 'Análise IA', Component: SceneLaudo },
  { id: 'historico', label: 'Histórico', Component: SceneHistorico },
]

const CENA_DURATION = 4000

/**
 * Demo animado do produto — 5 cenas em sequência simulando a navegação no Lab Evolution.
 * Funciona como um "vídeo de propaganda" mas totalmente em código.
 */
export function ProductDemo() {
  const [cenaIdx, setCenaIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)

  const goTo = useCallback((idx: number) => {
    setCenaIdx(idx)
    setProgress(0)
  }, [])

  useEffect(() => {
    if (!playing) return
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / CENA_DURATION) * 100, 100)
      setProgress(pct)
      if (pct >= 100) {
        setCenaIdx((c) => (c + 1) % cenas.length)
        setProgress(0)
      }
    }, 50)
    return () => clearInterval(tick)
  }, [playing, cenaIdx])

  const { Component } = cenas[cenaIdx]

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Frame browser */}
      <div
        className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40"
        style={{ background: 'rgba(10, 12, 20, 0.95)' }}
      >
        {/* Barra superior do browser */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5" style={{ background: 'rgba(15,17,25,0.8)' }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <div className="flex-1 mx-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/5 max-w-xs mx-auto">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-[10px] text-white/30 truncate">vetdorim.com.br/lab</span>
            </div>
          </div>
          {/* Tab ativa */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-t-lg border-x border-t border-white/10 bg-white/5 text-[10px] text-white/50">
            <span className="w-2 h-2 rounded-sm bg-brand-400/60" />
            Lab Evolution
          </div>
        </div>

        {/* Sidebar simulada */}
        <div className="flex">
          <div className="hidden sm:flex flex-col gap-1 p-3 border-r border-white/5 w-36 shrink-0" style={{ background: 'rgba(12,14,22,0.9)' }}>
            {cenas.map(({ id, label }, i) => (
              <button
                key={id}
                onClick={() => { goTo(i); setPlaying(false) }}
                className={`text-left px-3 py-2 rounded-lg text-[10px] font-medium transition-all duration-200 ${
                  i === cenaIdx
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/20'
                    : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Conteúdo da cena */}
          <div className="flex-1 p-5 min-h-[280px]" style={{ background: 'rgba(8,10,18,0.95)' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={cenaIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="h-full"
              >
                <Component />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Barra de progresso + controles */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center gap-3" style={{ background: 'rgba(12,14,22,0.9)' }}>
          <button
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? 'Pausar demo' : 'Reproduzir demo'}
            className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-all duration-200 shrink-0"
          >
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          {/* Progress track */}
          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-gold-400 transition-none"
              style={{ width: `${((cenaIdx / cenas.length) + (progress / 100 / cenas.length)) * 100}%` }}
            />
          </div>

          <button
            onClick={() => { setCenaIdx(0); setProgress(0); setPlaying(true) }}
            aria-label="Reiniciar demo"
            className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-all duration-200 shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Dots */}
          <div className="flex gap-1 ml-1">
            {cenas.map((_, i) => (
              <button
                key={i}
                onClick={() => { goTo(i); setPlaying(false) }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === cenaIdx ? 'w-4 bg-gold-400' : 'w-1.5 bg-white/20'}`}
                aria-label={`Ir para cena ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-white/30 mt-3">
        Demonstração ao vivo — Lab Evolution · Vet do Rim
      </p>
    </div>
  )
}
