import type { Metadata } from 'next'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { ControlePesoTool } from '@/components/ferramentas/ControlePesoTool'
import { Scale, Info } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Controle de Peso de Pacientes Veterinários — Gratuito | Vet do Rim',
  description:
    'Registre e acompanhe a evolução do peso corporal e do Escore de Condição Corporal (ECC) do seu pet. Ferramenta gratuita para tutores e veterinários. Exportação CSV grátis.',
  keywords: [
    'controle de peso veterinário',
    'escore condição corporal cão gato',
    'ECC veterinário',
    'acompanhamento peso pet',
    'histórico peso animal',
    'ferramenta gratuita veterinária',
  ],
  alternates: { canonical: '/ferramentas/controle-de-peso' },
}

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Controle de Peso Veterinário — Vet do Rim',
  applicationCategory: 'MedicalApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  description:
    'Ferramenta gratuita para registrar e acompanhar a evolução do peso e Escore de Condição Corporal (ECC) de cães e gatos.',
  author: { '@type': 'Organization', name: 'Vet do Rim', url: 'https://vetdorim.com.br' },
}

export default function ControlePesoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Cabeçalho */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-semibold uppercase tracking-wider mb-6">
              <Scale className="h-3.5 w-3.5" aria-hidden />
              Ferramenta gratuita
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 text-balance mb-4">
              Controle de{' '}
              <span className="bg-gradient-to-r from-teal-600 to-teal-400 bg-clip-text text-transparent">
                Peso
              </span>
            </h1>
            <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
              Registre e acompanhe a evolução do peso e do{' '}
              <strong className="text-slate-700">Escore de Condição Corporal (ECC)</strong> do seu
              paciente ao longo do tempo. Sem cadastro. Gratuito.
            </p>
          </div>

          {/* Info box */}
          <div className="mb-8 flex items-start gap-3 p-4 rounded-2xl bg-teal-50 border border-teal-100">
            <Info className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-teal-800 leading-relaxed">
              <strong>Para tutores e veterinários:</strong> Os dados ficam armazenados apenas no
              seu navegador (sem envio para servidores).             Use o botão <em>&ldquo;Exportar CSV&rdquo;</em> para
              fazer backup e compartilhar com o veterinário.
            </p>
          </div>

          <ControlePesoTool />

          {/* Disclaimer */}
          <p className="mt-10 text-center text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            ⚠️ Esta ferramenta é de apoio ao acompanhamento clínico. Variações de peso significativas
            devem ser avaliadas pelo médico veterinário responsável. O Escore de Condição Corporal
            (ECC) segue a escala de 9 pontos da{' '}
            <a
              href="https://www.wsava.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 hover:underline font-medium"
            >
              WSAVA
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
