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
 * - Estado inicial (topo da página): faixa degradê escura (azul → transparente)
 *   para garantir legibilidade sobre o hero azul profundo da home.
 * - Após scroll: transiciona para fundo branco opaco com blur (páginas internas).
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
          ? 'bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'
          : 'border-b border-transparent'
      }`}
      style={
        !scrolled
          ? {
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.80) 55%, transparent 100%)',
              backdropFilter: 'blur(6px)',
            }
          : undefined
      }
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
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain transition-transform duration-300 group-hover:scale-105 shrink-0 drop-shadow-lg"
              priority
            />
            <div className="hidden sm:block">
              <span
                className={`block font-display font-bold text-lg leading-none tracking-tight transition-colors duration-500 text-brand-700`}
              >
                Vet do Rim
              </span>
              <span
                className={`block text-[11px] font-semibold uppercase tracking-widest mt-1 transition-colors duration-500 text-gold-600`}
              >
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
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 text-slate-700 hover:text-brand-600 hover:bg-brand-50/60"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              className="ml-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 shadow-sm bg-brand-600 text-white hover:bg-brand-700"
            >
              Entrar
            </Link>
          </nav>

          {/* Menu mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors text-slate-700 hover:bg-slate-100"
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
            className="md:hidden pb-4 pt-3 flex flex-col gap-1 border-t border-slate-100"
            aria-label="Navegação mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 mx-4 py-3 text-center rounded-lg text-sm font-semibold transition-colors bg-brand-600 text-white hover:bg-brand-700"
            >
              Entrar no Lab
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
