import type { Metadata } from 'next'
import Script from 'next/script'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { TFGCalculator } from '@/components/ferramentas/TFGCalculator'
import { serializeJsonLd } from '@/lib/json-ld'

export const metadata: Metadata = {
  title: 'Estadiamento IRIS de DRC para Cães e Gatos — Ferramenta Gratuita',
  description:
    'Compare creatinina, SDMA, UPC e pressão arterial com as faixas IRIS 2026. A ferramenta não calcula a taxa de filtração glomerular nem substitui avaliação veterinária.',
  keywords: [
    'estadiamento IRIS calculadora',
    'SDMA creatinina calculadora veterinária',
    'ferramenta nefrologia veterinária grátis',
  ],
  alternates: { canonical: '/ferramentas/calculadora-tfg' },
}

// JSON-LD SoftwareApplication (E-E-A-T)
const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Ferramenta de Estadiamento IRIS — Vet do Rim',
  applicationCategory: 'MedicalApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  description:
    'Compare marcadores renais de cães e gatos com as faixas de estadiamento IRIS 2026.',
  author: { '@type': 'Organization', name: 'Vet do Rim', url: 'https://vetdorim.com.br' },
}

export default function CalculadoraTFGPage() {
  return (
    <>
      <Script
        id="calculadora-tfg-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(appSchema) }}
      />
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header da página */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold uppercase tracking-wider mb-6">
              🧪 Ferramenta gratuita
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 text-balance mb-4">
              Calculadora de{' '}
              <span className="text-gradient-brand">Estadiamento IRIS</span>
            </h1>
            <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
              Compare creatinina, SDMA, UPC e pressão arterial com as faixas IRIS 2026.
              Esta ferramenta não mede nem estima a TFG.
            </p>
          </div>

          <TFGCalculator />

          {/* Aviso científico */}
          <p className="mt-8 text-center text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            ⚠️ Ferramenta educativa baseada nas faixas IRIS 2026. O estadiamento só se aplica após
            diagnóstico de DRC em paciente estável e hidratado, com resultados confirmados. Não
            substitui avaliação clínica presencial nem o julgamento do médico-veterinário.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
