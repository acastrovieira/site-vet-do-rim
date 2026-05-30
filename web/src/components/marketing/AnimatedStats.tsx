'use client'

import { useEffect, useRef, useState } from 'react'

interface StatItem {
  value: number
  suffix: string
  label: string
}

const stats: StatItem[] = [
  { value: 500, suffix: '+', label: 'Pacientes atendidos' },
  { value: 8, suffix: '', label: 'Ferramentas clínicas' },
  { value: 98, suffix: '%', label: 'Satisfação dos tutores' },
  { value: 3, suffix: ' artigos', label: 'Conteúdo científico' },
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

function StatCounter({ value, suffix, label, started }: StatItem & { started: boolean }) {
  const count = useCountUp(value, 1800, started)
  return (
    <div className="text-center">
      <p className="text-3xl sm:text-4xl font-bold font-display text-white tabular-nums">
        {count}
        <span className="text-gold-400">{suffix}</span>
      </p>
      <p className="text-sm text-white/50 mt-1">{label}</p>
    </div>
  )
}

/**
 * Seção de estatísticas animadas com Intersection Observer.
 * Os contadores disparam apenas quando a seção entra na viewport.
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
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-8 py-12">
      {stats.map((stat) => (
        <StatCounter key={stat.label} {...stat} started={started} />
      ))}
    </div>
  )
}
