'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, X, ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useTheme } from 'next-themes'

const navLinks = [
  { href: '/blog', label: 'Blog Científico' },
  { href: '/ferramentas', label: 'Ferramentas' },
  { href: '/lab', label: 'Lab Evolution' },
]

/**
 * Header premium institucional — adaptativo ao tema.
 *
 * Dark mode : fundo navy #0C1E3D · logo dourada horizontal · nav branco
 * Light mode: fundo branco translúcido · logo azul escuro · nav navy
 *
 * Logo: h-20 (80 px) em header h-24 (96 px) — máximo impacto visual.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Antes do mount assume dark (evita flash — o site é navy por padrão)
  const isDark = !mounted || resolvedTheme === 'dark'

  /* ── Tokens de estilo por tema ───────────────────────────── */
  const headerBg = isDark
    ? scrolled ? 'rgba(12, 30, 61, 0.98)' : 'rgba(12, 30, 61, 0.94)'
    : scrolled ? 'rgba(255, 255, 255, 0.99)' : 'rgba(255, 255, 255, 0.95)'

  const headerBorder = isDark
    ? scrolled ? '1px solid rgba(200, 169, 122, 0.18)' : '1px solid rgba(200, 169, 122, 0.08)'
    : scrolled ? '1px solid rgba(26, 58, 107, 0.14)' : '1px solid rgba(26, 58, 107, 0.07)'

  const headerShadow = isDark
    ? scrolled ? '0 4px 32px rgba(9,21,48,0.4), 0 1px 4px rgba(0,0,0,0.15)' : '0 1px 16px rgba(9,21,48,0.2)'
    : scrolled ? '0 4px 24px rgba(26,58,107,0.10), 0 1px 4px rgba(26,58,107,0.06)' : '0 1px 12px rgba(26,58,107,0.06)'

  const navLinkColor = isDark ? 'rgba(220, 235, 255, 0.75)' : 'rgba(26, 58, 107, 0.75)'
  const navUnderlineColor = isDark ? '#C8A97A' : '#1A3A6B'
  const mobileIconColor = isDark ? 'rgba(220, 235, 255, 0.8)' : 'rgba(26, 58, 107, 0.8)'
  const mobileBorder = isDark ? '1px solid rgba(200, 169, 122, 0.25)' : '1px solid rgba(26, 58, 107, 0.18)'
  const mobileMenuBg = isDark ? 'rgba(12, 30, 61, 0.99)' : 'rgba(255, 255, 255, 0.99)'
  const mobileTopBorder = isDark ? '1px solid rgba(200, 169, 122, 0.15)' : '1px solid rgba(26, 58, 107, 0.08)'

  const ctaStyle = isDark
    ? {
        background: 'linear-gradient(135deg, #C8A97A 0%, #B8922A 100%)',
        color: '#0C1E3D',
        boxShadow: '0 4px 16px rgba(200, 169, 122, 0.35)',
      }
    : {
        background: 'linear-gradient(135deg, #1A3A6B 0%, #0F2244 100%)',
        color: '#FFFFFF',
        boxShadow: '0 4px 16px rgba(26, 58, 107, 0.28)',
      }

  /* ── Logo: dourada (dark) ou azul escuro (light) ─────────── */
  const logoSrc = isDark
    ? '/logo/Monocrom%C3%A1tica%20-%20dourada%282%29.svg'
    : '/logo/Monocrom%C3%A1tica%20-%20Azul%20Escuro%20%28fundo%20claro%29.svg'

  const logoFilter = isDark
    ? 'drop-shadow(0 2px 12px rgba(200, 169, 122, 0.45))'
    : 'drop-shadow(0 2px 8px rgba(26, 58, 107, 0.18))'

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-400"
      style={{
        background: headerBg,
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: headerBorder,
        boxShadow: headerShadow,
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-24 items-center justify-between">

          {/* ── Logo — máximo impacto, h-20 em h-24 ───────────── */}
          <Link
            href="/"
            className="flex items-center group shrink-0"
            aria-label="Vet do Rim — Início"
          >
            <Image
              src={logoSrc}
              alt="Vet do Rim — Nefrologia e Urologia Veterinária"
              width={480}
              height={240}
              priority
              className="h-20 w-auto object-contain max-w-[280px] transition-all duration-300 group-hover:opacity-90 group-hover:scale-[1.015]"
              style={{ filter: logoFilter }}
              draggable={false}
            />
          </Link>

          {/* ── Nav Desktop ──────────────────────────────────────── */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Navegação principal"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-250 group/link"
                style={{ color: navLinkColor }}
              >
                {link.label}
                {/* Underline no hover */}
                <span
                  className="absolute bottom-0.5 left-4 right-4 h-px scale-x-0 group-hover/link:scale-x-100 transition-transform duration-250 origin-left"
                  style={{ background: navUnderlineColor }}
                />
              </Link>
            ))}

            <ThemeToggle className="ml-1" />

            {/* CTA */}
            <Link
              href="/auth/login"
              className="ml-3 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-250 hover:-translate-y-0.5 hover:brightness-110 flex items-center gap-2"
              style={ctaStyle}
            >
              Entrar
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </nav>

          {/* ── Mobile toggle ─────────────────────────────────── */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 rounded-lg transition-colors duration-200"
              style={{ color: mobileIconColor, border: mobileBorder }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ───────────────────────────────────── */}
        {menuOpen && (
          <nav
            className="md:hidden pb-5 pt-2 flex flex-col gap-1 px-2"
            style={{ borderTop: mobileTopBorder, background: mobileMenuBg }}
            aria-label="Navegação mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200"
                style={{ color: navLinkColor }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 mx-2 py-3 text-center rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
              style={ctaStyle}
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
