import type { Metadata } from 'next'
import Script from 'next/script'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { DietaRenalCalculator } from '@/components/ferramentas/DietaRenalCalculator'
import { UtensilsCrossed, Info } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Calculadora de Dieta Terapêutica Renal para Cães e Gatos — Gratuita | Vet do Rim',
  description:
    'Calcule a quantidade diária de ração renal para cães e gatos por peso, ECC e marca (Royal Canin, Hill\'s k/d, Premier Pet, Vet Life Farmina). Ferramenta gratuita para tutores e veterinários.',
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
}

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Calculadora de Dieta Terapêutica Renal — Vet do Rim',
  applicationCategory: 'MedicalApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  description:
    'Calcula a quantidade diária de dieta terapêutica renal para cães e gatos com base no peso, Escore de Condição Corporal (ECC) e marca do alimento. Suporta Royal Canin, Hill\'s, Premier Pet e Vet Life Farmina.',
  author: { '@type': 'Organization', name: 'Vet do Rim', url: 'https://vetdorim.com.br' },
}

export default function DietaRenalPage() {
  return (
    <>
      <Script
        id="dieta-renal-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Cabeçalho */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-xs font-semibold uppercase tracking-wider mb-6">
              <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
              Ferramenta gratuita
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 text-balance mb-4">
              Dieta{' '}
              <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">
                Terapêutica Renal
              </span>
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
              Calcule a quantidade diária de ração renal para{' '}
              <strong className="text-slate-700">cães e gatos</strong> com ajuste automático por{' '}
              <strong className="text-slate-700">peso, ECC e marca</strong>. Baseado nas
              recomendações dos fabricantes.
            </p>
          </div>

          {/* Marcas suportadas */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            {[
              { cor: 'bg-red-100 text-red-700 border-red-200', nome: 'Royal Canin Renal' },
              { cor: 'bg-blue-100 text-blue-700 border-blue-200', nome: "Hill's k/d" },
              { cor: 'bg-green-100 text-green-700 border-green-200', nome: 'Premier Pet Renal' },
              { cor: 'bg-purple-100 text-purple-700 border-purple-200', nome: 'Vet Life (Farmina)' },
            ].map(({ cor, nome }) => (
              <span
                key={nome}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${cor}`}
              >
                {nome}
              </span>
            ))}
          </div>

          {/* Info box */}
          <div className="mb-8 flex items-start gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-100">
            <Info className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-orange-800 leading-relaxed">
              <strong>Ajuste por ECC:</strong> Se o paciente estiver acima do peso ideal (ECC{' '}
              {'> 5'}), o cálculo usa o <em>peso corporal ideal estimado</em> para evitar
              superalimentação calórica — conforme recomendação dos fabricantes e literatura
              veterinária.
            </p>
          </div>

          <DietaRenalCalculator />

          {/* Disclaimer */}
          <p className="mt-10 text-center text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            ⚠️ Esta calculadora é baseada nos guias nutricionais dos fabricantes (mai/2025). Sempre
            confira a tabela de alimentação na embalagem atual do produto e consulte o médico
            veterinário responsável para ajuste individualizado. Não substitui avaliação clínica
            presencial.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
