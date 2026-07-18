import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Termos de Uso',
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
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Início
            </Link>
          </nav>

          <header className="mb-10">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              Termos de Uso
            </h1>
            <p className="text-slate-500 dark:text-slate-300 text-sm">
              Última atualização: 17 de julho de 2026 · Versão preliminar
            </p>
          </header>

          <div className="max-w-none text-base leading-7 text-slate-700 dark:text-slate-300 [&>*+*]:mt-4 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-snug [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-6 [&_li+li]:mt-2 [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-slate-800 dark:[&_code]:bg-white/10 dark:[&_code]:text-slate-100">
            <p>
              Estes Termos são preliminares e deverão passar por revisão jurídica antes da entrada da
              Plataforma em produção. Eles não substituem o instrumento definitivo nem ampliam ou
              afastam direitos previstos na legislação aplicável.
            </p>

            <h2>1. Aceitação dos Termos</h2>
            <p>
              Ao acessar a versão atual da plataforma Vet do Rim e do Lab Evolution
              (&ldquo;Plataforma&rdquo;), você declara ciência destas condições preliminares. Se não
              concordar, não utilize os serviços nem insira dados pessoais ou clínicos.
            </p>

            <h2>2. Descrição dos Serviços</h2>
            <p>
              A Plataforma pode disponibilizar conteúdo educacional sobre nefrologia e urologia
              veterinária, ferramentas de apoio e recursos de gestão clínica para médicos
              veterinários e tutores de pacientes renais, conforme a versão habilitada.
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
              <li>Não inserir dados reais enquanto o ambiente não estiver aprovado para produção.</li>
            </ul>

            <h2>5. Ferramentas gratuitas e dispositivo compartilhado</h2>
            <p>
              A Planilha Laboratorial gratuita e o Controle de Peso guardam registros no
              <code>localStorage</code> do navegador. Em dispositivo compartilhado, outras pessoas com
              acesso ao mesmo perfil do navegador podem visualizar esses dados. Fechar a aba não os
              remove.
            </p>
            <p>
              Para apagar os registros, use os controles de exclusão da própria ferramenta ou remova
              os dados do site Vet do Rim nas configurações de privacidade do navegador. Limpar dados
              do navegador, usar navegação privativa ou trocar de perfil ou dispositivo também pode
              causar perda dos registros locais.
            </p>

            <h2>6. Propriedade intelectual</h2>
            <p>
              Conteúdos, software, marcas e elementos visuais podem ser protegidos por direitos
              próprios ou de terceiros e estar sujeitos às respectivas licenças. O uso da Plataforma
              não transfere esses direitos. A titularidade e as autorizações aplicáveis deverão ser
              confirmadas na revisão jurídica anterior à produção.
            </p>

            <h2>7. Responsabilidade e limites clínicos</h2>
            <p>
              As ferramentas não devem ser a única base de uma decisão clínica e não substituem o
              exame do paciente, os dados completos do caso ou o julgamento do médico veterinário.
              Nenhuma disposição destes Termos exclui responsabilidades que não possam ser afastadas
              pela legislação aplicável.
            </p>

            <h2>8. Modificações</h2>
            <p>
              Estes Termos podem ser atualizados. A versão e a data vigentes serão exibidas nesta
              página. O meio adequado para comunicar mudanças relevantes deverá ser definido antes da
              produção; esta versão não promete notificação por e-mail.
            </p>

            <h2>9. Contato e revisão</h2>
            <p>
              O canal oficial de contato deverá ser publicado e testado antes da produção. Estes
              Termos somente deverão ser tratados como definitivos após revisão jurídica e validação
              das informações operacionais apresentadas ao usuário.
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-700">
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
