'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X, ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'

const navLinks = [
  { href: '/blog', label: 'Blog Científico' },
  { href: '/ferramentas', label: 'Ferramentas' },
  { href: '/lab', label: 'Lab Evolution' },
]

/**
 * Header principal do site Vet do Rim.
 * Glassmorphism Dark Executive premium com blur intenso.
 * Borda inferior dourada luminosa ao rolar.
 * Botão "Entrar" com gradient gold.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'shadow-xl glass-card'
          : 'bg-transparent'
      }`}
      style={scrolled ? {
        borderBottom: '1px solid rgba(201, 168, 76, 0.15)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.15), 0 1px 20px rgba(201, 168, 76, 0.05)',
      } : undefined}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-22 items-center justify-between py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group" aria-label="Vet do Rim — Início">
            <VetDoRimLogo className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 group-hover:scale-105 transition-transform duration-300" priority />
            <div className="hidden sm:block">
              <span className="block font-display font-bold text-lg leading-none tracking-tight text-slate-900 dark:text-white transition-colors group-hover:text-gold-500 dark:group-hover:text-gold-400">
                Vet do Rim
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest mt-1 text-gold-500 dark:text-gold-400 transition-colors">
                Nefrologia Veterinária
              </span>
            </div>
          </Link>

          {/* Nav Desktop */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 text-slate-600 dark:text-science-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5 group/link"
              >
                {link.label}
                {/* Underline animado dourado */}
                <span className="absolute bottom-0.5 left-4 right-4 h-0.5 bg-gold-400 rounded-full scale-x-0 group-hover/link:scale-x-100 transition-transform duration-300 origin-left" />
              </Link>
            ))}
            <ThemeToggle className="ml-1" />
            <Link
              href="/auth/login"
              className="ml-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2 shimmer-gold"
              style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #B8932A 100%)',
                boxShadow: '0 4px 16px rgba(201, 168, 76, 0.25)',
                color: '#0A0A0C',
              }}
            >
              Entrar
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </nav>

          {/* Mobile menu toggle e controles */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 rounded-lg transition-colors text-slate-600 dark:text-science-200 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav
            className="md:hidden pb-4 pt-3 flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 glass-card rounded-b-xl px-2 shadow-xl"
            aria-label="Navegação mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors text-slate-600 dark:text-science-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 mx-4 py-3 text-center rounded-xl text-sm font-bold transition-all shimmer-gold flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #B8932A 100%)',
                color: '#0A0A0C',
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
