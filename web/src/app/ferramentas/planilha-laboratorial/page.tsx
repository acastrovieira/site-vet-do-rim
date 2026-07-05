import type { Metadata } from 'next'
import Script from 'next/script'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { FreeLabApp } from '@/components/ferramentas/lab-free/FreeLabApp'

export const metadata: Metadata = {
  title: 'Planilha Laboratorial Gratuita — Acompanhamento de Exames Veterinários',
  description:
    'Cadastre pacientes e acompanhe a evolução dos exames laboratoriais com planilha visual interativa. Exporte em PDF gratuitamente. Ferramenta de nefrologia veterinária.',
  keywords: [
    'planilha laboratorial veterinária',
    'acompanhamento exames pet',
    'evolução renal cão gato',
    'hemograma veterinário evolução',
    'bioquímica sérica pet',
    'ferramenta gratuita veterinária',
    'planilha exames laboratoriais',
  ],
  alternates: { canonical: '/ferramentas/planilha-laboratorial' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Planilha Laboratorial Veterinária — Vet do Rim',
  applicationCategory: 'MedicalApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  description:
    'Ferramenta gratuita para acompanhamento evolutivo de exames laboratoriais em cães e gatos. Cadastro de pacientes, inserção manual de parâmetros e exportação em PDF.',
  author: {
    '@type': 'Organization',
    name: 'Vet do Rim',
    url: 'https://vetdorim.com.br',
  },
}

export default function PlanilhaLaboratorialPage() {
  return (
    <>
      <Script
        id="planilha-laboratorial-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Header />
      <main id="main-content" className="min-h-screen bg-science-50 pt-24 pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="mb-10 text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700">
              🧪 Ferramenta gratuita · Freemium
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 text-balance sm:text-5xl mb-4">
              Planilha{' '}
              <span className="text-gradient-brand">Laboratorial</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-500">
              Cadastre pacientes, insira exames manualmente e acompanhe a evolução dos
              parâmetros laboratoriais ao longo do tempo. Exporte em PDF gratuitamente.
            </p>
          </div>

          {/* App */}
          <FreeLabApp />

          {/* Disclaimer */}
          <p className="mx-auto mt-10 max-w-lg text-center text-xs leading-relaxed text-slate-400">
            ⚠️ Ferramenta de caráter educacional e de suporte clínico.
            Não substitui a avaliação veterinária presencial nem o
            julgamento do médico veterinário responsável.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
