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
    iconColor: 'text-clinical-600',
    iconBg: 'bg-clinical-50',
  },
  {
    value: 8,
    suffix: '',
    label: 'Ferramentas clínicas',
    icon: Wrench,
    iconColor: 'text-brand-500',
    iconBg: 'bg-brand-50',
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
      className="text-center p-7 rounded-2xl card-stat group"
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {/* Ícone */}
      <div
        className={`mx-auto w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${iconBg} ${iconColor} transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Número */}
      <p className="text-4xl sm:text-5xl font-bold font-display tabular-nums text-science-900">
        {count}
        <span className="text-clinical-600 text-3xl">{suffix}</span>
      </p>

      {/* Label */}
      <p className="text-sm text-science-500 mt-2 font-medium">{label}</p>

      {/* Linha decorativa */}
      <div className="mt-4 mx-auto w-8 h-0.5 rounded-full bg-clinical-200 group-hover:w-12 group-hover:bg-clinical-400 transition-all duration-400" />
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
