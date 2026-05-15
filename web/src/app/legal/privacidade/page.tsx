import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Vet do Rim',
  description:
    'Política de Privacidade e proteção de dados pessoais da Vet do Rim, em conformidade com a LGPD (Lei Geral de Proteção de Dados).',
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
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Início
            </Link>
          </nav>

          <header className="mb-10">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Política de Privacidade
            </h1>
            <p className="text-slate-500 text-sm">
              Última atualização: maio de 2026 · Em conformidade com a LGPD (Lei nº 13.709/2018)
            </p>
          </header>

          <div className="prose prose-slate max-w-none prose-headings:font-display prose-a:text-brand-600">
            <h2>1. Controlador dos Dados</h2>
            <p>
              A <strong>Vet do Rim</strong> é a controladora dos dados pessoais coletados por esta
              Plataforma. Para exercer seus direitos como titular, entre em contato com nosso DPO:
              {' '}<a href="mailto:privacidade@vetdorim.com.br">privacidade@vetdorim.com.br</a>
            </p>

            <h2>2. Dados Coletados</h2>
            <p>Coletamos os seguintes dados pessoais:</p>
            <ul>
              <li><strong>Dados de cadastro:</strong> nome completo, e-mail, tipo de perfil (veterinário ou tutor);</li>
              <li><strong>Dados de pacientes:</strong> nome do animal, espécie, raça, peso e dados clínicos laboratoriais;</li>
              <li><strong>Dados de uso:</strong> páginas acessadas, funcionalidades utilizadas e dados de analytics (anonimizados via PostHog);</li>
              <li><strong>Dados técnicos:</strong> endereço IP (para fins de conformidade LGPD).</li>
            </ul>

            <h2>3. Finalidade do Tratamento</h2>
            <p>Os dados são tratados para:</p>
            <ul>
              <li>Prestação dos serviços da Plataforma (base legal: execução de contrato);</li>
              <li>Segurança e prevenção de fraudes (base legal: interesse legítimo);</li>
              <li>Cumprimento de obrigações legais (base legal: obrigação legal);</li>
              <li>Melhoria da experiência do usuário via analytics anonimizados (base legal: consentimento).</li>
            </ul>

            <h2>4. Compartilhamento de Dados</h2>
            <p>
              Os dados pessoais <strong>não são vendidos</strong> a terceiros. Podemos compartilhá-los
              exclusivamente com:
            </p>
            <ul>
              <li><strong>Supabase</strong> (infraestrutura de banco de dados e autenticação — servidores na AWS, região us-east-1);</li>
              <li><strong>OpenAI</strong> (análise de laudos PDF via API — os dados são processados e não armazenados pela OpenAI em modo padrão);</li>
              <li><strong>PostHog</strong> (analytics de uso, dados anonimizados).</li>
            </ul>

            <h2>5. Retenção de Dados</h2>
            <p>
              Os dados são mantidos enquanto a conta estiver ativa. Ao solicitar exclusão, todos
              os dados são removidos em até 30 dias, exceto quando há obrigação legal de retenção.
            </p>

            <h2>6. Direitos do Titular</h2>
            <p>
              Em conformidade com a LGPD, você tem direito a: confirmação de tratamento, acesso,
              correção, anonimização, portabilidade, eliminação e revogação do consentimento.
              Exercite seus direitos em: <a href="mailto:privacidade@vetdorim.com.br">privacidade@vetdorim.com.br</a>
            </p>

            <h2>7. Segurança</h2>
            <p>
              Implementamos medidas técnicas e organizacionais para proteger seus dados, incluindo
              criptografia em trânsito (TLS 1.3), controle de acesso por Row Level Security (RLS)
              no banco de dados, e autenticação segura via JWT.
            </p>

            <h2>8. Cookies</h2>
            <p>
              Utilizamos cookies de sessão (necessários para autenticação) e cookies de analytics
              (opcionais, podem ser recusados). Não utilizamos cookies de publicidade.
            </p>

            <h2>9. Contato</h2>
            <p>
              DPO (Encarregado de Proteção de Dados):{' '}
              <a href="mailto:privacidade@vetdorim.com.br">privacidade@vetdorim.com.br</a>
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100">
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
