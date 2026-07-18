import type { Metadata } from 'next'
import Script from 'next/script'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { IRISStagingModel } from '@/components/ferramentas/IRISStagingModel'
import { serializeJsonLd } from '@/lib/json-ld'

export const metadata: Metadata = {
  title: 'Estadiamento IRIS — Doença Renal Crônica em Cães e Gatos',
  description: 'Compare creatinina, SDMA, UPC e pressão arterial com as faixas IRIS 2026. Requer diagnóstico prévio de DRC e confirmação veterinária.',
  keywords: ['estadiamento IRIS', 'DRC gato cão', 'doença renal crônica estadio', 'IRIS 2026 veterinária'],
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
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
      />
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold uppercase tracking-wider mb-6">
              🔬 Ferramenta gratuita · IRIS 2026
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 text-balance mb-4">
              Estadiamento{' '}
              <span className="text-gradient-brand">IRIS da DRC</span>
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
              Compare os marcadores com as faixas IRIS após o diagnóstico de DRC.
              O resultado precisa ser confirmado pelo médico-veterinário.
            </p>
          </div>

          <IRISStagingModel />

          <p className="mt-8 text-center text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            ⚠️ Baseado nas diretrizes IRIS 2026. O estadiamento só se aplica a paciente estável,
            hidratado e com DRC diagnosticada. Não substitui avaliação clínica presencial.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
