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
          ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" aria-label="Vet do Rim — Início">
            <Image
              src="/logo.png"
              alt="Vet do Rim"
              width={48}
              height={48}
              className="transition-transform duration-200 group-hover:scale-110 object-contain"
              priority
            />
          </Link>

          {/* Nav Desktop */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-all duration-200 shadow-sm hover:shadow-brand-500/25"
            >
              Entrar
            </Link>
          </nav>

          {/* Menu mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
              className="mt-2 mx-4 py-3 text-center rounded-lg text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              Entrar no Lab
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
