import type { Metadata } from 'next'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { ClinicalReviewNotice } from '@/components/ferramentas/ClinicalReviewNotice'
import { UtensilsCrossed } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Dieta Terapêutica Renal — Em revisão clínica',
  description:
    'Ferramenta de dieta renal temporariamente indisponível enquanto tabelas de fabricantes e critérios clínicos passam por revisão independente.',
  keywords: [
    'calculadora dieta renal veterinária',
    'ração renal cão gato quantidade',
    'Royal Canin Renal quantidade',
    'Hills kd quantidade diária',
    'dieta terapêutica renal DRC',
    'Premier Pet Renal gato',
    'Vet Life Farmina Renal',
    'escore condição corporal dieta',
  ],
  alternates: { canonical: '/ferramentas/dieta-renal' },
  robots: { index: false, follow: true },
}

export default function DietaRenalPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Cabeçalho */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-xs font-semibold uppercase tracking-wider mb-6">
              <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
              Em revisão clínica
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 text-balance mb-4">
              Dieta{' '}
              <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">
                Terapêutica Renal
              </span>
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
              Esta calculadora está temporariamente indisponível enquanto as tabelas por produto,
              critérios de ingestão e limites de uso passam por revisão independente.
            </p>
          </div>

          <ClinicalReviewNotice toolName="dieta terapêutica renal" />
        </div>
      </main>
      <Footer />
    </>
  )
}
