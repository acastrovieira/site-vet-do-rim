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
 * Header navy premium institucional.
 * Fundo: navy profundo #0C1E3D → sólido e coeso com o footer.
 * Logo: dourada — contraste perfeito sobre navy.
 * Nav links: branco translúcido → hover branco puro com underline dourado.
 * CTA: dourado sólido (autoridade + elegância).
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
          ? 'rgba(12, 30, 61, 0.98)'
          : 'rgba(12, 30, 61, 0.94)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: scrolled
          ? '1px solid rgba(200, 169, 122, 0.18)'
          : '1px solid rgba(200, 169, 122, 0.08)',
        boxShadow: scrolled
          ? '0 4px 32px rgba(9, 21, 48, 0.4), 0 1px 4px rgba(0,0,0,0.15)'
          : '0 1px 16px rgba(9, 21, 48, 0.2)',
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-24 items-center justify-between">

          {/* Logo dourada horizontal — ampliada para máximo impacto visual */}
          <Link
            href="/"
            className="flex items-center group relative z-10"
            aria-label="Vet do Rim — Início"
          >
            <Image
              src="/logo/Monocrom%C3%A1tica%20-%20dourada%282%29.svg"
              alt="Vet do Rim — Nefrologia e Urologia Veterinária"
              width={500}
              height={250}
              priority
              className="h-28 md:h-36 w-auto object-contain transition-all duration-300 group-hover:opacity-90 group-hover:scale-[1.02] -my-4 md:-my-6"
              style={{
                filter: 'drop-shadow(0 2px 12px rgba(200, 169, 122, 0.4))',
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
                className="relative px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-250 group/link"
                style={{ color: 'rgba(220, 235, 255, 0.75)' }}
              >
                {link.label}
                {/* Underline dourado no hover */}
                <span
                  className="absolute bottom-0.5 left-4 right-4 h-px scale-x-0 group-hover/link:scale-x-100 transition-transform duration-250 origin-left"
                  style={{ background: '#C8A97A' }}
                />
              </Link>
            ))}

            <ThemeToggle className="ml-1" />

            {/* CTA dourado — premium e de alta visibilidade */}
            <Link
              href="/auth/login"
              className="ml-3 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-250 hover:-translate-y-0.5 hover:brightness-110 flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #C8A97A 0%, #B8922A 100%)',
                color: '#0C1E3D',
                boxShadow: '0 4px 16px rgba(200, 169, 122, 0.35)',
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
              className="p-2 rounded-lg transition-colors duration-200"
              style={{
                color: 'rgba(220, 235, 255, 0.8)',
                border: '1px solid rgba(200, 169, 122, 0.25)',
              }}
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
            className="md:hidden pb-5 pt-2 flex flex-col gap-1 px-2"
            style={{ borderTop: '1px solid rgba(200, 169, 122, 0.15)' }}
            aria-label="Navegação mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200"
                style={{ color: 'rgba(220, 235, 255, 0.75)' }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 mx-2 py-3 text-center rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #C8A97A 0%, #B8922A 100%)',
                color: '#0C1E3D',
                boxShadow: '0 4px 16px rgba(200, 169, 122, 0.3)',
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
