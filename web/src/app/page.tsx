import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FlaskConical,
  Microscope,
  HeartPulse,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Sparkles,
} from 'lucide-react'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { AnimatedStats } from '@/components/marketing/AnimatedStats'
import { FerramentasShowcase } from '@/components/marketing/FerramentasShowcase'
import { TestimonialsCarousel } from '@/components/marketing/TestimonialsCarousel'
import { ProductDemo } from '@/components/marketing/ProductDemo'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'

export const metadata: Metadata = {
  title: 'Nefrologia e Urologia Veterinária Avançada',
  description:
    'Vet do Rim — especialistas em doenças renais e urológicas de cães e gatos. Tratamento individualizado, empatia e rigor técnico científico.',
  alternates: { canonical: '/' },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'VeterinaryCare',
  name: 'Vet do Rim',
  url: 'https://vetdorim.com.br',
  description: 'Especialistas em nefrologia e urologia veterinária avançada.',
  medicalSpecialty: 'Nephrology',
  sameAs: ['https://instagram.com/vetdorim', 'https://youtube.com/@vetdorim'],
}

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

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Header />

      <main id="main-content">
        {/* ══════════════════════════════════════════════════════════
            HERO — Clinical Premium Light
        ══════════════════════════════════════════════════════════ */}
        <section
          className="relative min-h-screen flex items-center overflow-hidden"
          aria-labelledby="hero-heading"
          style={{
            background: 'linear-gradient(170deg, #FFFFFF 0%, #F0F4FA 35%, #E8EEF8 60%, #EEF1F8 100%)',
          }}
        >
          {/* Aurora light — manchas suaves de cor */}
          <div className="aurora-light" aria-hidden />

          {/* Medical grid pattern sutil */}
          <div className="absolute inset-0 medical-grid opacity-50" aria-hidden />

          {/* Orbs decorativos sutis */}
          <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full opacity-40 blur-[100px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(26, 46, 90, 0.08) 0%, transparent 70%)' }}
            aria-hidden />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-30 blur-[80px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(201, 168, 76, 0.08) 0%, transparent 70%)' }}
            aria-hidden />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-32">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              {/* Coluna de texto */}
              <div className="flex-1 text-center lg:text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-brand-500/15 text-brand-500 text-xs font-semibold uppercase tracking-widest mb-10 animate-fade-up"
                  style={{ background: 'rgba(26, 46, 90, 0.04)', backdropFilter: 'blur(12px)' }}>
                  <span className="inline-block h-2 w-2 rounded-full bg-gold-400 animate-pulse" aria-hidden />
                  Nefrologia & Urologia Veterinária
                </div>

                {/* Headline */}
                <h1
                  id="hero-heading"
                  className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-brand-900 leading-[1.05] text-balance animate-fade-up"
                  style={{ animationDelay: '0.1s' }}
                >
                  Cuidado renal{' '}
                  <span className="text-gradient-gold">especializado</span>
                  <br />
                  para o seu animal
                </h1>

                <p
                  className="mt-6 text-lg sm:text-xl text-science-700 max-w-2xl mx-auto lg:mx-0 leading-relaxed text-balance animate-fade-up"
                  style={{ animationDelay: '0.2s' }}
                >
                  Medicina veterinária de alta complexidade com rigor técnico científico,
                  empatia e tecnologia de ponta. Doenças renais e urológicas tratadas com
                  protocolos baseados em evidências.
                </p>

                {/* CTAs */}
                <div
                  className="mt-10 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-fade-up"
                  style={{ animationDelay: '0.3s' }}
                >
                  <Link
                    href="/ferramentas/calculadora-tfg"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm transition-all duration-300 hover:-translate-y-1 active:translate-y-0 shimmer-gold"
                    style={{
                      background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #B8932A 100%)',
                      boxShadow: '0 8px 30px rgba(201,168,76,0.25)',
                      color: '#0A0A0C',
                    }}
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Calcular TFG grátis
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/blog"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-brand-500/20 text-brand-500 font-semibold text-sm hover:bg-brand-500/5 hover:-translate-y-1 transition-all duration-300 hover:border-brand-500/40"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden />
                    Explorar artigos
                  </Link>
                </div>

                <p
                  className="mt-10 text-xs text-science-500 animate-fade-up"
                  style={{ animationDelay: '0.4s' }}
                >
                  Referência em nefrologia veterinária · Protocolos IRIS e ACVIM · Educação continuada
                </p>

                {/* Redes sociais */}
                <div
                  className="mt-5 flex items-center justify-center lg:justify-start gap-5 animate-fade-up"
                  style={{ animationDelay: '0.5s' }}
                >
                  <a
                    href="https://www.instagram.com/vetdorim/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Siga no Instagram @vetdorim"
                    className="flex items-center gap-1.5 text-science-500 hover:text-pink-500 transition-colors duration-200 text-xs font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    @vetdorim
                  </a>
                  <span className="text-science-200">·</span>
                  <a
                    href="https://wa.me/5527997987058"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp (27) 99798-7058"
                    className="flex items-center gap-1.5 text-science-500 hover:text-[#25D366] transition-colors duration-200 text-xs font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.849L.057 23.486a.5.5 0 00.611.64l5.801-1.522A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.002-1.368l-.36-.213-3.726.977.996-3.635-.234-.374A9.774 9.774 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                    </svg>
                    (27) 99798-7058
                  </a>
                </div>
              </div>

              {/* Coluna da Logo — flutuante com glow suave */}
              <div
                className="flex-shrink-0 animate-fade-up"
                style={{ animationDelay: '0.4s' }}
              >
                <div className="relative">
                  {/* Glow de fundo atrás da logo */}
                  <div
                    className="absolute inset-0 scale-125 rounded-full blur-[80px] opacity-25"
                    style={{ background: 'radial-gradient(circle, rgba(201, 168, 76, 0.4) 0%, rgba(26, 46, 90, 0.15) 50%, transparent 70%)' }}
                    aria-hidden
                  />
                  <VetDoRimLogo
                    className="w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72"
                    variant="color"
                    animated
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Wave de transição — para a seção branca seguinte */}
          <div className="absolute bottom-0 inset-x-0 h-20 sm:h-28" aria-hidden>
            <svg viewBox="0 0 1440 112" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0 112L1440 112L1440 40C1200 90 960 112 720 95C480 78 240 30 0 55L0 112Z" fill="#ffffff" />
            </svg>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            STATS ANIMADOS — Light clean
        ══════════════════════════════════════════════════════════ */}
        <section
          aria-label="Números do Vet do Rim"
          className="bg-white border-b border-slate-100"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedStats />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            ESPECIALIDADES — Clean medical cards
        ══════════════════════════════════════════════════════════ */}
        <section
          id="especialidades"
          className="py-24 relative overflow-hidden"
          aria-labelledby="especialidades-heading"
          style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}
        >
          <div className="aurora-light" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-3">
                Áreas de atuação
              </p>
              <h2
                id="especialidades-heading"
                className="font-display text-3xl sm:text-4xl font-bold text-brand-900"
              >
                Especialidades veterinárias
              </h2>
              <p className="mt-3 text-science-700 max-w-xl mx-auto">
                Diagnóstico preciso e manejo clínico especializado para as condições mais
                complexas do sistema renal e urinário.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {especialidades.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="group p-6 rounded-2xl bg-white border border-slate-100 hover-lift hover:border-gold-400/30 hover:shadow-xl transition-all duration-300"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-gold-500 group-hover:bg-gold-500 group-hover:text-white transition-all duration-300">
                    <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
                  </div>
                  <h3 className="font-display font-semibold text-brand-900 mb-2 text-sm leading-snug group-hover:text-gold-600 transition-colors duration-300">
                    {title}
                  </h3>
                  <p className="text-sm text-science-700 leading-relaxed">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            DEMO ANIMADO — Seção com contraste (navy) para destacar
        ══════════════════════════════════════════════════════════ */}
        <section
          id="demo"
          className="py-24 relative overflow-hidden"
          aria-labelledby="demo-heading"
          style={{ background: 'linear-gradient(180deg, #0f1e40 0%, #1A2E5A 50%, #0f1e40 100%)' }}
        >
          <div className="aurora" aria-hidden />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">
                Lab Evolution em ação
              </p>
              <h2
                id="demo-heading"
                className="font-display text-3xl sm:text-4xl font-bold text-white"
              >
                Veja como funciona
              </h2>
              <p className="mt-3 text-white/60 max-w-xl mx-auto">
                Desde o cadastro do tutor até a interpretação do laudo por IA — tudo em uma
                plataforma fluida e intuitiva.
              </p>
            </div>

            <ProductDemo />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            FERRAMENTAS CLÍNICAS — Seção dark (contraste com lab)
        ══════════════════════════════════════════════════════════ */}
        <section
          id="ferramentas"
          className="py-24 relative overflow-hidden"
          aria-labelledby="ferramentas-heading"
          style={{ background: 'linear-gradient(180deg, #1A2E5A 0%, #152245 50%, #0f1e40 100%)' }}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">
                Ferramentas clínicas
              </p>
              <h2
                id="ferramentas-heading"
                className="font-display text-3xl sm:text-4xl font-bold text-white"
              >
                8 ferramentas gratuitas
              </h2>
              <p className="mt-3 text-white/60 max-w-xl mx-auto">
                Calculadoras e recursos clínicos desenvolvidos para a rotina da nefrologia
                veterinária — sem cadastro, sem custo.
              </p>
            </div>

            <FerramentasShowcase />

            <div className="text-center mt-8">
              <Link
                href="/ferramentas"
                className="inline-flex items-center gap-2 text-sm font-semibold text-gold-400 hover:gap-3 transition-all duration-200 hover:text-gold-200"
              >
                Ver todas as ferramentas
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            DIFERENCIAIS — Clean light
        ══════════════════════════════════════════════════════════ */}
        <section
          id="sobre"
          className="py-24 relative overflow-hidden"
          aria-labelledby="diferenciais-heading"
          style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}
        >
          <div className="aurora-light" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-3">
                  Por que escolher
                </p>
                <h2
                  id="diferenciais-heading"
                  className="font-display text-3xl sm:text-4xl font-bold text-brand-900 mb-5"
                >
                  Medicina veterinária de ponta, com o cuidado que o seu animal merece
                </h2>
                <p className="text-science-700 leading-relaxed mb-8">
                  Unimos rigor técnico científico baseado em protocolos internacionais IRIS e ACVIM
                  com um atendimento humanizado e tecnologia digital para acompanhamento contínuo.
                </p>
                <Link
                  href="/lab"
                  className="inline-flex items-center gap-2 text-gold-600 font-semibold text-sm hover:gap-3 transition-all duration-200"
                >
                  Conhecer o Lab Evolution
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {diferenciais.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-100 hover-lift hover:border-gold-400/30 transition-all duration-300"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <CheckCircle2
                      className="h-5 w-5 text-gold-500 mt-0.5 shrink-0"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="text-sm text-science-700 font-medium">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            DEPOIMENTOS — Soft navy (não tão dark)
        ══════════════════════════════════════════════════════════ */}
        <section
          className="py-24 relative overflow-hidden"
          aria-labelledby="avaliacoes-heading"
          style={{ background: 'linear-gradient(160deg, #1A2E5A 0%, #243B6A 50%, #1A2E5A 100%)' }}
        >
          <div className="aurora" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">
                Depoimentos
              </p>
              <h2
                id="avaliacoes-heading"
                className="font-display text-3xl sm:text-4xl font-bold text-white"
              >
                O que dizem os tutores
              </h2>
              <p className="mt-3 text-white/60 max-w-xl mx-auto">
                Histórias reais de tutores que confiaram o cuidado de seus companheiros ao Vet do Rim.
              </p>
            </div>

            <TestimonialsCarousel />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            ARTIGOS EM DESTAQUE — Clean light
        ══════════════════════════════════════════════════════════ */}
        <section
          className="py-24 relative overflow-hidden"
          aria-labelledby="artigos-heading"
          style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}
        >
          <div className="aurora-light" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-2">
                  Conteúdo científico
                </p>
                <h2
                  id="artigos-heading"
                  className="font-display text-3xl font-bold text-brand-900"
                >
                  Artigos em destaque
                </h2>
              </div>
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600 hover:gap-2.5 transition-all duration-200 shrink-0"
              >
                Ver todos os artigos
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {artigosFeatured.map((artigo) => (
                <article
                  key={artigo.slug}
                  className="group flex flex-col rounded-2xl bg-white border border-slate-100 overflow-hidden hover-lift hover:border-gold-400/30 hover:shadow-xl transition-all duration-300"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                >
                  <div
                    className="h-40 flex items-center justify-center border-b border-slate-100 transition-all duration-300 relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #EEF1F8 0%, #F8FAFC 100%)' }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: 'radial-gradient(circle at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%)' }}
                      aria-hidden
                    />
                    <Microscope
                      className="h-12 w-12 text-brand-200 group-hover:text-gold-500 group-hover:scale-110 transition-all duration-300"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gold-50 text-gold-600 border border-gold-200">
                        {artigo.categoria}
                      </span>
                      <span className="text-xs text-science-500">
                        {artigo.leitura} de leitura
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-brand-900 text-base leading-snug mb-2 group-hover:text-gold-600 transition-colors duration-200">
                      {artigo.title}
                    </h3>
                    <p className="text-sm text-science-700 leading-relaxed flex-1">
                      {artigo.excerpt}
                    </p>
                    <Link
                      href={`/blog/${artigo.slug}`}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-600 hover:gap-2.5 transition-all duration-200"
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

        {/* ══════════════════════════════════════════════════════════
            CTA FINAL — Clean premium
        ══════════════════════════════════════════════════════════ */}
        <section
          className="py-24 relative overflow-hidden"
          aria-labelledby="cta-heading"
          style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)' }}
        >
          <div className="aurora-light" aria-hidden />

          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <div
              className="rounded-3xl p-10 sm:p-14 bg-white border border-slate-100 gradient-border"
              style={{ boxShadow: '0 4px 30px rgba(26, 46, 90, 0.06), 0 0 60px rgba(201,168,76,0.04)' }}
            >
              <h2
                id="cta-heading"
                className="font-display text-3xl sm:text-4xl font-bold text-brand-900 mb-4"
              >
                Gerencie seus pacientes renais com inteligência
              </h2>
              <p className="text-science-700 text-lg mb-8 leading-relaxed">
                O Lab Evolution centraliza laudos, histórico clínico e dashboards de biomarcadores
                renais em uma plataforma segura e intuitiva.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:-translate-y-1 shimmer-gold"
                  style={{
                    background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #B8932A 100%)',
                    boxShadow: '0 6px 24px rgba(201,168,76,0.25)',
                    color: '#0A0A0C',
                  }}
                >
                  Acessar gratuitamente
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/ferramentas/calculadora-tfg"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-brand-500/20 bg-brand-50 text-brand-500 font-semibold text-sm hover:bg-brand-100 transition-all duration-300 hover:-translate-y-0.5"
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
