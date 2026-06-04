'use client'

import { useEffect, useRef, useState } from 'react'
import { Users, Wrench, Heart, BookOpen } from 'lucide-react'

interface StatItem {
  value: number
  suffix: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  iconBg: string
}

const stats: StatItem[] = [
  { value: 500, suffix: '+', label: 'Pacientes atendidos', icon: Users, color: 'text-blue-500', iconBg: 'bg-blue-50' },
  { value: 8, suffix: '', label: 'Ferramentas clínicas', icon: Wrench, color: 'text-emerald-500', iconBg: 'bg-emerald-50' },
  { value: 98, suffix: '%', label: 'Satisfação dos tutores', icon: Heart, color: 'text-rose-500', iconBg: 'bg-rose-50' },
  { value: 3, suffix: ' artigos', label: 'Conteúdo científico', icon: BookOpen, color: 'text-violet-500', iconBg: 'bg-violet-50' },
]

function useCountUp(target: number, duration = 1800, started: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!started) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, target, duration])

  return count
}

function StatCounter({ value, suffix, label, icon: Icon, color, iconBg, started, index }: StatItem & { started: boolean; index: number }) {
  const count = useCountUp(value, 1800, started)
  return (
    <div
      className="relative text-center p-6 rounded-2xl bg-white border border-slate-100 transition-all duration-500 hover:-translate-y-1 hover:border-gold-400/30 hover:shadow-xl group"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transitionDelay: `${index * 100}ms`,
      }}
    >
      {/* Ícone */}
      <div className={`mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg} ${color} transition-transform duration-300 group-hover:scale-110`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Número */}
      <p className="text-3xl sm:text-4xl font-bold font-display text-brand-900 tabular-nums">
        {count}
        <span className="text-gold-500">{suffix}</span>
      </p>

      {/* Label */}
      <p className="text-sm text-science-500 mt-2 font-medium">{label}</p>

      {/* Linha decorativa inferior */}
      <div className="mt-4 mx-auto w-8 h-0.5 rounded-full bg-gold-200 group-hover:w-12 group-hover:bg-gold-400 transition-all duration-300" />
    </div>
  )
}

/**
 * Seção de estatísticas animadas com Intersection Observer.
 * Os contadores disparam apenas quando a seção entra na viewport.
 * Design clean medical com cards brancos e sombras sutis.
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
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-12">
      {stats.map((stat, index) => (
        <StatCounter key={stat.label} {...stat} started={started} index={index} />
      ))}
    </div>
  )
}
