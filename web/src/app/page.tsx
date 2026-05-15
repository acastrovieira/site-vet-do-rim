import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
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
  Star,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Nefrologia e Urologia Veterinária de Alta Complexidade',
  description:
    'Vet do Rim — especialistas em doenças renais e urológicas de cães e gatos. Tratamento individualizado, empatia e rigor técnico científico.',
  alternates: { canonical: '/' },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'VeterinaryCare',
  name: 'Vet do Rim',
  url: 'https://vetdorim.com.br',
  description: 'Especialistas em nefrologia e urologia veterinária de alta complexidade.',
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

const depoimentos = [
  {
    nome: 'Ana Paula S.',
    pet: 'Tutora do Thor (labrador, 9 anos)',
    nota: 5,
    texto:
      'O Thor foi diagnosticado com DRC estágio 3 e graças ao acompanhamento do Vet do Rim conseguimos estabilizar a creatinina e dar muito mais qualidade de vida pra ele. Atendimento humanizado e sempre disponível.',
    inicial: 'A',
    cor: 'bg-blue-100 text-blue-700',
  },
  {
    nome: 'Carlos Menezes',
    pet: 'Tutor da Mimi (gata persa, 12 anos)',
    nota: 5,
    texto:
      'A Mimi sofreu uma obstrução uretral e o suporte foi excepcional. Explicaram tudo com clareza, sem jargões, e a recuperação foi muito além do que esperávamos.',
    inicial: 'C',
    cor: 'bg-gold-100 text-gold-700',
  },
  {
    nome: 'Fernanda Lopes',
    pet: 'Tutora da Bella (shih-tzu, 7 anos)',
    nota: 5,
    texto:
      'Além do cuidado clínico impecável, o Lab Evolution me permite acompanhar os exames da Bella em tempo real. Me sinto segura e bem informada em cada etapa.',
    inicial: 'F',
    cor: 'bg-emerald-100 text-emerald-700',
  },
  {
    nome: 'Rodrigo Almeida',
    pet: 'Tutor do Duque (golden, 11 anos)',
    nota: 5,
    texto:
      'Médica veterinária extremamente competente e empática. Conseguiu reverter uma situação que parecia sem saída. Hoje o Duque está bem e feliz graças ao trabalho dela.',
    inicial: 'R',
    cor: 'bg-purple-100 text-purple-700',
  },
  {
    nome: 'Juliana Costa',
    pet: 'Tutora do Simba (gato siamês, 8 anos)',
    nota: 5,
    texto:
      'O Simba tem cálculos renais recorrentes e o protocolo individualizado do Vet do Rim reduziu drasticamente as crises. Recomendo a qualquer tutor que busca seriedade e cuidado.',
    inicial: 'J',
    cor: 'bg-rose-100 text-rose-700',
  },
  {
    nome: 'Marcos Vieira',
    pet: 'Tutor da Luna (cocker, 10 anos)',
    nota: 5,
    texto:
      'Atendimento diferenciado do início ao fim. Relatório detalhado após cada consulta, responde dúvidas com agilidade e nunca se sentiu como mais um número. Excelência em tudo.',
    inicial: 'M',
    cor: 'bg-cyan-100 text-cyan-700',
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
        {/* ── Hero com gradiente azul profundo ── */}
        <section
          className="relative min-h-screen flex items-center overflow-hidden"
          aria-labelledby="hero-heading"
          style={{
            background:
              'linear-gradient(150deg, #080F20 0%, #1A2E5A 40%, #1e4080 70%, #1d6fa8 100%)',
          }}
        >
          {/* Grid decorativo */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '50px 50px',
            }}
            aria-hidden
          />
          {/* Glow central */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(30,130,200,0.25) 0%, transparent 70%)',
            }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-32 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-semibold uppercase tracking-wider mb-8 animate-fade-up">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse" aria-hidden />
              Nefrologia &amp; Urologia Veterinária
            </div>

            <h1
              id="hero-heading"
              className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-white text-balance leading-[1.05] animate-fade-up"
              style={{ animationDelay: '0.1s', textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}
            >
              Cuidado renal{' '}
              <span className="text-gradient-gold">especializado</span>
              <br />
              para o seu animal
            </h1>

            <p
              className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed text-balance animate-fade-up"
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
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-gold-500 text-white font-bold text-sm hover:bg-gold-600 transition-all duration-200 shadow-lg shadow-gold-500/30 hover:-translate-y-0.5"
              >
                Calcular TFG grátis
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/blog"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-all duration-200"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Explorar artigos
              </Link>
            </div>

            <p
              className="mt-10 text-xs text-white/40 animate-fade-up"
              style={{ animationDelay: '0.4s' }}
            >
              Referência em nefrologia veterinária · Protocolos IRIS e ACVIM · Educação continuada
            </p>
          </div>

          {/* Wave de transição */}
          <div className="absolute bottom-0 inset-x-0 h-16 sm:h-24" aria-hidden>
            <svg viewBox="0 0 1440 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0 96L1440 96L1440 30C1200 80 960 96 720 80C480 64 240 20 0 40L0 96Z" fill="#ffffff" />
            </svg>
          </div>
        </section>

        {/* ── Especialidades ── */}
        <section id="especialidades" className="py-24 bg-white" aria-labelledby="especialidades-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
                Áreas de atuação
              </p>
              <h2 id="especialidades-heading" className="font-display text-3xl sm:text-4xl font-bold text-slate-900">
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
                  className="group p-6 rounded-2xl border border-slate-100 bg-white hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/8 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
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

        {/* ── Galeria de fotos clínicas ── */}
        <section className="py-24 bg-science-50" aria-label="Estrutura clínica">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
                Nossa estrutura
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">
                Tecnologia a serviço da saúde do seu pet
              </h2>
              <p className="mt-3 text-slate-500 max-w-xl mx-auto">
                Equipamentos de ponta, ambiente acolhedor e uma equipe dedicada ao bem-estar
                dos seus pacientes renais.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Foto grande */}
              <div className="md:col-span-2 relative h-72 md:h-80 rounded-3xl overflow-hidden shadow-xl">
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(135deg, #1A2E5A 0%, #1e6fa8 50%, #0ea5e9 100%)',
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-8">
                  <Microscope className="h-16 w-16 mb-4 opacity-60" strokeWidth={1} />
                  <p className="font-display font-bold text-xl opacity-80">Laboratório de Nefrologia</p>
                  <p className="text-sm opacity-50 mt-1">Análises bioquímicas e urológicas avançadas</p>
                </div>
              </div>
              {/* Fotos menores */}
              <div className="flex flex-col gap-5">
                <div className="relative h-36 rounded-2xl overflow-hidden shadow-lg">
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(135deg, #0f2a52 0%, #1A2E5A 100%)' }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                    <HeartPulse className="h-10 w-10 mb-2 opacity-60" strokeWidth={1.5} />
                    <p className="text-sm font-semibold opacity-70">Cuidados Paliativos</p>
                  </div>
                </div>
                <div className="relative h-36 rounded-2xl overflow-hidden shadow-lg">
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8932A 100%)' }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                    <BarChart3 className="h-10 w-10 mb-2 opacity-70" strokeWidth={1.5} />
                    <p className="text-sm font-semibold opacity-80">Lab Evolution IA</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Diferenciais ── */}
        <section id="sobre" className="py-24 bg-white" aria-labelledby="diferenciais-heading">
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
                    className="flex items-start gap-3 p-4 rounded-xl bg-science-50 border border-slate-100 hover:border-brand-200 transition-colors duration-200"
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

        {/* ── Avaliações de clientes ── */}
        <section className="py-24" aria-labelledby="avaliacoes-heading" style={{
          background: 'linear-gradient(160deg, #080F20 0%, #1A2E5A 50%, #0f3a6e 100%)',
        }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
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
              <p className="mt-3 text-white/50 max-w-xl mx-auto">
                Histórias reais de tutores que confiaram o cuidado de seus companheiros ao Vet do Rim.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {depoimentos.map((dep) => (
                <article
                  key={dep.nome}
                  className="relative p-6 rounded-2xl border border-white/10 hover:border-gold-400/30 transition-all duration-300 hover:-translate-y-1"
                  style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}
                >
                  {/* Estrelas */}
                  <div className="flex gap-0.5 mb-4" aria-label={`${dep.nota} estrelas`}>
                    {Array.from({ length: dep.nota }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-gold-400 text-gold-400" aria-hidden />
                    ))}
                  </div>
                  {/* Texto */}
                  <p className="text-sm text-white/75 leading-relaxed mb-5 italic">
                    &ldquo;{dep.texto}&rdquo;
                  </p>
                  {/* Autor */}
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${dep.cor}`}>
                      {dep.inicial}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{dep.nome}</p>
                      <p className="text-xs text-white/40">{dep.pet}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Artigos em destaque ── */}
        <section className="py-24 bg-white" aria-labelledby="artigos-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-2">
                  Conteúdo científico
                </p>
                <h2 id="artigos-heading" className="font-display text-3xl font-bold text-slate-900">
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
                  <div
                    className="h-40 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #EEF1F8 0%, #d3daf0 100%)' }}
                  >
                    <Microscope
                      className="h-12 w-12 text-brand-200 group-hover:text-brand-400 transition-colors duration-300"
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

        {/* ── CTA Final ── */}
        <section className="py-24 bg-science-50" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <div
              className="rounded-3xl p-10 sm:p-14"
              style={{ background: 'linear-gradient(135deg, #1A2E5A 0%, #1e6fa8 100%)' }}
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
