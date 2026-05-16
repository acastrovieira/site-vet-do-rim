import type { Metadata } from 'next'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { FluidoterapiaCalculator } from '@/components/ferramentas/FluidoterapiaCalculator'
import { VetOnlyGate } from '@/components/ferramentas/VetOnlyGate'
import { Droplets } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Calculadora de Fluidoterapia — Cães e Gatos | Vet do Rim',
  description:
    'Calcule taxas de manutenção, reposição de déficit hídrico e bolus de ressuscitação para cães e gatos. Baseada nas diretrizes AAHA/AAFP 2013 e DiBartola.',
  keywords: ['fluidoterapia veterinária', 'cálculo fluido cão gato', 'desidratação veterinária', 'bolus ressuscitação'],
  alternates: { canonical: '/ferramentas/fluidoterapia' },
}

export default function FluidoterapiaPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-science-50 pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-xs font-semibold text-brand-500 mb-5">
              <Droplets className="h-3.5 w-3.5" aria-hidden />
              Ferramenta Clínica Gratuita
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
              Calculadora de{' '}
              <span className="text-gradient-brand">Fluidoterapia</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Taxas de manutenção, reposição de déficit e bolus de ressuscitação para cães e gatos.
              Baseada nas diretrizes <strong className="text-slate-800">AAHA/AAFP 2013</strong> e{' '}
              <strong className="text-slate-800">DiBartola 4ª ed.</strong>
            </p>
          </div>

          <VetOnlyGate>
            <FluidoterapiaCalculator />
          </VetOnlyGate>
        </div>
      </main>
      <Footer />
    </>
  )
}
