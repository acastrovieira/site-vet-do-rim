'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  alphaDir: number
}

/**
 * PremiumBackground — Fundo animado premium para o Hero.
 *
 * Renders:
 * 1. Canvas com partículas douradas flutuantes
 * 2. Orbs estáticos via CSS com animação lenta
 * 3. Raio de luz dourado diagonal
 * 4. Grid de pontos em baixa opacidade
 */
export function PremiumBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animFrame: number
    const particles: Particle[] = []
    const GOLD = { r: 212, g: 175, b: 55 }

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    function createParticle(): Particle {
      if (!canvas) return { x: 0, y: 0, vx: 0, vy: 0, radius: 1, alpha: 0, alphaDir: 1 }
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.6 - 0.15,
        radius: Math.random() * 1.4 + 0.4,
        alpha: 0,
        alphaDir: 1,
      }
    }

    function init() {
      particles.length = 0
      const count = Math.floor((window.innerWidth * window.innerHeight) / 12000)
      const clampedCount = Math.min(Math.max(count, 30), 90)
      for (let i = 0; i < clampedCount; i++) {
        const p = createParticle()
        if (canvas) p.y = Math.random() * canvas.height // scatter on init
        particles.push(p)
      }
    }

    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        // Move
        p.x += p.vx
        p.y += p.vy

        // Pulse alpha
        p.alpha += p.alphaDir * 0.006
        if (p.alpha >= 0.85) p.alphaDir = -1
        if (p.alpha <= 0)    p.alphaDir = 1

        // Reset when out of bounds
        if (canvas && (p.y < -10 || p.x < -20 || p.x > canvas.width + 20)) {
          Object.assign(p, createParticle())
          p.y = canvas.height + 10
        }

        // Draw
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, ${p.alpha})`
        ctx.fill()

        // Larger particles get a soft glow
        if (p.radius > 1.2) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2)
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3)
          grad.addColorStop(0, `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, ${p.alpha * 0.3})`)
          grad.addColorStop(1, `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, 0)`)
          ctx.fillStyle = grad
          ctx.fill()
        }
      }

      animFrame = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(() => {
      resize()
      init()
    })
    ro.observe(canvas)

    resize()
    init()
    draw()

    return () => {
      cancelAnimationFrame(animFrame)
      ro.disconnect()
    }
  }, [])

  return (
    <>
      {/* Canvas de partículas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
        aria-hidden
      />

      {/* Orb 1 — grande gold, canto direito superior */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-15%',
          right: '-10%',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.18) 0%, rgba(180,140,40,0.06) 45%, transparent 70%)',
          filter: 'blur(100px)',
          animation: 'orbFloat 22s ease-in-out infinite',
          zIndex: 1,
        }}
        aria-hidden
      />

      {/* Orb 2 — navy blue, canto esquerdo inferior */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-20%',
          left: '-10%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,64,175,0.35) 0%, rgba(26,46,90,0.15) 45%, transparent 70%)',
          filter: 'blur(120px)',
          animation: 'orbFloat 28s ease-in-out infinite reverse',
          zIndex: 1,
        }}
        aria-hidden
      />

      {/* Orb 3 — gold médio, centro-esquerda */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '30%',
          left: '5%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 65%)',
          filter: 'blur(80px)',
          animation: 'orbFloat 18s ease-in-out infinite 4s',
          zIndex: 1,
        }}
        aria-hidden
      />

      {/* Raio de luz diagonal */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 1 }}
        aria-hidden
      >
        <div className="gold-ray" />
      </div>

      {/* Luxury grid overlay */}
      <div
        className="absolute inset-0 luxury-grid opacity-100 pointer-events-none"
        style={{ zIndex: 1 }}
        aria-hidden
      />
    </>
  )
}
