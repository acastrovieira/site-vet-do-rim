import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import {
  FlaskConical,
  Microscope,
  HeartPulse,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  BarChart3,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Nefrologia e Urologia Veterinária de Alta Complexidade',
  description:
    'Vet do Rim — especialistas em doenças renais e urológicas de cães e gatos. Tratamento individualizado, empatia e rigor técnico científico.',
  alternates: { canonical: '/' },
}

// ── JSON-LD Schema Organization ──────────────────────────
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'VeterinaryCare',
  name: 'Vet do Rim',
  url: 'https://vetdorim.com.br',
  description: 'Especialistas em nefrologia e urologia veterinária de alta complexidade.',
  medicalSpecialty: 'Nephrology',
  sameAs: [
    'https://instagram.com/vetdorim',
    'https://youtube.com/@vetdorim',
  ],
}

// ── Data ──────────────────────────────────────────────────
const especialidades = [
  {
    icon: FlaskConical,
    title: 'Nefrologia Veterinária',
    description:
      'Diagnóstico e manejo clínico de doenças renais agudas e crônicas em cães e gatos, com estadiamento IRIS e protocolos baseados em evidências.',
  },
  {
    icon: Microscope,
    title: 'Urologia Veterinária',
    description:
      'Avaliação e tratamento de urolitíase, cistite, obstrução uretral e anomalias do trato urinário com abordagem minimamente invasiva.',
  },
  {
    icon: HeartPulse,
    title: 'Cuidados Paliativos Renais',
    description:
      'Suporte de qualidade de vida, nutrição renal especializada e fluidoterapia adaptada para pacientes em estadio avançado.',
  },
  {
    icon: BarChart3,
    title: 'Lab Evolution (IA)',
    description:
      'Plataforma digital com dashboards clínicos, acompanhamento longitudinal de biomarcadores renais e assistência por inteligência artificial.',
  },
]

const diferenciais = [
  'Laudos com interpretação clínica detalhada',
  'Protocolos baseados em diretrizes IRIS e ACVIM',
  'Comunicação humanizada com tutores',
  'Dashboard digital de acompanhamento',
  'Educação continuada para vets parceiros',
  'Telemedicina veterinária especializada',
]

const artigosFeatured = [
  {
    slug: 'estadiamento-iris-doenca-renal-cronica',
    title: 'Estadiamento IRIS na DRC: guia prático para a clínica veterinária',
    excerpt:
      'O sistema IRIS é a referência mundial para estadiar a Doença Renal Crônica em cães e gatos. Entenda como aplicar na prática clínica.',
    categoria: 'Nefrologia',
    leitura: '8 min',
  },
  {
    slug: 'taxa-filtracao-glomerular-veterinaria',
    title: 'TFG em pequenos animais: por que ela é o biomarcador mais importante',
    excerpt:
      'A Taxa de Filtração Glomerular é o melhor indicador da função renal. Saiba como interpretar e calcular em cães e gatos.',
    categoria: 'Diagnóstico',
    leitura: '10 min',
  },
  {
    slug: 'manejo-nutricional-doenca-renal',
    title: 'Nutrição na Doença Renal Crônica: o que a evidência diz em 2025',
    excerpt:
      'Restrição de fósforo, proteína adequada e hidratação. Um guia completo sobre manejo nutricional renal baseado em evidências.',
    categoria: 'Nutrição',
    leitura: '12 min',
  },
]

// ── Page ──────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Header />

      <main id="main-content">
        {/* ── Hero ──────────────────────────────────── */}
        <section
          className="relative min-h-screen flex items-center pt-16 overflow-hidden"
          aria-labelledby="hero-heading"
        >
          {/* Background gradient sutil */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(14,165,233,0.08) 0%, transparent 70%), linear-gradient(180deg, #f0f9ff 0%, #ffffff 60%)',
            }}
            aria-hidden
          />
          {/* Grid decorativo */}
          <div
            className="absolute inset-0 -z-10 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(#0ea5e9 1px, transparent 1px), linear-gradient(90deg, #0ea5e9 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
            aria-hidden
          />

          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-24 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold uppercase tracking-wider mb-8 animate-fade-up">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" aria-hidden />
              Nefrologia &amp; Urologia Veterinária
            </div>

            <h1
              id="hero-heading"
              className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 text-balance leading-[1.05] animate-fade-up"
              style={{ animationDelay: '0.1s' }}
            >
              Cuidado renal{' '}
              <span className="text-gradient-brand">especializado</span>
              <br />
              para o seu animal
            </h1>

            <p
              className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed text-balance animate-fade-up"
              style={{ animationDelay: '0.2s' }}
            >
              Medicina veterinária de alta complexidade com rigor técnico científico, empatia e
              tecnologia de ponta. Doenças renais e urológicas tratadas com protocolos baseados
              em evidências.
            </p>

            <div
              className="mt-10 flex flex-col sm:flex-row gap-3 justify-center animate-fade-up"
              style={{ animationDelay: '0.3s' }}
            >
              <Link
                href="/ferramentas/calculadora-tfg"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-all duration-200 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
              >
                Calcular TFG grátis
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/blog"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all duration-200"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Explorar artigos
              </Link>
            </div>

            {/* Social proof */}
            <p
              className="mt-10 text-xs text-slate-400 animate-fade-up"
              style={{ animationDelay: '0.4s' }}
            >
              Referência em nefrologia veterinária · Protocolos IRIS e ACVIM · Educação continuada
            </p>
          </div>
        </section>

        {/* ── Especialidades ────────────────────────── */}
        <section
          id="especialidades"
          className="py-24 bg-white"
          aria-labelledby="especialidades-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
                Áreas de atuação
              </p>
              <h2
                id="especialidades-heading"
                className="font-display text-3xl sm:text-4xl font-bold text-slate-900"
              >
                Especialidades veterinárias
              </h2>
              <p className="mt-3 text-slate-500 max-w-xl mx-auto">
                Diagnóstico preciso e manejo clínico especializado para as condições mais complexas
                do sistema renal e urinário.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {especialidades.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="group p-6 rounded-2xl border border-slate-100 bg-white hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-2 text-sm leading-snug">
                    {title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Diferenciais ─────────────────────────── */}
        <section className="py-24 bg-science-50" aria-labelledby="diferenciais-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
                  Por que escolher
                </p>
                <h2
                  id="diferenciais-heading"
                  className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-5"
                >
                  Medicina veterinária de ponta, com o cuidado que o seu animal merece
                </h2>
                <p className="text-slate-500 leading-relaxed mb-8">
                  Unimos rigor técnico científico baseado em protocolos internacionais IRIS e ACVIM
                  com um atendimento humanizado e tecnologia digital para acompanhamento contínuo.
                </p>
                <Link
                  href="/lab"
                  className="inline-flex items-center gap-2 text-brand-600 font-semibold text-sm hover:gap-3 transition-all duration-200"
                >
                  Conhecer o Lab Evolution
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {diferenciais.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-100"
                  >
                    <CheckCircle2
                      className="h-5 w-5 text-brand-500 mt-0.5 shrink-0"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="text-sm text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Artigos em destaque ───────────────────── */}
        <section className="py-24 bg-white" aria-labelledby="artigos-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-2">
                  Conteúdo científico
                </p>
                <h2
                  id="artigos-heading"
                  className="font-display text-3xl font-bold text-slate-900"
                >
                  Artigos em destaque
                </h2>
              </div>
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:gap-2.5 transition-all duration-200 shrink-0"
              >
                Ver todos os artigos
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {artigosFeatured.map((artigo) => (
                <article
                  key={artigo.slug}
                  className="group flex flex-col rounded-2xl border border-slate-100 overflow-hidden hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300"
                >
                  <div className="bg-gradient-to-br from-brand-50 to-science-100 h-40 flex items-center justify-center">
                    <Microscope
                      className="h-12 w-12 text-brand-200 group-hover:text-brand-300 transition-colors duration-300"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                        {artigo.categoria}
                      </span>
                      <span className="text-xs text-slate-400">{artigo.leitura} de leitura</span>
                    </div>
                    <h3 className="font-display font-bold text-slate-900 text-base leading-snug mb-2 group-hover:text-brand-700 transition-colors duration-200">
                      {artigo.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed flex-1">
                      {artigo.excerpt}
                    </p>
                    <Link
                      href={`/blog/${artigo.slug}`}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:gap-2.5 transition-all duration-200"
                      aria-label={`Ler artigo: ${artigo.title}`}
                    >
                      Ler artigo
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Final ────────────────────────────── */}
        <section className="py-24" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <div
              className="rounded-3xl p-10 sm:p-14"
              style={{
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
              }}
            >
              <h2
                id="cta-heading"
                className="font-display text-3xl sm:text-4xl font-bold text-white mb-4"
              >
                Gerencie seus pacientes renais com inteligência
              </h2>
              <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                O Lab Evolution centraliza laudos, histórico clínico e dashboards de biomarcadores
                renais em uma plataforma segura e intuitiva.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-brand-700 font-bold text-sm hover:bg-blue-50 transition-all duration-200 shadow-lg"
                >
                  Acessar gratuitamente
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/ferramentas/calculadora-tfg"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-all duration-200"
                >
                  Calcular TFG grátis
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
