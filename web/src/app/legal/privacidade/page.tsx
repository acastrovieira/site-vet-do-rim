import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Informações preliminares sobre privacidade e tratamento de dados pessoais na plataforma Vet do Rim.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/legal/privacidade' },
}

export default function PrivacidadePage() {
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
              Política de Privacidade
            </h1>
            <p className="text-slate-500 dark:text-slate-300 text-sm">
              Última atualização: 17 de julho de 2026 · Versão preliminar
            </p>
          </header>

          <div className="max-w-none text-base leading-7 text-slate-700 dark:text-slate-300 [&>*+*]:mt-4 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-snug [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-6 [&_li+li]:mt-2 [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-slate-800 dark:[&_code]:bg-white/10 dark:[&_code]:text-slate-100">
            <p>
              Este documento descreve o funcionamento previsto da Plataforma e não constitui
              certificação de conformidade legal. Ele deverá ser revisado por assessoria jurídica e
              validado operacionalmente antes do uso em produção.
            </p>

            <h2>1. Responsáveis e canal de privacidade</h2>
            <p>
              A identificação formal do controlador, dos eventuais operadores e do encarregado,
              quando aplicável, ainda depende de definição jurídica. O canal oficial para solicitações
              de privacidade também deverá ser publicado e testado antes da entrada em produção.
            </p>

            <h2>2. Dados que podem ser tratados</h2>
            <p>Conforme as funcionalidades efetivamente habilitadas, a Plataforma pode tratar:</p>
            <ul>
              <li><strong>Dados de cadastro:</strong> nome completo, e-mail, tipo de perfil (veterinário ou tutor);</li>
              <li><strong>Dados de pacientes:</strong> nome do animal, espécie, raça, peso e dados clínicos laboratoriais;</li>
              <li><strong>Dados de uso:</strong> páginas acessadas e funcionalidades utilizadas, se o serviço de analytics estiver habilitado e houver registro de consentimento;</li>
              <li><strong>Dados técnicos:</strong> registros produzidos pelos serviços de autenticação, hospedagem e segurança, conforme suas configurações e contratos.</li>
            </ul>

            <h2>3. Ferramentas gratuitas e armazenamento local</h2>
            <p>
              A Planilha Laboratorial gratuita e o Controle de Peso armazenam seus registros
              localmente no navegador (<code>localStorage</code>). Esses dados não são enviados ao
              banco da área autenticada por essas ferramentas, mas permanecem disponíveis para quem
              tiver acesso ao mesmo perfil do navegador.
            </p>
            <p>
              Em dispositivo compartilhado, evite inserir dados identificáveis ou clínicos reais.
              Fechar a aba não apaga os registros, e eles podem ser perdidos ao limpar o navegador,
              usar navegação privativa, trocar de perfil ou de dispositivo.
            </p>
            <p>
              Para remover os dados, use os controles de exclusão de pacientes e exames na Planilha
              Laboratorial e a opção <strong>Limpar tudo</strong> no Controle de Peso. Como alternativa,
              abra as configurações de privacidade do navegador, procure os dados do site Vet do Rim
              e remova-os. Sempre que possível, selecione somente este site para não apagar dados de
              outros serviços.
            </p>

            <h2>4. Finalidades previstas</h2>
            <p>O tratamento pode ser necessário para:</p>
            <ul>
              <li>Disponibilizar as funcionalidades solicitadas pelo usuário;</li>
              <li>Autenticar contas e preservar a segurança da aplicação;</li>
              <li>Atender obrigações aplicáveis após sua identificação jurídica;</li>
              <li>Melhorar a experiência de uso, quando o analytics estiver habilitado e autorizado.</li>
            </ul>
            <p>
              As bases legais, os registros de decisão e as responsabilidades de cada operação deverão
              ser definidos por revisão jurídica antes do tratamento em produção.
            </p>

            <h2>5. Prestadores de serviço</h2>
            <p>
              Quando os respectivos serviços estiverem habilitados, dados podem ser processados por:
            </p>
            <ul>
              <li><strong>Supabase</strong> (banco de dados, autenticação e armazenamento de arquivos);</li>
              <li><strong>Google Gemini ou OpenAI</strong> (um dos provedores configurados pode processar o conteúdo de laudos PDF para extração assistida);</li>
              <li><strong>PostHog</strong> (analytics de uso, somente após consentimento);</li>
              <li><strong>Vercel</strong> (hospedagem e entrega da aplicação web).</li>
            </ul>
            <p>
              A lista final de prestadores, suas funções, regiões de processamento, retenção,
              suboperadores e eventuais transferências internacionais deverá ser confirmada conforme
              a configuração e os contratos realmente utilizados. Não envie laudos reais à IA antes
              dessa validação e da definição da base legal aplicável.
            </p>

            <h2>6. Retenção e exclusão</h2>
            <p>
              Nenhum prazo de retenção ou exclusão é prometido nesta versão preliminar. O ciclo de
              vida dos dados remotos, incluindo banco, arquivos, cópias de segurança e resultados
              derivados, deverá ser formalizado e testado antes da produção. Os registros das
              ferramentas gratuitas permanecem no navegador até serem excluídos pelo usuário ou
              removidos pelo próprio navegador.
            </p>

            <h2>7. Direitos do titular</h2>
            <p>
              A LGPD prevê direitos relacionados a dados pessoais, cuja aplicação depende do contexto
              e das hipóteses legais pertinentes. O procedimento de atendimento, os responsáveis e o
              canal verificado para solicitações deverão ser definidos antes da produção.
            </p>

            <h2>8. Segurança</h2>
            <p>
              A aplicação contém mecanismos técnicos de autenticação, autorização e proteção de
              dados, mas sua configuração e eficácia ainda precisam ser comprovadas no ambiente de
              implantação. Esta versão não declara protocolo específico de transporte, isolamento
              entre clínicas ou cobertura integral das políticas do banco. Nenhum controle elimina
              todos os riscos; por isso, não utilize dados reais antes da aprovação de produção.
            </p>

            <h2>9. Cookies e armazenamento do navegador</h2>
            <p>
              A Plataforma pode utilizar cookies necessários à autenticação e armazenamento local
              para preferências, consentimento e ferramentas gratuitas. O analytics deve permanecer
              condicionado ao consentimento quando estiver habilitado. A lista final de tecnologias,
              duração e finalidade deverá refletir a configuração usada em produção.
            </p>

            <h2>10. Revisão antes da produção</h2>
            <p>
              Antes da publicação definitiva, este documento deverá passar por revisão jurídica,
              validação técnica e teste do canal de atendimento. A identificação dos responsáveis,
              bases legais, prazos, prestadores e procedimentos somente deverá ser publicada após
              confirmação documental.
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-700">
            <Link
              href="/legal/termos"
              className="text-sm text-brand-600 font-semibold hover:underline"
            >
              Ver Termos de Uso →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
