'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'

const depoimentos = [
  {
    nome: 'Ana Paula S.',
    pet: 'Tutora do Thor (labrador, 9 anos)',
    nota: 5,
    texto:
      'O Thor foi diagnosticado com DRC estágio 3 e graças ao acompanhamento do Vet do Rim conseguimos estabilizar a creatinina e dar muito mais qualidade de vida pra ele. Atendimento humanizado e sempre disponível.',
    inicial: 'A',
    cor: 'bg-blue-500/20 text-blue-300',
  },
  {
    nome: 'Carlos Menezes',
    pet: 'Tutor da Mimi (gata persa, 12 anos)',
    nota: 5,
    texto:
      'A Mimi sofreu uma obstrução uretral e o suporte foi excepcional. Explicaram tudo com clareza, sem jargões, e a recuperação foi muito além do que esperávamos.',
    inicial: 'C',
    cor: 'bg-gold-400/20 text-gold-400',
  },
  {
    nome: 'Fernanda Lopes',
    pet: 'Tutora da Bella (shih-tzu, 7 anos)',
    nota: 5,
    texto:
      'Além do cuidado clínico impecável, o Lab Evolution me permite acompanhar os exames da Bella em tempo real. Me sinto segura e bem informada em cada etapa.',
    inicial: 'F',
    cor: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    nome: 'Rodrigo Almeida',
    pet: 'Tutor do Duque (golden, 11 anos)',
    nota: 5,
    texto:
      'Médica veterinária extremamente competente e empática. Conseguiu reverter uma situação que parecia sem saída. Hoje o Duque está bem e feliz graças ao trabalho dela.',
    inicial: 'R',
    cor: 'bg-violet-500/20 text-violet-300',
  },
  {
    nome: 'Juliana Costa',
    pet: 'Tutora do Simba (gato siamês, 8 anos)',
    nota: 5,
    texto:
      'O Simba tem cálculos renais recorrentes e o protocolo individualizado do Vet do Rim reduziu drasticamente as crises. Recomendo a qualquer tutor que busca seriedade e cuidado.',
    inicial: 'J',
    cor: 'bg-rose-500/20 text-rose-300',
  },
  {
    nome: 'Marcos Vieira',
    pet: 'Tutor da Luna (cocker, 10 anos)',
    nota: 5,
    texto:
      'Atendimento diferenciado do início ao fim. Relatório detalhado após cada consulta, responde dúvidas com agilidade e nunca se sentiu como mais um número. Excelência em tudo.',
    inicial: 'M',
    cor: 'bg-cyan-500/20 text-cyan-300',
  },
]

/**
 * Carrossel de depoimentos com auto-scroll e controles manuais.
 * Pausa no hover, retoma automaticamente ao sair.
 */
export function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % depoimentos.length)
  }, [])

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + depoimentos.length) % depoimentos.length)
  }, [])

  useEffect(() => {
    if (paused) return
    intervalRef.current = setInterval(next, 4500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [paused, next])

  // Exibe 3 cards: anterior, atual, próximo (ou menos em mobile)
  const visible = [
    depoimentos[(current - 1 + depoimentos.length) % depoimentos.length],
    depoimentos[current],
    depoimentos[(current + 1) % depoimentos.length],
  ]

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative"
    >
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 overflow-hidden">
        {visible.map((dep, i) => (
          <article
            key={`${dep.nome}-${i}`}
            className={`relative p-6 rounded-2xl border transition-all duration-500 ${
              i === 1
                ? 'border-gold-400/30 scale-105 shadow-2xl shadow-gold-400/10'
                : 'border-white/10 opacity-60 scale-95'
            }`}
            style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}
          >
            {/* Estrelas */}
            <div className="flex gap-0.5 mb-4" aria-label={`${dep.nota} estrelas`}>
              {Array.from({ length: dep.nota }).map((_, si) => (
                <Star key={si} className="h-4 w-4 fill-gold-400 text-gold-400" aria-hidden />
              ))}
            </div>

            <p className="text-sm text-white/75 leading-relaxed mb-5 italic">
              &ldquo;{dep.texto}&rdquo;
            </p>

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

      {/* Controles */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={prev}
          aria-label="Depoimento anterior"
          className="p-2 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex gap-2">
          {depoimentos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Ir para depoimento ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-gold-400' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          aria-label="Próximo depoimento"
          className="p-2 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all duration-200"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
