import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  FlaskConical,
  Microscope,
  HeartPulse,
  BookOpen,
  ArrowRight,
  BarChart3,
  Sparkles,
  Shield,
  Award,
  Phone,
} from 'lucide-react'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { PracticePrinciples } from '@/components/marketing/AnimatedStats'
import { FerramentasShowcase } from '@/components/marketing/FerramentasShowcase'
import { PublicEvidenceCommitments } from '@/components/marketing/TestimonialsCarousel'
import { ProductDemo } from '@/components/marketing/ProductDemo'
import { serializeJsonLd } from '@/lib/json-ld'

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
  sameAs: ['https://instagram.com/vetdorim'],
}

const especialidades = [
  {
    icon: FlaskConical,
    title: 'Nefrologia Veterinária',
    description:
      'Diagnóstico e manejo clínico de doenças renais agudas e crônicas em cães e gatos, com estadiamento IRIS e protocolos baseados em evidências.',
    color: '#1A3A6B',
    bg: '#EEF3FA',
  },
  {
    icon: Microscope,
    title: 'Urologia Veterinária',
    description:
      'Avaliação e tratamento de urolitíase, cistite, obstrução uretral e anomalias do trato urinário com abordagem minimamente invasiva.',
    color: '#0068BF',
    bg: '#EDF6FF',
  },
  {
    icon: HeartPulse,
    title: 'Cuidados Paliativos Renais',
    description:
      'Suporte de qualidade de vida, nutrição renal especializada e fluidoterapia adaptada para pacientes em estadio avançado.',
    color: '#7C3D4E',
    bg: '#FBF0F3',
  },
  {
    icon: BarChart3,
    title: 'Lab Evolution (IA)',
    description:
      'Plataforma digital com dashboards clínicos, acompanhamento longitudinal de biomarcadores renais e assistência por inteligência artificial.',
    color: '#2B4A7A',
    bg: '#EBF1FC',
  },
]

const diferenciais = [
  { text: 'Laudos com interpretação clínica detalhada', icon: Shield },
  { text: 'Condutas apoiadas por diretrizes e literatura veterinária', icon: Award },
  { text: 'Comunicação humanizada com tutores', icon: HeartPulse },
  { text: 'Dashboard digital de acompanhamento', icon: BarChart3 },
  { text: 'Educação continuada para vets parceiros', icon: BookOpen },
  { text: 'Telemedicina veterinária especializada', icon: Phone },
]

const artigosFeatured = [
  {
    slug: 'estadiamento-iris-doenca-renal-cronica',
    title: 'Estadiamento IRIS na DRC: guia prático para a clínica veterinária',
    excerpt:
      'O sistema IRIS é a referência mundial para estadiar a Doença Renal Crônica em cães e gatos. Entenda como aplicar na prática clínica.',
    categoria: 'Nefrologia',
    leitura: '8 min',
    icon: FlaskConical,
    accentColor: '#1A3A6B',
    accentBg: '#EEF3FA',
  },
  {
    slug: 'taxa-filtracao-glomerular-veterinaria',
    title: 'TFG, creatinina e SDMA: o que cada marcador realmente informa',
    excerpt:
      'Creatinina e SDMA ajudam na avaliação renal, mas não calculam diretamente a TFG. Entenda os limites.',
    categoria: 'Diagnóstico',
    leitura: '6 min',
    icon: Microscope,
    accentColor: '#0068BF',
    accentBg: '#EDF6FF',
  },
  {
    slug: 'manejo-nutricional-doenca-renal',
    title: 'Nutrição na Doença Renal Crônica: o que a evidência diz em 2025',
    excerpt:
      'Restrição de fósforo, proteína adequada e hidratação. Um guia completo sobre manejo nutricional renal baseado em evidências.',
    categoria: 'Nutrição',
    leitura: '12 min',
    icon: BookOpen,
    accentColor: '#8E7020',
    accentBg: '#FAF7F2',
  },
]

/* ── Componente de seção heading ──────────────────────────────── */
function SectionHeading({
  id,
  label,
  title,
  description,
  light = false,
}: {
  id?: string
  label: string
  title: string
  description?: string
  light?: boolean
}) {
  return (
    <div className="text-center mb-14">
      <p
        className={`text-xs font-semibold uppercase tracking-[0.12em] mb-3 ${
          light ? 'text-sky-300' : 'text-navy-600 dark:text-sand-300'
        }`}
      >
        {label}
      </p>
      <div className={`section-divider mb-4 ${light ? 'section-divider-sand' : 'section-divider'}`} />
      <h2
        id={id}
        className={`font-display text-3xl sm:text-4xl font-bold ${
          light ? 'text-white' : 'text-science-900 dark:text-navy-100'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-4 max-w-xl mx-auto leading-relaxed ${
            light ? 'text-white/60' : 'text-science-500 dark:text-navy-300'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationSchema) }}
      />
      <Header />

      <main id="main-content">

        {/* ════════════════════════════════════════════════════════
            HERO — Clinical Premium Light
            Fundo off-white, logo dourada centralizada,
            CTA verde clínico, texto grafite.
        ════════════════════════════════════════════════════════ */}
        <section
          className="relative min-h-screen flex items-center overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #F5F8FF 0%, #EBF1FC 45%, #E2ECFA 100%)',
          }}
          aria-labelledby="hero-heading"
        >
          {/* Aurora clínica muito discreta */}
          <div className="aurora-light" aria-hidden />

          {/* Grid de pontos sutis */}
          <div className="absolute inset-0 medical-grid" aria-hidden />

          {/* Luz difusa lateral direita */}
          <div
            className="absolute top-1/3 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(45,90,74,0.04) 0%, transparent 65%)',
              filter: 'blur(80px)',
            }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
            <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

              {/* ── Coluna de texto ──────────────────────────── */}
              <div className="flex-1 text-center lg:text-left">

                {/* Badge navy */}
                <div
                  className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-[0.1em] mb-8 animate-fade-up"
                  style={{
                    background: '#EEF3FA',
                    border: '1px solid rgba(26,58,107,0.18)',
                    color: '#1A3A6B',
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ background: '#1E4D8C' }}
                    aria-hidden
                  />
                  Nefrologia &amp; Urologia Veterinária
                </div>

                {/* Headline */}
                <h1
                  id="hero-heading"
                  className="font-display text-5xl sm:text-6xl lg:text-[4.5rem] font-bold leading-[1.06] text-balance animate-fade-up"
                  style={{ animationDelay: '0.08s', color: '#0D1F3C' }}
                >
                  Medicina renal{' '}
                  <span className="text-gradient-sky">especializada</span>
                  <br className="hidden sm:block" />
                  {' '}para o seu animal
                </h1>

                {/* Subtítulo */}
                <p
                  className="mt-6 text-lg sm:text-xl leading-relaxed text-balance max-w-2xl mx-auto lg:mx-0 animate-fade-up"
                  style={{ animationDelay: '0.16s', color: '#2B4A7A' }}
                >
                  Diagnóstico preciso e manejo clínico individualizado de doenças
                  renais e urológicas em cães e gatos — com protocolos IRIS, empatia
                  genuína e tecnologia de acompanhamento.
                </p>

                {/* CTAs */}
                <div
                  className="mt-10 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-fade-up"
                  style={{ animationDelay: '0.24s' }}
                >
                  <Link
                    href="/ferramentas/calculadora-tfg"
                    className="btn-primary shimmer-gold"
                    id="hero-cta-primary"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Consultar faixas IRIS
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/blog"
                    className="btn-secondary hero-light-button"
                    id="hero-cta-secondary"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden />
                    Explorar artigos
                  </Link>
                </div>

                {/* Credenciais */}
                <p
                  className="mt-8 text-xs animate-fade-up"
                  style={{ animationDelay: '0.32s', color: '#7A9BC8' }}
                >
                  Nefrologia veterinária · Ciência aplicada · Educação continuada
                </p>

                {/* Sociais */}
                <div
                  className="mt-5 flex items-center justify-center lg:justify-start gap-5 animate-fade-up"
                  style={{ animationDelay: '0.38s' }}
                >
                  <a
                    href="https://www.instagram.com/vetdorim/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram @vetdorim"
                    className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-200 hover:text-pink-600"
                    style={{ color: '#8FA89E' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    @vetdorim
                  </a>
                  <span style={{ color: '#C0DFD0' }}>·</span>
                  <a
                    href="https://wa.me/5527997987058"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp (27) 99798-7058"
                    className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-200 hover:text-[#25D366]"
                    style={{ color: '#8FA89E' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.849L.057 23.486a.5.5 0 00.611.64l5.801-1.522A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.002-1.368l-.36-.213-3.726.977.996-3.635-.234-.374A9.774 9.774 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                    </svg>
                    (27) 99798-7058
                  </a>
                </div>
              </div>

              {/* ── Coluna Dr. Anderson — terno navy, autoridade executiva ── */}
              <div
                className="relative flex-shrink-0 animate-fade-up hidden lg:block"
                style={{ animationDelay: '0.3s' }}
              >
                {/* Decoração: frame dourado atrás, levemente deslocado */}
                <div
                  className="absolute -top-5 -right-5 w-full h-full rounded-3xl"
                  style={{ background: 'rgba(200,169,122,0.07)', border: '1px solid rgba(200,169,122,0.18)' }}
                  aria-hidden
                />

                {/* Frame da foto — terno navy, autoridade executiva */}
                <div
                  className="relative overflow-hidden rounded-3xl"
                  style={{
                    width: '420px',
                    height: '620px',
                    boxShadow: '0 32px 80px rgba(9,21,48,0.28), 0 6px 24px rgba(9,21,48,0.15)',
                    border: '2px solid rgba(200,169,122,0.25)',
                  }}
                >
                  <Image
                    src="/images/dr-anderson-terno-azul.jpg"
                    alt="Dr. Anderson de Castro Vieira — Especialista em Nefrologia Veterinária"
                    fill
                    priority
                    className="object-cover object-top"
                    sizes="420px"
                  />
                  {/* Badge identitário no bottom */}
                  <div
                    className="absolute bottom-0 inset-x-0 px-5 py-4"
                    style={{
                      background: 'linear-gradient(to top, rgba(9,21,48,0.92) 0%, rgba(9,21,48,0.5) 60%, transparent 100%)',
                    }}
                  >
                    <p className="text-xs font-bold" style={{ color: '#C8A97A' }}>Dr. Anderson de Castro Vieira</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(200,225,255,0.65)' }}>Nefrologia &amp; Urologia Veterinária · CRMV-ES 0839</p>
                  </div>
                </div>

                {/* Badge: +18 anos de experiência */}
                <div
                  className="absolute -top-4 -left-4 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-full z-20"
                  style={{
                    background: 'linear-gradient(135deg, #C8A97A 0%, #A8780A 100%)',
                    boxShadow: '0 8px 24px rgba(200,169,122,0.45)',
                  }}
                >
                  <span className="text-lg font-bold leading-none" style={{ color: '#0C1E3D' }}>18+</span>
                  <span className="text-[9px] font-semibold text-center leading-tight" style={{ color: 'rgba(12,30,61,0.75)' }}>anos de{' '}<br />experiência</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transição suave para seção seguinte */}
          <div className="absolute bottom-0 inset-x-0 h-16" aria-hidden>
            <svg viewBox="0 0 1440 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 64L1440 64L1440 24C1200 54 960 64 720 54C480 44 240 14 0 32L0 64Z"
                className="fill-current text-white dark:text-[#0c1e3d]"
              />
            </svg>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            PRINCÍPIOS — Branco limpo
        ════════════════════════════════════════════════════════ */}
        <section
          aria-label="Princípios do Vet do Rim"
          className="bg-theme-white transition-colors duration-300"
          style={{ borderBottom: '1px solid var(--card-border, #D4E2F5)' }}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <PracticePrinciples />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            ESPECIALIDADES — Off-white clínico
        ════════════════════════════════════════════════════════ */}
        <section
          id="especialidades"
          className="py-24 relative overflow-hidden bg-theme-light transition-colors duration-300"
          aria-labelledby="especialidades-heading"
        >
          <div className="aurora-light" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

            <SectionHeading
              id="especialidades-heading"
              label="Áreas de atuação"
              title="Especialidades veterinárias"
              description="Diagnóstico preciso e manejo clínico especializado para as condições mais complexas do sistema renal e urinário."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {especialidades.map(({ icon: Icon, title, description, color, bg }) => (
                <article
                  key={title}
                  className="group p-6 rounded-2xl card-clinical"
                >
                  {/* Ícone com cor específica da especialidade */}
                  <div
                    className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110"
                    style={{ background: bg, color: color }}
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
                  </div>
                  <h3
                    className="font-display font-semibold mb-2 text-sm leading-snug transition-colors duration-300"
                    style={{ color: '#1A2B22' }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B8880' }}>
                    {description}
                  </p>

                  {/* Acento de cor no rodapé do card */}
                  <div
                    className="mt-5 h-0.5 w-8 rounded-full group-hover:w-14 transition-all duration-400"
                    style={{ background: color, opacity: 0.4 }}
                  />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            DEMO — Navy institucional sóbrio (seção escura moderada)
        ════════════════════════════════════════════════════════ */}
        <section
          id="demo"
          className="py-24 relative overflow-hidden"
          aria-labelledby="demo-heading"
          style={{ background: 'linear-gradient(180deg, #1A3A6B 0%, #0F2244 100%)' }}
        >
          <div className="aurora" aria-hidden />
          {/* Grid de pontos brancos muito sutis */}
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              id="demo-heading"
              label="Lab Evolution em ação"
              title="Veja como funciona"
              description="Desde o cadastro do tutor até a interpretação do laudo por IA — tudo em uma plataforma fluida e intuitiva."
              light
            />
            <ProductDemo />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            FERRAMENTAS — Verde clínico profundo
        ════════════════════════════════════════════════════════ */}
        <section
          id="ferramentas"
          className="py-24 relative overflow-hidden"
          aria-labelledby="ferramentas-heading"
          style={{ background: 'linear-gradient(180deg, #0F2244 0%, #091530 100%)' }}
        >
          <div className="aurora" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

            <SectionHeading
              id="ferramentas-heading"
              label="Ferramentas clínicas"
              title="Ferramentas públicas e profissionais"
              description="Recursos clínicos para a rotina da nefrologia veterinária. Parte funciona sem cadastro; ferramentas ainda não homologadas ficam indisponíveis e exibem claramente o status de revisão."
              light
            />

            <FerramentasShowcase />

            <div className="text-center mt-8">
              <Link
                href="/ferramentas"
                className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 hover:gap-3"
                style={{ color: 'rgba(200,169,122,0.85)' }}
              >
                Ver todas as ferramentas
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SOBRE A DRA. — Foto + Bio profissional
        ════════════════════════════════════════════════════════ */}
        <section
          id="sobre"
          className="py-24 relative overflow-hidden bg-theme-blue transition-colors duration-300"
          aria-labelledby="sobre-heading"
        >
          <div className="aurora-light" aria-hidden />
          <div className="sobre-light-content relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              {/* ── Foto da Dra. ──────────────────────────────────── */}
              <div className="relative flex justify-center lg:justify-start order-2 lg:order-1">

                {/* Decoração: retângulo navy atrás da foto */}
                <div
                  className="sobre-deco-bg absolute -bottom-6 -left-6 w-3/4 h-4/5 rounded-2xl hidden lg:block"
                  style={{ background: '#EEF3FA', border: '1px solid #D4E2F5' }}
                  aria-hidden
                />

                {/* Foto — slot para imagem real */}
                <div
                  className="relative z-10 w-full max-w-sm lg:max-w-none rounded-2xl overflow-hidden"
                  style={{
                    boxShadow: '0 20px 60px rgba(26,58,107,0.15), 0 4px 16px rgba(26,58,107,0.08)',
                    border: '3px solid rgba(200,169,122,0.2)',
                    aspectRatio: '3/4',
                  }}
                >
                  {/* Foto do Dr. Anderson — jaleco, clima clínico e acolhedor */}
                  <Image
                    src="/images/dr-anderson-jaleco.jpg"
                    alt="Dr. Anderson de Castro Vieira"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 400px, 500px"
                  />

                  {/* Badge dourado — CRM */}
                  <div
                    className="absolute bottom-5 left-5 right-5 rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background: 'rgba(12,30,61,0.88)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(200,169,122,0.25)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(200,169,122,0.15)' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.8" aria-hidden>
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: '#C8A97A' }}>CRMV-ES 0839</p>
                      <p className="text-xs" style={{ color: 'rgba(200,225,255,0.6)' }}>Nefrologia &amp; Urologia Veterinária</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Bio profissional ──────────────────────────────── */}
              <div className="order-1 lg:order-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#1A3A6B' }}>
                  Conheça o especialista
                </p>
                <div className="section-divider mb-5" style={{ margin: '0 0 1.25rem 0' }} />
                <h2
                  id="sobre-heading"
                  className="font-display text-3xl sm:text-4xl font-bold mb-1"
                  style={{ color: '#0D1F3C' }}
                >
                  Dr. Anderson de Castro Vieira
                </h2>
                <p className="text-sm font-medium mb-5" style={{ color: '#7A9BC8' }}>
                  Médico Veterinário · CRMV-ES 0839 · Especialista em Nefrologia e Urologia Veterinária
                </p>
                <p className="text-base leading-relaxed mb-4" style={{ color: '#4F72A6' }}>
                  Graduado em <strong style={{ color: '#1A3A6B' }}>Medicina Veterinária pela Universidade Vila Velha (UVV)</strong> em 2005,
                  atua na área de nefrologia e urologia veterinária desde <strong style={{ color: '#1A3A6B' }}>2006</strong> — mais de
                  18 anos dedicados ao diagnóstico e tratamento de doenças renais e urológicas em cães e gatos.
                </p>
                <p className="text-base leading-relaxed mb-8" style={{ color: '#4F72A6' }}>
                  Fundador do <strong style={{ color: '#1A3A6B' }}>Lab Evolution</strong>, plataforma digital que une tecnologia,
                  inteligência artificial e empatia clínica para oferecer ao tutor um acompanhamento contínuo e
                  transparente da saúde do seu animal.
                </p>

                {/* Formação acadêmica */}
                <div className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: '#1A3A6B' }}>
                    Formação
                  </p>
                  <ul className="space-y-3">
                    {[
                      { titulo: 'Graduação em Medicina Veterinária', inst: 'Universidade Vila Velha — UVV, 2005' },
                      { titulo: 'Pós-Graduação em Medicina Intensiva e Emergência de Pequenos Animais', inst: 'Universidade Federal do Semi Árido — UFERSA' },
                      { titulo: 'Pós-Graduação em Nefrologia e Urologia', inst: 'Unileya' },
                      { titulo: 'Pós-Graduação em Videocirurgia', inst: 'UFAPE — Universidade Federal do Agreste de Pernambuco' },
                    ].map((item) => (
                      <li key={item.titulo} className="flex items-start gap-3">
                        <div
                          className="check-icon-bg w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: '#EEF3FA' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#1A3A6B" strokeWidth="2.5" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-sm font-semibold block" style={{ color: '#0D1F3C' }}>{item.titulo}</span>
                          <span className="text-xs" style={{ color: '#7A9BC8' }}>{item.inst}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Diferenciais compactos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {diferenciais.slice(0, 4).map(({ text, icon: Icon }) => (
                    <div
                      key={text}
                      className="flex items-start gap-3 p-3 rounded-xl card-clinical group"
                    >
                      <div
                        className="diff-icon-bg w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: '#EEF3FA', color: '#1A3A6B' }}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#2B4A7A' }}>{text}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/lab"
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 hover:gap-3"
                  style={{ color: '#1A3A6B' }}
                >
                  Conhecer o Lab Evolution
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            EVIDÊNCIA PÚBLICA — Azul clínico
        ════════════════════════════════════════════════════════ */}
        <section
          className="py-24 relative overflow-hidden"
          aria-labelledby="evidencias-heading"
          style={{ background: 'linear-gradient(160deg, #1A3A6B 0%, #0F2244 100%)' }}
        >
          <div className="aurora" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              id="evidencias-heading"
              label="Transparência"
              title="Compromissos públicos verificáveis"
              description="Alegações de marketing clínico devem ter fonte, metodologia e consentimento antes da publicação."
              light
            />
            <PublicEvidenceCommitments />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            ARTIGOS — Off-white clínico
        ════════════════════════════════════════════════════════ */}
        <section
          className="py-24 relative overflow-hidden bg-theme-artigos transition-colors duration-300"
          aria-labelledby="artigos-heading"
        >
          <div className="aurora-light" aria-hidden />
          <div className="artigos-content relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

            {/* Header da seção */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
              <div>
                <p className="artigos-label text-xs font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: '#1A3A6B' }}>
                  Conteúdo científico
                </p>
                <div className="section-divider mb-3" style={{ margin: '0 0 0.75rem 0' }} />
                <h2
                  id="artigos-heading"
                  className="font-display text-3xl font-bold"
                  style={{ color: '#0D1F3C' }}
                >
                  Artigos em destaque
                </h2>
              </div>
              <Link
                href="/blog"
                className="artigos-link inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-200 hover:gap-2.5 shrink-0"
                style={{ color: '#2D5A4A' }}
              >
                Ver todos os artigos
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            {/* Cards de artigos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {artigosFeatured.map((artigo) => {
                const Icon = artigo.icon
                return (
                  <article
                    key={artigo.slug}
                    className="artigo-card group flex flex-col rounded-2xl card-clinical overflow-hidden"
                  >
                    {/* Thumb */}
                    <div
                      className="h-40 flex items-center justify-center relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${artigo.accentBg} 0%, #F7F9F8 100%)`,
                        borderBottom: '1px solid #E0EAE4',
                      }}
                    >
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                        style={{
                          background: `radial-gradient(circle at 50% 50%, ${artigo.accentColor}0D 0%, transparent 65%)`,
                        }}
                        aria-hidden
                      />
                      <Icon
                        className="h-12 w-12 transition-all duration-300 group-hover:scale-110"
                        strokeWidth={1.4}
                        style={{
                          color: `${artigo.accentColor}60`,
                        }}
                        aria-hidden
                      />
                    </div>

                    {/* Conteúdo */}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: artigo.accentBg,
                            color: artigo.accentColor,
                            border: `1px solid ${artigo.accentColor}25`,
                          }}
                        >
                          {artigo.categoria}
                        </span>
                        <span className="artigo-time text-xs" style={{ color: '#8FA89E' }}>
                          {artigo.leitura} de leitura
                        </span>
                      </div>
                      <h3
                        className="font-display font-bold text-base leading-snug mb-2 transition-colors duration-200"
                        style={{ color: '#1A2B22' }}
                      >
                        {artigo.title}
                      </h3>
                      <p className="text-sm leading-relaxed flex-1" style={{ color: '#6B8880' }}>
                        {artigo.excerpt}
                      </p>
                      <Link
                        href={`/blog/${artigo.slug}`}
                        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 hover:gap-2.5"
                        style={{ color: artigo.accentColor }}
                        aria-label={`Ler artigo: ${artigo.title}`}
                      >
                        Ler artigo
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            MANIFESTO — Foto P&B de fundo, quote de autoridade
        ════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden" style={{ minHeight: '500px' }} aria-label="Manifesto do Dr. Anderson">
          {/* Foto P&B como fundo — sobriedade e drama premium */}
          <div className="absolute inset-0">
            <Image
              src="/images/dr-anderson-pb.jpg"
              alt=""
              fill
              className="object-cover object-top"
              sizes="100vw"
              aria-hidden
            />
            {/* Overlay navy escuro com vinheta nas bordas */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, rgba(9,21,48,0.90) 0%, rgba(9,21,48,0.70) 45%, rgba(9,21,48,0.88) 100%)' }}
              aria-hidden
            />
          </div>

          {/* Conteúdo centralizado */}
          <div className="relative z-10 flex items-center justify-center min-h-[500px] px-6 py-20">
            <div className="max-w-3xl text-center">
              {/* Separador dourado */}
              <div className="flex items-center gap-4 justify-center mb-10" aria-hidden>
                <div className="h-px w-16" style={{ background: 'rgba(200,169,122,0.45)' }} />
                <div className="w-2 h-2 rounded-full" style={{ background: '#C8A97A' }} />
                <div className="h-px w-16" style={{ background: 'rgba(200,169,122,0.45)' }} />
              </div>

              <blockquote>
                <p className="font-display text-2xl sm:text-3xl lg:text-[2.4rem] font-bold leading-snug text-white mb-8">
                  “Cada diagnóstico renal é uma oportunidade de{' '}
                  <span style={{ color: '#C8A97A' }}>prolongar uma vida</span>{' '}
                  com qualidade e dignidade.”
                </p>
                <footer>
                  <p className="text-sm font-bold" style={{ color: '#C8A97A' }}>Dr. Anderson de Castro Vieira</p>
                  <p className="text-xs mt-1.5" style={{ color: 'rgba(200,225,255,0.45)' }}>Especialista em Nefrologia e Urologia Veterinária · +18 anos de experiência</p>
                </footer>
              </blockquote>

              {/* Separador dourado */}
              <div className="flex items-center gap-4 justify-center mt-10" aria-hidden>
                <div className="h-px w-16" style={{ background: 'rgba(200,169,122,0.45)' }} />
                <div className="w-2 h-2 rounded-full" style={{ background: '#C8A97A' }} />
                <div className="h-px w-16" style={{ background: 'rgba(200,169,122,0.45)' }} />
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            CTA FINAL — Split-screen: conteúdo + estetoscópio
        ════════════════════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden bg-theme-cta transition-colors duration-300"
          aria-labelledby="cta-heading"
        >
          <div className="aurora-light" aria-hidden />
          <div className="relative grid grid-cols-1 lg:grid-cols-2 min-h-[580px]">

            {/* Lado esquerdo — conteúdo CTA */}
            <div className="flex items-center justify-center px-8 sm:px-12 lg:px-16 py-20">
              <div className="cta-light-content max-w-md">
                {/* Logo símbolo */}
                <div className="mb-8">
                  <Image
                    src="/logo/symbol-gold.webp"
                    alt=""
                    width={56}
                    height={56}
                    loading="eager"
                    className="w-12 h-auto object-contain logo-glow"
                    aria-hidden
                    draggable={false}
                  />
                </div>

                <h2
                  id="cta-heading"
                  className="font-display text-3xl sm:text-4xl font-bold mb-4"
                  style={{ color: '#0D1F3C' }}
                >
                  Gerencie seus pacientes renais com inteligência
                </h2>
                <p className="text-lg mb-8 leading-relaxed" style={{ color: '#4F72A6' }}>
                  O Lab Evolution centraliza laudos, histórico clínico e dashboards
                  de biomarcadores renais em uma plataforma segura e intuitiva.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/auth/login"
                    className="btn-primary shimmer-gold"
                    id="cta-final-primary"
                  >
                    Acessar gratuitamente
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/ferramentas/calculadora-tfg"
                    className="btn-secondary"
                    id="cta-final-secondary"
                  >
                    Consultar faixas IRIS
                  </Link>
                </div>
              </div>
            </div>

            {/* Lado direito — foto com estetoscópio */}
            <div className="relative hidden lg:block">
              <Image
                src="/images/dr-anderson-estetoscopio.jpg"
                alt="Dr. Anderson de Castro Vieira com estetoscópio"
                fill
                className="object-cover object-top"
                sizes="50vw"
              />
              {/* Gradient fade da esquerda para fundir com o conteúdo */}
              <div
                className="cta-fade-left absolute inset-y-0 left-0 w-24 z-10"
                style={{ background: 'linear-gradient(to right, #EBF1FC, transparent)' }}
                aria-hidden
              />
              {/* Overlay sutil — mantém leveza sem escurecer demais */}
              <div
                className="absolute inset-0"
                style={{ background: 'rgba(9,21,48,0.06)' }}
                aria-hidden
              />
              {/* Badge de credencial no canto */}
              <div
                className="absolute bottom-8 left-8 right-8 rounded-2xl px-5 py-4 z-20"
                style={{
                  background: 'rgba(9,21,48,0.85)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(200,169,122,0.2)',
                }}
              >
                <p className="text-xs font-bold mb-0.5" style={{ color: '#C8A97A' }}>Lab Evolution</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(200,225,255,0.65)' }}>
                  Plataforma clínica digital desenvolvida pelo Dr. Anderson para o acompanhamento especializado de pacientes renais.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </>
  )
}
