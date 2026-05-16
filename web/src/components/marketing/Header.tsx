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
 * Torna-se opaco com blur ao rolar (scroll-aware).
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
        scrolled
          ? 'bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'
          : 'bg-gradient-to-b from-white/90 via-white/60 to-transparent backdrop-blur-sm'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between pb-2">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-4 group" aria-label="Vet do Rim — Início">
            <Image
              src="/logo.png"
              alt="Vet do Rim"
              width={160}
              height={160}
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain transition-transform duration-300 group-hover:scale-105 shrink-0"
              priority
            />
            <div className="hidden sm:block">
              <span className="block font-display font-bold text-base leading-none tracking-tight text-brand-700">
                Vet do Rim
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest mt-0.5 text-gold-600">
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
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-slate-700 hover:text-brand-600 hover:bg-white/50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              className="ml-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm bg-brand-600 text-white hover:bg-brand-700"
            >
              Entrar
            </Link>
          </nav>

          {/* Menu mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors text-slate-700 hover:bg-white/50"
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
            className="md:hidden pb-4 border-t border-slate-100 pt-3 flex flex-col gap-1"
            aria-label="Navegação mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 mx-4 py-3 text-center rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              Entrar no Lab
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
