import type { Metadata } from 'next'
import Script from 'next/script'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { IRISStagingModel } from '@/components/ferramentas/IRISStagingModel'

export const metadata: Metadata = {
  title: 'Estadiamento IRIS — Doença Renal Crônica em Cães e Gatos',
  description: 'Visualize o estadiamento IRIS da DRC do seu pet. Calcule o estágio 1 a 4 baseado em creatinina, SDMA, proteinúria e pressão arterial. Ferramenta gratuita.',
  keywords: ['estadiamento IRIS', 'DRC gato cão', 'doença renal crônica estadio', 'IRIS 2023 veterinária'],
  alternates: { canonical: '/ferramentas/estadiamento-iris' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Estadiamento IRIS — Vet do Rim',
  applicationCategory: 'MedicalApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  description: 'Ferramenta gratuita para estadiamento IRIS da Doença Renal Crônica em cães e gatos.',
  author: { '@type': 'Organization', name: 'Vet do Rim', url: 'https://vetdorim.com.br' },
}

export default function EstadiamentoIRISPage() {
  return (
    <>
      <Script
        id="estadiamento-iris-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold uppercase tracking-wider mb-6">
              🔬 Ferramenta gratuita · IRIS 2023
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 text-balance mb-4">
              Estadiamento{' '}
              <span className="text-gradient-brand">IRIS da DRC</span>
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
              Visualize em qual estágio da Doença Renal Crônica o seu pet se encontra
              e entenda como a doença pode progredir ao longo do tempo.
            </p>
          </div>

          <IRISStagingModel />

          <p className="mt-8 text-center text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            ⚠️ Baseado nas diretrizes IRIS 2023. Esta ferramenta tem caráter educacional e
            não substitui a avaliação clínica presencial nem o julgamento do médico veterinário responsável.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
