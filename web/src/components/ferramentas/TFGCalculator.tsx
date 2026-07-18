'use client'

import { useState } from 'react'
import Link from 'next/link'
import { calcularTFG, type TFGInput, type IRISResult, type Species } from '@/lib/tfg-calculator'
import { FlaskConical, Loader2, Lock, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    badge: 'bg-emerald-500',
  },
  yellow: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-500',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    badge: 'bg-orange-500',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-500',
  },
}

function InputField({
  id, label, hint, required, children,
}: {
  id: string
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
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

/** STORY-302 — Tela de bloqueio para resultados completos */
function LeadGateOverlay() {
  return (
    <div className="relative mt-6">
      {/* Preview desfocado */}
      <div className="blur-sm pointer-events-none select-none opacity-60 space-y-3">
        <div className="h-10 bg-slate-100 rounded-xl" />
        <div className="h-6 bg-slate-100 rounded-lg w-3/4" />
        <div className="h-6 bg-slate-100 rounded-lg w-1/2" />
        <div className="h-24 bg-slate-100 rounded-xl" />
      </div>

      {/* Gate overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <div className="bg-white rounded-2xl border border-brand-100 shadow-xl shadow-brand-500/10 p-6 max-w-xs w-full">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 mx-auto mb-4">
            <Lock className="h-6 w-6 text-brand-500" aria-hidden />
          </div>
          <h3 className="font-display font-bold text-slate-900 mb-2">
            Ver estadiamento completo
          </h3>
          <p className="text-sm text-slate-500 mb-5 leading-relaxed">
            Crie uma conta gratuita para acessar o protocolo IRIS completo, recomendações clínicas
            e exportação do resultado.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/auth/cadastro"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors"
            >
              Criar conta grátis
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/auth/login"
              className="flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              Já tenho conta — entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Resultado completo (autenticado ou estágio 1) */
function ResultCard({ result }: { result: IRISResult }) {
  const colors = STAGE_COLORS[result.stageColor]

  const proteinuriaLabel: Record<string, string> = {
    'nao-proteinurico': 'Não proteinúrico',
    borderline: 'Borderline',
    proteinurico: 'Proteinúrico',
    'nao-avaliado': 'Não avaliado',
  }

  const hypertensionLabel: Record<string, string> = {
    normotenso: 'Normotenso',
    'pre-hipertensivo': 'Pré-hipertensivo',
    hipertensivo: 'Hipertensivo',
    'gravemente-hipertensivo': 'Gravemente hipertensivo',
    'nao-avaliado': 'Não avaliado',
  }

  return (
    <div className="space-y-5 mt-6">
      {/* Estágio principal */}
      <div className={`rounded-2xl border-2 p-5 ${colors.bg} ${colors.border}`}>
        <div className="flex items-start gap-4">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold text-lg shrink-0 ${colors.badge}`}>
            {result.stage}
          </span>
          <div>
            <h2 className={`font-display font-bold text-lg ${colors.text}`}>
              {result.stageName}
            </h2>
            <p className={`text-sm mt-1 leading-relaxed ${colors.text} opacity-80`}>
              {result.stageDescription}
            </p>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Creatinina', value: result.creatininaRef },
          { label: 'SDMA', value: result.sdmaRef },
          { label: 'Proteinúria', value: proteinuriaLabel[result.proteinuriaSubstage] },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-3 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Subestadiamento PA */}
      {result.hypertensionSubstage !== 'nao-avaliado' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
          <span className="text-slate-700">
            Pressão arterial:{' '}
            <strong>{hypertensionLabel[result.hypertensionSubstage]}</strong>
          </span>
        </div>
      )}

      {/* Recomendações clínicas */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="font-display font-semibold text-slate-900 mb-4 text-sm">
          Observações para interpretação — IRIS 2026
        </h3>
        <ul className="space-y-2">
          {result.recommendations.map((rec) => (
            <li key={rec} className="flex items-start gap-2.5 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" aria-hidden />
              {rec}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
          ⏱ {result.monitoringInterval}
        </p>
      </div>

      {/* CTA para o Lab */}
      <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)' }}>
        <p className="text-white font-semibold text-sm mb-3">
          Salve este resultado no prontuário do paciente
        </p>
        <Link
          href="/lab"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-brand-700 font-bold text-sm hover:bg-blue-50 transition-colors"
        >
          Acessar Lab Evolution
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  )
}

/**
 * Triagem interativa de faixas IRIS com funil de aquisição.
 */
export function TFGCalculator() {
  const posthog = usePostHog()
  const [isCalculating, setIsCalculating] = useState(false)
  const [result, setResult] = useState<IRISResult | null>(null)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  function validate(data: FormData): TFGInput | null {
    const errs: typeof errors = {}

    const species = data.get('species') as Species
    if (!species) errs.species = 'Selecione a espécie'

    const creatinina = parseFloat(data.get('creatinina') as string)
    if (isNaN(creatinina) || creatinina <= 0 || creatinina > 30) {
      errs.creatinina = 'Creatinina inválida (0–30 mg/dL)'
    }

    if (Object.keys(errs).length) {
      setErrors(errs)
      return null
    }

    setErrors({})
    return {
      species,
      creatininaMgDl: creatinina,
      sdmaMcgDl: parseFloat(data.get('sdma') as string) || undefined,
      upcRatio: parseFloat(data.get('upc') as string) || undefined,
      pressaoSistolicaMmhg: parseFloat(data.get('pressao') as string) || undefined,
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const input = validate(data)
    if (!input) return

    setIsCalculating(true)
    // Simula latência mínima para UX de cálculo
    await new Promise((r) => setTimeout(r, 600))
    const calcResult = calcularTFG(input)
    setResult(calcResult)
    setIsCalculating(false)

    // Rastreio de produto (PostHog)
    if (posthog) {
      posthog.capture('iris_staging_used', {
        species: input.species,
        stage: calcResult.stage,
        requires_auth: calcResult.requiresAuth
      })
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
      {/* Formulário */}
      <div className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Espécie */}
            <InputField id="species" label="Espécie" required>
              <select
                id="species"
                name="species"
                required
                defaultValue=""
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="" disabled>Selecione…</option>
                <option value="cao">Cão</option>
                <option value="gato">Gato</option>
              </select>
              {errors.species && <p className="mt-1 text-xs text-red-600">{errors.species}</p>}
            </InputField>

            {/* Creatinina */}
            <InputField
              id="creatinina"
              label="Creatinina sérica (mg/dL)"
              hint="IRIS 2026: cão < 1,4 · gato < 1,6 no estágio 1"
              required
            >
              <input
                id="creatinina"
                name="creatinina"
                type="number"
                step="0.1"
                min="0.1"
                max="30"
                placeholder="Ex: 2.4"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.creatinina && <p className="mt-1 text-xs text-red-600">{errors.creatinina}</p>}
            </InputField>

            {/* SDMA */}
            <InputField
              id="sdma"
              label="SDMA (µg/dL)"
              hint="Opcional — IRIS detecta DRC mais precocemente"
            >
              <input
                id="sdma"
                name="sdma"
                type="number"
                step="1"
                min="1"
                max="100"
                placeholder="Ex: 18"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </InputField>

            {/* UPC */}
            <InputField
              id="upc"
              label="Razão UPC (proteína/creatinina urinária)"
              hint="Opcional — subestadiamento por proteinúria"
            >
              <input
                id="upc"
                name="upc"
                type="number"
                step="0.01"
                min="0"
                max="20"
                placeholder="Ex: 0.35"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </InputField>

            {/* PA */}
            <InputField
              id="pressao"
              label="Pressão arterial sistólica (mmHg)"
              hint="Opcional — subestadiamento hipertensivo"
            >
              <input
                id="pressao"
                name="pressao"
                type="number"
                step="1"
                min="60"
                max="280"
                placeholder="Ex: 160"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </InputField>
          </div>

          <button
            type="submit"
            disabled={isCalculating}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 transition-all duration-200 shadow-lg shadow-brand-500/20 disabled:opacity-60"
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Calculando estadiamento IRIS…
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4" aria-hidden />
                Classificar faixa de estadiamento IRIS
              </>
            )}
          </button>
        </form>

        {/* Resultado */}
        {result && (
          <div aria-live="polite">
            {/* Estágio 1: resultado completo gratuito */}
            {!result.requiresAuth && <ResultCard result={result} />}

            {/* Estágios 2–4: gate de aquisição (STORY-302) */}
            {result.requiresAuth && (
              <>
                {/* Mostra parte do resultado (stage name) */}
                <div className={`mt-6 rounded-2xl border-2 p-5 ${STAGE_COLORS[result.stageColor].bg} ${STAGE_COLORS[result.stageColor].border}`}>
                  <div className="flex items-start gap-4">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold text-lg shrink-0 ${STAGE_COLORS[result.stageColor].badge}`}>
                      {result.stage}
                    </span>
                    <div>
                      <h2 className={`font-display font-bold text-lg ${STAGE_COLORS[result.stageColor].text}`}>
                        {result.stageName}
                      </h2>
                      <p className={`text-sm mt-1 ${STAGE_COLORS[result.stageColor].text} opacity-70`}>
                        {result.stageDescription}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Gate de cadastro */}
                <LeadGateOverlay />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
