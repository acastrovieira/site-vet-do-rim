'use client'

import { useEffect, useRef, useState } from 'react'
import { Users, Wrench, Heart, BookOpen } from 'lucide-react'

interface StatItem {
  value: number
  suffix: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
}

const stats: StatItem[] = [
  {
    value: 500,
    suffix: '+',
    label: 'Pacientes atendidos',
    icon: Users,
    gradient: 'from-blue-400 to-blue-600',
  },
  {
    value: 8,
    suffix: '',
    label: 'Ferramentas clínicas',
    icon: Wrench,
    gradient: 'from-emerald-400 to-emerald-600',
  },
  {
    value: 98,
    suffix: '%',
    label: 'Satisfação dos tutores',
    icon: Heart,
    gradient: 'from-rose-400 to-rose-600',
  },
  {
    value: 3,
    suffix: ' artigos',
    label: 'Conteúdo científico',
    icon: BookOpen,
    gradient: 'from-violet-400 to-violet-600',
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
  gradient,
  started,
  index,
}: StatItem & { started: boolean; index: number }) {
  const count = useCountUp(value, 1800, started)

  return (
    <div
      className="relative text-center p-7 rounded-2xl card-premium group overflow-hidden"
      style={{
        transitionDelay: `${index * 100}ms`,
      }}
    >
      {/* Background glow sutil no hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(201,168,76,0.06) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      {/* Ícone com gradiente */}
      <div
        className={`relative mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${gradient} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>

      {/* Número */}
      <p className="text-4xl sm:text-5xl font-bold font-display tabular-nums">
        <span className="text-gradient-gold">{count}</span>
        <span className="text-gold-400 text-3xl">{suffix}</span>
      </p>

      {/* Label */}
      <p className="text-sm text-white/50 mt-2 font-medium tracking-wide">{label}</p>

      {/* Linha dourada inferior */}
      <div className="mt-5 mx-auto w-8 h-px rounded-full bg-gradient-to-r from-transparent via-gold-500 to-transparent group-hover:w-14 transition-all duration-500" />
    </div>
  )
}

/**
 * Seção de estatísticas animadas dark premium.
 * Contadores disparam quando a seção entra na viewport.
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
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 py-14">
      {stats.map((stat, index) => (
        <StatCounter key={stat.label} {...stat} started={started} index={index} />
      ))}
    </div>
  )
}
