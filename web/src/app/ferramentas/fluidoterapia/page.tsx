import type { Metadata } from 'next'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { ClinicalReviewNotice } from '@/components/ferramentas/ClinicalReviewNotice'
import { Droplets } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Fluidoterapia — Em revisão clínica',
  description:
    'Ferramenta de fluidoterapia temporariamente indisponível enquanto fórmulas e limites passam por revisão clínica independente.',
  keywords: ['fluidoterapia veterinária', 'cálculo fluido cão gato', 'desidratação veterinária', 'bolus ressuscitação'],
  alternates: { canonical: '/ferramentas/fluidoterapia' },
  robots: { index: false, follow: true },
}

export default function FluidoterapiaPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen bg-science-50 pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-xs font-semibold text-brand-500 mb-5">
              <Droplets className="h-3.5 w-3.5" aria-hidden />
              Em revisão clínica
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
              Calculadora de{' '}
              <span className="text-gradient-brand">Fluidoterapia</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Esta calculadora está temporariamente indisponível durante uma revisão independente
              de segurança, unidades e protocolos.
            </p>
          </div>

          <ClinicalReviewNotice toolName="fluidoterapia" />
        </div>
      </main>
      <Footer />
    </>
  )
}
