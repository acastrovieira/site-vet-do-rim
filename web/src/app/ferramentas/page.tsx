import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { Activity, ChevronRight, Lock, FlaskConical, Droplets, TestTube, Scale, UtensilsCrossed, Zap } from 'lucide-react'


export const metadata: Metadata = {
  title: 'Ferramentas Clínicas Gratuitas — Nefrologia Veterinária | Vet do Rim',
  description:
    'Ferramentas gratuitas de nefrologia veterinária: Estadiamento IRIS da DRC, Injúria Renal Aguda, Fluidoterapia e Reposição Eletrolítica para cães e gatos.',
  keywords: [
    'ferramentas nefrologia veterinária',
    'estadiamento IRIS DRC',
    'injúria renal aguda cão gato',
    'doença renal crônica cão gato',
    'fluidoterapia veterinária',
    'ferramenta gratuita veterinária',
  ],
  alternates: { canonical: '/ferramentas' },
}

const activeTools = [
  {
    href: '/ferramentas/estadiamento-iris',
    icon: Activity,
    title: 'Estadiamento IRIS da DRC',
    subtitle: 'Doença Renal Crônica',
    description:
      'Visualize o estágio da DRC conforme as diretrizes IRIS 2023. Inclui sub-estadiamento por proteinúria (UPC) e pressão arterial. Modo tutor e modo veterinário.',
    tags: ['IRIS 2023', 'Proteinúria', 'Pressão arterial', 'Progressão'],
    iconBg: 'bg-gold-50',
    iconColor: 'text-gold-500',
  },
  {
    href: '/ferramentas/injuria-renal-aguda',
    icon: Zap,
    title: 'Classificação de Injúria Renal Aguda',
    subtitle: 'IRIS AKI · KDIGO · Condutas por Grau',
    description:
      'Classifique a IRA em cães e gatos conforme o sistema IRIS AKI (Graus I–V). Inclui critério de creatinina, débito urinário e condutas recomendadas por grau de gravidade. Baseada nas diretrizes IRIS 2016 e KDIGO.',
    tags: ['IRIS AKI', 'KDIGO', 'Oligúria', 'Urgência renal'],
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
  },
  {
    href: '/ferramentas/planilha-laboratorial',
    icon: FlaskConical,
    title: 'Planilha Laboratorial',
    subtitle: 'Acompanhamento Evolutivo',
    description:
      'Cadastre pacientes e acompanhe a evolução dos exames laboratoriais com planilha visual interativa. Insira dados manualmente e exporte em PDF gratuitamente.',
    tags: ['Hemograma', 'Bioquímica', 'Urinálise', 'PDF Gratuito'],
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    badge: 'Freemium',
  },
  {
    href: '/ferramentas/fluidoterapia',
    icon: Droplets,
    title: 'Calculadora de Fluidoterapia',
    subtitle: 'Manutenção, Déficit e Ressuscitação',
    description:
      'Calcule taxas de manutenção hídrica, reposição de déficit por desidratação e bolus de ressuscitação para cães e gatos. Baseada nas diretrizes AAHA/AAFP 2013.',
    tags: ['Manutenção', 'Déficit hídrico', 'Bolus de choque', 'AAHA/AAFP'],
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-500',
  },
  {
    href: '/ferramentas/reposicao-eletrolitica',
    icon: TestTube,
    title: 'Reposição Eletrolítica',
    subtitle: 'K⁺ · HCO₃⁻ · Ca²⁺ · PO₄³⁻ · Mg²⁺',
    description:
      'Calcule reposição de potássio, bicarbonato, cálcio, fósforo e magnésio em cães e gatos. Protocolos baseados em DiBartola 4ª ed. e diretrizes ACVIM atualizadas.',
    tags: ['Hipocalemia', 'Acidose metabólica', 'Hipocalcemia', 'DiBartola'],
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
  },
  {
    href: '/ferramentas/controle-de-peso',
    icon: Scale,
    title: 'Controle de Peso',
    subtitle: 'Histórico Evolutivo · ECC',
    description:
      'Registre e acompanhe a evolução do peso corporal e do Escore de Condição Corporal (ECC) do paciente. Histórico visual com gráfico e exportação CSV gratuita. Sem cadastro necessário.',
    tags: ['Peso corporal', 'ECC WSAVA', 'Histórico', 'CSV Gratuito'],
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
  {
    href: '/ferramentas/dieta-renal',
    icon: UtensilsCrossed,
    title: 'Dieta Terapêutica Renal',
    subtitle: 'Royal Canin · Hill\'s · Premier · Vet Life',
    description:
      'Calcule a quantidade diária de dieta renal por espécie, peso atual, ECC e marca. Ajuste automático pelo escore corporal. Comparativo entre Royal Canin, Hill\'s k/d, Premier Pet e Vet Life Farmina.',
    tags: ['Dieta renal', 'ECC ajuste', 'Multimarca', 'Cão e Gato'],
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
  },
]

export default function FerramentasPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-science-50 pt-24 pb-20">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-xs font-semibold text-brand-500 mb-5">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            Ferramentas Clínicas Gratuitas
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight text-gradient-brand mb-4">
            Ferramentas de Nefrologia
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Calculadoras e modelos clínicos baseados nas diretrizes{' '}
            <strong className="text-slate-800">IRIS 2023</strong> e{' '}
            <strong className="text-slate-800">ACVIM</strong> para apoio ao diagnóstico
            e estadiamento da doença renal crônica em cães e gatos.
          </p>
        </section>

        {/* Ferramentas ativas */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {activeTools.map((tool) => {
              const Icon = tool.icon
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex flex-col bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-brand-100 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className={`p-2.5 rounded-xl ${tool.iconBg}`}>
                      <Icon className={`h-5 w-5 ${tool.iconColor}`} strokeWidth={1.75} aria-hidden />
                    </div>
                    {'badge' in tool && tool.badge === 'Freemium' ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-gold-50 to-brand-50 text-gold-600 border border-gold-200/60">
                        ✨ Freemium
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        Gratuito
                      </span>
                    )}
                  </div>
                  <h2 className="font-display font-bold text-lg text-slate-900 leading-tight mb-1">
                    {tool.title}
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">
                    {tool.subtitle}
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed flex-1 mb-5">
                    {tool.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {tool.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-slate-500 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-brand-500 group-hover:gap-2 transition-all duration-200">
                    Acessar ferramenta
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Card em breve — sem interatividade, Server Component safe */}
          <div className="bg-white/60 rounded-2xl border border-dashed border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 opacity-70">
            <div className="p-2.5 rounded-xl bg-slate-100 shrink-0">
              <Lock className="h-5 w-5 text-slate-400" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="font-display font-bold text-base text-slate-700">Portal do Tutor</h2>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                  Em breve
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Acompanhamento longitudinal de biomarcadores renais e comunicação com o veterinário.
                Disponível mediante convite do seu veterinário.
              </p>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-16 text-center">
          <p className="text-slate-400 text-sm leading-relaxed">
            Ferramentas baseadas nas diretrizes{' '}
            <a
              href="https://www.iris-kidney.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 font-semibold hover:underline"
            >
              IRIS 2023
            </a>
            . Caráter exclusivamente educacional e de suporte clínico.
            Não substituem a avaliação veterinária presencial.
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
