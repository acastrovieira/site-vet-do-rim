'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react'

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
 * Agora com glow dourado, aspas decorativas e transições premium.
 */
export function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goTo = useCallback((idx: number) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrent(idx)
      setIsTransitioning(false)
    }, 200)
  }, [])

  const next = useCallback(() => {
    goTo((current + 1) % depoimentos.length)
  }, [current, goTo])

  const prev = useCallback(() => {
    goTo((current - 1 + depoimentos.length) % depoimentos.length)
  }, [current, goTo])

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
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 overflow-hidden transition-opacity duration-300 ${isTransitioning ? 'opacity-40' : 'opacity-100'}`}>
        {visible.map((dep, i) => (
          <article
            key={`${dep.nome}-${i}`}
            className={`relative p-6 rounded-2xl border transition-all duration-500 ${
              i === 1
                ? 'border-gold-400/30 scale-105 shadow-2xl'
                : 'border-white/10 opacity-60 scale-95'
            }`}
            style={{
              background: i === 1
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              boxShadow: i === 1
                ? '0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(201,168,76,0.08)'
                : 'none',
            }}
          >
            {/* Aspas decorativas */}
            <Quote
              className={`absolute top-4 right-4 w-8 h-8 transition-colors duration-300 ${
                i === 1 ? 'text-gold-400/20' : 'text-white/5'
              }`}
              strokeWidth={1}
              aria-hidden
            />

            {/* Glow de fundo no card ativo */}
            {i === 1 && (
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ background: 'radial-gradient(circle at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)' }}
                aria-hidden
              />
            )}

            {/* Estrelas */}
            <div className="flex gap-0.5 mb-4 relative" aria-label={`${dep.nota} estrelas`}>
              {Array.from({ length: dep.nota }).map((_, si) => (
                <Star key={si} className="h-4 w-4 fill-gold-400 text-gold-400" aria-hidden />
              ))}
            </div>

            <p className="text-sm text-white/75 leading-relaxed mb-5 italic relative">
              &ldquo;{dep.texto}&rdquo;
            </p>

            <div className="flex items-center gap-3 relative">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${dep.cor} transition-transform duration-300 ${i === 1 ? 'scale-110' : ''}`}>
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
          className="p-2.5 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-gold-400/30 hover:bg-white/5 transition-all duration-300 hover:scale-110"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex gap-2">
          {depoimentos.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir para depoimento ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === current ? 'w-8 bg-gold-400 shadow-sm shadow-gold-400/30' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          aria-label="Próximo depoimento"
          className="p-2.5 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-gold-400/30 hover:bg-white/5 transition-all duration-300 hover:scale-110"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
