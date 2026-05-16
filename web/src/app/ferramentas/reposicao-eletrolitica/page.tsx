import type { Metadata } from 'next'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { ReposicaoEletroliticaCalculator } from '@/components/ferramentas/ReposicaoEletroliticaCalculator'
import { VetOnlyGate } from '@/components/ferramentas/VetOnlyGate'
import { FlaskConical } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Calculadora de Reposição Eletrolítica — Potássio, Bicarbonato, Cálcio | Vet do Rim',
  description:
    'Calcule reposição de potássio, bicarbonato, cálcio, fósforo e magnésio em cães e gatos. Baseada em DiBartola, ACVIM e literatura atualizada.',
  keywords: ['hipocalemia veterinária', 'reposição bicarbonato cão', 'acidose metabólica gato', 'eletrólitos veterinários'],
  alternates: { canonical: '/ferramentas/reposicao-eletrolitica' },
}

export default function ReposicaoEletroliticaPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-science-50 pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-xs font-semibold text-brand-500 mb-5">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              Ferramenta Clínica Gratuita
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
              Calculadora de{' '}
              <span className="text-gradient-brand">Reposição Eletrolítica</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Reposição de <strong className="text-slate-800">K⁺, HCO₃⁻, Ca²⁺, PO₄³⁻ e Mg²⁺</strong> em cães e gatos.
              Protocolos baseados em <strong className="text-slate-800">DiBartola 4ª ed.</strong> e diretrizes ACVIM atualizadas.
            </p>
          </div>
          <VetOnlyGate>
            <ReposicaoEletroliticaCalculator />
          </VetOnlyGate>
        </div>
      </main>
      <Footer />
    </>
  )
}
