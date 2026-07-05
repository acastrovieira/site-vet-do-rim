'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, X, ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const navLinks = [
  { href: '/blog', label: 'Blog Científico' },
  { href: '/ferramentas', label: 'Ferramentas' },
  { href: '/lab', label: 'Lab Evolution' },
]

/**
 * Header premium dark com glassmorphism intenso.
 * Logo dourada PNG horizontal real.
 * Borda inferior dourada luminosa que intensifica ao rolar.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500`}
      style={{
        background: scrolled
          ? 'rgba(8, 12, 20, 0.88)'
          : 'rgba(8, 12, 20, 0.6)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderBottom: scrolled
          ? '1px solid rgba(201, 168, 76, 0.25)'
          : '1px solid rgba(201, 168, 76, 0.1)',
        boxShadow: scrolled
          ? '0 4px 40px rgba(0,0,0,0.4), 0 1px 20px rgba(201,168,76,0.08)'
          : 'none',
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">

          {/* Logo horizontal PNG real */}
          <Link
            href="/"
            className="flex items-center group relative"
            aria-label="Vet do Rim — Início"
          >
            {/* Glow de fundo atrás da logo */}
            <div
              className="absolute inset-0 rounded-lg blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"
              style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.3) 0%, transparent 70%)' }}
              aria-hidden
            />
            <Image
              src="/logo/Monocromática - Dourada.png"
              alt="Vet do Rim"
              width={240}
              height={80}
              priority
              className="h-12 w-auto object-contain relative z-10 logo-glow-dark transition-all duration-300 group-hover:scale-105"
              style={{ filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.35)) drop-shadow(0 0 20px rgba(201,168,76,0.15))' }}
              draggable={false}
            />
          </Link>

          {/* Nav Desktop */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 text-white/70 hover:text-white hover:bg-white/5 group/link"
              >
                {link.label}
                {/* Underline dourado */}
                <span className="absolute bottom-0.5 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent scale-x-0 group-hover/link:scale-x-100 transition-transform duration-300" />
              </Link>
            ))}
            <ThemeToggle className="ml-1" />
            <Link
              href="/auth/login"
              className="ml-3 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 shimmer-gold"
              style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #B8932A 100%)',
                boxShadow: '0 4px 20px rgba(201, 168, 76, 0.3)',
                color: '#080C14',
              }}
            >
              Entrar
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </nav>

          {/* Mobile menu toggle */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 rounded-lg transition-colors text-white/70 hover:bg-white/5 hover:text-white border border-white/10"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav
            className="md:hidden pb-5 pt-2 flex flex-col gap-1 border-t px-2"
            style={{ borderColor: 'rgba(201, 168, 76, 0.15)' }}
            aria-label="Navegação mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors text-white/70 hover:text-white hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 mx-2 py-3 text-center rounded-xl text-sm font-bold transition-all shimmer-gold flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #B8932A 100%)',
                color: '#080C14',
                boxShadow: '0 4px 20px rgba(201, 168, 76, 0.25)',
              }}
            >
              Entrar no Lab
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
