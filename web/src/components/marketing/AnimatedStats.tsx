'use client'

import { useEffect, useRef, useState } from 'react'
import { Users, Wrench, Heart, BookOpen } from 'lucide-react'

interface StatItem {
  value: number
  suffix: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
}

const stats: StatItem[] = [
  {
    value: 500,
    suffix: '+',
    label: 'Pacientes atendidos',
    icon: Users,
    iconColor: 'text-navy-600',
    iconBg: 'bg-navy-50',
  },
  {
    value: 8,
    suffix: '',
    label: 'Ferramentas clínicas',
    icon: Wrench,
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-50',
  },
  {
    value: 98,
    suffix: '%',
    label: 'Satisfação dos tutores',
    icon: Heart,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-50',
  },
  {
    value: 3,
    suffix: ' artigos',
    label: 'Conteúdo científico',
    icon: BookOpen,
    iconColor: 'text-sand-600',
    iconBg: 'bg-sand-50',
  },
]

function useCountUp(target: number, duration = 1800, started: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!started) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, target, duration])

  return count
}

function StatCounter({
  value,
  suffix,
  label,
  icon: Icon,
  iconColor,
  iconBg,
  started,
  index,
}: StatItem & { started: boolean; index: number }) {
  const count = useCountUp(value, 1800, started)

  return (
    <div
      className="text-center p-6 sm:p-7 rounded-2xl transition-all duration-300 hover:scale-[1.03]"
      style={{
        transitionDelay: `${index * 80}ms`,
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Ícone com background translúcido elegante */}
      <div
        className="mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{
          background: 'rgba(200, 169, 122, 0.12)',
          color: '#C8A97A',
        }}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Número em branco com alta visibilidade */}
      <p className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display tabular-nums text-white tracking-tight">
        {count}
        <span className="text-2xl sm:text-3xl ml-0.5" style={{ color: '#C8A97A' }}>{suffix}</span>
      </p>

      {/* Label em branco fosco */}
      <p className="text-xs sm:text-sm mt-2 font-medium" style={{ color: 'rgba(255, 255, 255, 0.75)' }}>{label}</p>

      {/* Linha decorativa dourada sutil */}
      <div
        className="mt-4 mx-auto w-8 h-0.5 rounded-full transition-all duration-400"
        style={{ background: '#C8A97A', opacity: 0.4 }}
      />
    </div>
  )
}

/**
 * Estatísticas animadas — design clínico clean.
 * Contadores disparam ao entrar na viewport.
 */
export function AnimatedStats() {
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 py-12">
      {stats.map((stat, index) => (
        <StatCounter key={stat.label} {...stat} started={started} index={index} />
      ))}
    </div>
  )
}
