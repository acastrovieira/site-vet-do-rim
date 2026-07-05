'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Calculator,
  FlaskConical,
  HeartPulse,
  Scale,
  Droplets,
  Zap,
  ClipboardList,
  BarChart3,
  ArrowRight,
} from 'lucide-react'

const ferramentas = [
  {
    icon: Calculator,
    title: 'Calculadora TFG',
    description: 'Taxa de Filtração Glomerular em cães e gatos com fórmulas SDMA e creatinina.',
    href: '/ferramentas/calculadora-tfg',
    cor: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    iconCor: 'text-blue-400',
    badge: 'Mais usado',
    cta: 'Acessar',
  },
  {
    icon: FlaskConical,
    title: 'Estadiamento IRIS',
    description: 'Estadie a DRC em tempo real com base nos critérios IRIS 2023.',
    href: '/ferramentas/estadiamento-iris',
    cor: 'from-violet-500/20 to-violet-600/10 border-violet-500/20',
    iconCor: 'text-violet-400',
    badge: null,
    cta: 'Acessar',
  },
  {
    icon: Scale,
    title: 'Controle de Peso',
    description: 'Acompanhe a evolução ponderal e calcule variações percentuais.',
    href: '/ferramentas/controle-de-peso',
    cor: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
    iconCor: 'text-emerald-400',
    badge: null,
    cta: 'Acessar',
  },
  {
    icon: HeartPulse,
    title: 'Dieta Renal',
    description: 'Cálculo de necessidades nutricionais individualizadas para nefropatas.',
    href: '/ferramentas/dieta-renal',
    cor: 'from-rose-500/20 to-rose-600/10 border-rose-500/20',
    iconCor: 'text-rose-400',
    badge: null,
    cta: 'Acessar',
  },
  {
    icon: Droplets,
    title: 'Fluidoterapia',
    description: 'Cálculo de taxa de infusão, déficit hídrico e manutenção.',
    href: '/ferramentas/fluidoterapia',
    cor: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20',
    iconCor: 'text-cyan-400',
    badge: 'Login vet',
    cta: 'Entrar',
  },
  {
    icon: Zap,
    title: 'Injúria Renal Aguda',
    description: 'Critérios IRIS AKI, grau de estadiamento e recomendações terapêuticas.',
    href: '/ferramentas/injuria-renal-aguda',
    cor: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
    iconCor: 'text-amber-400',
    badge: 'Login vet',
    cta: 'Entrar',
  },
  {
    icon: ClipboardList,
    title: 'Planilha Laboratorial',
    description: 'Gere relatórios tabulares de exames com interpretação clínica automática.',
    href: '/ferramentas/planilha-laboratorial',
    cor: 'from-gold-400/20 to-gold-500/10 border-gold-400/20',
    iconCor: 'text-gold-400',
    badge: 'Freemium',
    cta: 'Acessar',
  },
  {
    icon: BarChart3,
    title: 'Reposição Eletrolítica',
    description: 'Calcule déficits de sódio, potássio e bicarbonato com segurança.',
    href: '/ferramentas/reposicao-eletrolitica',
    cor: 'from-pink-500/20 to-pink-600/10 border-pink-500/20',
    iconCor: 'text-pink-400',
    badge: 'Login vet',
    cta: 'Entrar',
  },
]

/**
 * Grid de ferramentas clínicas com efeito hover 3D e indicadores de badge.
 */
export function FerramentasShowcase() {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {ferramentas.map(({ icon: Icon, title, description, href, cor, iconCor, badge, cta }) => (
        <Link
          key={title}
          href={href}
          onMouseEnter={() => setHovered(title)}
          onMouseLeave={() => setHovered(null)}
          className={`group relative flex flex-col gap-3 p-5 rounded-2xl border bg-gradient-to-br ${cor} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20`}
          style={{
            transform: hovered === title
              ? 'translateY(-4px) rotateX(2deg)'
              : 'translateY(0) rotateX(0deg)',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {badge && (
            <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold-400/20 text-gold-400 border border-gold-400/30">
              {badge}
            </span>
          )}

          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 ${iconCor} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-5 h-5" strokeWidth={1.8} />
          </div>

          <div>
            <h3 className="font-display font-semibold text-white text-sm leading-snug mb-1">
              {title}
            </h3>
            <p className="text-xs text-white/50 leading-relaxed">
              {description}
            </p>
          </div>

          <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-white/40 group-hover:text-white/70 transition-colors duration-200">
            {cta}
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
          </div>
        </Link>
      ))}
    </div>
  )
}
