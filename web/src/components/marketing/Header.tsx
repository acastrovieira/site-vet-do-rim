'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/blog', label: 'Blog Científico' },
  { href: '/ferramentas', label: 'Ferramentas' },
  { href: '/lab', label: 'Lab Evolution' },
]

/**
 * Header principal do site Vet do Rim.
 * Glassmorphism Dark Executive com blur.
 * Borda inferior luminosa ao rolar para reforçar separação do conteúdo.
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
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'shadow-lg border-b border-white/10 glass-card' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-22 items-center justify-between py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group" aria-label="Vet do Rim — Início">
            <Image
              src="/logo.png"
              alt="Vet do Rim"
              width={200}
              height={200}
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain transition-transform duration-300 group-hover:scale-105 shrink-0"
              priority
            />
            <div className="hidden sm:block">
              <span className="block font-display font-bold text-lg leading-none tracking-tight text-white">
                Vet do Rim
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest mt-1 text-gold-400">
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
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 text-science-200 hover:text-white hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              className="ml-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 shadow-sm bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/40"
            >
              Entrar
            </Link>
          </nav>

          {/* Menu mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors text-science-200 hover:bg-white/10 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav
            className="md:hidden pb-4 pt-3 flex flex-col gap-1 border-t border-white/10 glass-card rounded-b-xl px-2"
            aria-label="Navegação mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors text-science-200 hover:text-white hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 mx-4 py-3 text-center rounded-lg text-sm font-semibold transition-colors bg-transparent border border-white/20 text-white hover:bg-white/10"
            >
              Entrar no Lab
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
