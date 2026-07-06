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
 * Header clínico premium institucional.
 * Fundo: branco translúcido (light), blur suave.
 * Borda inferior verde discreta que aparece ao rolar.
 * CTA: verde clínico sólido.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-400"
      style={{
        background: scrolled
          ? 'rgba(247, 249, 248, 0.95)'
          : 'rgba(247, 249, 248, 0.8)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: scrolled
          ? '1px solid rgba(45, 90, 74, 0.12)'
          : '1px solid rgba(45, 90, 74, 0.06)',
        boxShadow: scrolled
          ? '0 2px 20px rgba(45, 90, 74, 0.07), 0 1px 4px rgba(0,0,0,0.04)'
          : 'none',
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-24 items-center justify-between">

          {/* Logo PNG dourada — funciona perfeitamente sobre fundo claro */}
          <Link
            href="/"
            className="flex items-center group"
            aria-label="Vet do Rim — Início"
          >
            <Image
              src="/logo/Monocrom%C3%A1tica%20-%20Dourada.png"
              alt="Vet do Rim"
              width={280}
              height={100}
              priority
              className="h-14 w-auto object-contain transition-all duration-300 group-hover:opacity-90 group-hover:scale-[1.02]"
              style={{
                filter: 'drop-shadow(0 2px 10px rgba(200, 169, 122, 0.25))',
              }}
              draggable={false}
            />
          </Link>

          {/* Nav Desktop */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Navegação principal"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-4 py-2 rounded-lg text-sm font-medium text-science-700 hover:text-navy-600 transition-colors duration-250 group/link"
              >
                {link.label}
                <span className="absolute bottom-0.5 left-4 right-4 h-px bg-navy-500 scale-x-0 group-hover/link:scale-x-100 transition-transform duration-250 origin-left" />
              </Link>
            ))}

            <ThemeToggle className="ml-1" />

            <Link
              href="/auth/login"
              className="ml-3 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-250 hover:-translate-y-0.5 flex items-center gap-2 shimmer-gold"
              style={{
                background: '#1A3A6B',
                boxShadow: '0 4px 14px rgba(26, 58, 107, 0.28)',
                color: '#FFFFFF',
              }}
            >
              Entrar
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </nav>

          {/* Mobile toggle */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 rounded-lg text-science-700 hover:bg-clinical-50 hover:text-clinical-700 border border-science-200 transition-colors duration-200"
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
            className="md:hidden pb-5 pt-2 flex flex-col gap-1 border-t border-clinical-100 px-2"
            aria-label="Navegação mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium text-science-700 hover:text-clinical-700 hover:bg-clinical-50 transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 mx-2 py-3 text-center rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
              style={{
                background: '#1A3A6B',
                color: '#FFFFFF',
                boxShadow: '0 4px 16px rgba(26, 58, 107, 0.22)',
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
