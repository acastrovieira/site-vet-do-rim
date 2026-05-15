import type { Metadata } from 'next'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { TFGCalculator } from '@/components/ferramentas/TFGCalculator'

export const metadata: Metadata = {
  title: 'Calculadora de Taxa de Filtração Glomerular (TFG) Veterinária — Grátis',
  description:
    'Calcule a TFG e o estadiamento IRIS para cães e gatos gratuitamente. Ferramenta clínica baseada em creatinina e SDMA, desenvolvida por especialistas em nefrologia veterinária.',
  keywords: [
    'calculadora TFG veterinária',
    'taxa filtração glomerular cão gato',
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
  name: 'Calculadora de TFG Veterinária — Vet do Rim',
  applicationCategory: 'MedicalApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  description:
    'Calcule a Taxa de Filtração Glomerular e o estadiamento IRIS para cães e gatos com base em creatinina, SDMA e peso corporal.',
  author: { '@type': 'Organization', name: 'Vet do Rim', url: 'https://vetdorim.com.br' },
}

export default function CalculadoraTFGPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
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
              <span className="text-gradient-brand">TFG Veterinária</span>
            </h1>
            <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
              Estime a Taxa de Filtração Glomerular e o estadiamento IRIS para cães e gatos.
              Baseada em creatinina sérica e SDMA.
            </p>
          </div>

          <TFGCalculator />

          {/* Aviso científico */}
          <p className="mt-8 text-center text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            ⚠️ Esta calculadora é uma ferramenta de apoio clínico baseada nas diretrizes IRIS 2023.
            Não substitui avaliação clínica presencial nem o julgamento do médico veterinário
            responsável.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
