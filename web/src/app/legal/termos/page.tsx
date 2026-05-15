import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Termos de Uso — Vet do Rim',
  description: 'Termos de Uso da plataforma Vet do Rim e do Lab Evolution.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/legal/termos' },
}

export default function TermosPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <nav className="mb-8" aria-label="Breadcrumb">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Início
            </Link>
          </nav>

          <header className="mb-10">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Termos de Uso
            </h1>
            <p className="text-slate-500 text-sm">Última atualização: maio de 2026</p>
          </header>

          <div className="prose prose-slate max-w-none prose-headings:font-display prose-a:text-brand-600">
            <h2>1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma Vet do Rim e o Lab Evolution (&ldquo;Plataforma&rdquo;),
              você concorda com estes Termos de Uso. Se não concordar, não utilize os serviços.
            </p>

            <h2>2. Descrição dos Serviços</h2>
            <p>
              A Vet do Rim oferece conteúdo científico educacional sobre nefrologia e urologia
              veterinária, ferramentas clínicas de apoio (como a calculadora de TFG) e o Lab Evolution,
              uma plataforma de gestão clínica para médicos veterinários e tutores de pacientes renais.
            </p>

            <h2>3. Uso Permitido</h2>
            <p>
              Os serviços são destinados exclusivamente a médicos veterinários habilitados e tutores de
              animais de companhia. O conteúdo e as ferramentas disponibilizados têm <strong>caráter
              educacional e de apoio clínico</strong>, e não substituem a avaliação presencial do
              profissional responsável.
            </p>

            <h2>4. Responsabilidades do Usuário</h2>
            <p>O usuário é responsável por:</p>
            <ul>
              <li>Manter a confidencialidade de suas credenciais de acesso;</li>
              <li>Fornecer informações verídicas e atualizadas;</li>
              <li>Utilizar a Plataforma em conformidade com a legislação vigente;</li>
              <li>Não compartilhar laudos ou dados de pacientes sem autorização do tutor.</li>
            </ul>

            <h2>5. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da Plataforma — textos, algoritmos, design, marca e código — é de
              propriedade exclusiva da Vet do Rim. É proibida a reprodução, distribuição ou uso
              comercial sem autorização expressa e por escrito.
            </p>

            <h2>6. Limitação de Responsabilidade</h2>
            <p>
              A Vet do Rim não se responsabiliza por decisões clínicas tomadas com base exclusivamente
              nas ferramentas e conteúdos da Plataforma. O julgamento clínico do profissional
              veterinário é sempre soberano.
            </p>

            <h2>7. Modificações</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente. Usuários serão notificados por e-mail
              sobre alterações significativas.
            </p>

            <h2>8. Contato</h2>
            <p>
              Para dúvidas sobre estes Termos, entre em contato:{' '}
              <a href="mailto:contato@vetdorim.com.br">contato@vetdorim.com.br</a>
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100">
            <Link
              href="/legal/privacidade"
              className="text-sm text-brand-600 font-semibold hover:underline"
            >
              Ver Política de Privacidade →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
