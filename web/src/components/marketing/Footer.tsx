import Link from 'next/link'
import { Mail } from 'lucide-react'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'

// SVG do WhatsApp
function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.849L.057 23.486a.5.5 0 00.611.64l5.801-1.522A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.002-1.368l-.36-.213-3.726.977.996-3.635-.234-.374A9.774 9.774 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
    </svg>
  )
}

// SVG do Instagram
function IconInstagram({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

const footerLinks = {
  conteudo: [
    { href: '/blog', label: 'Blog Científico' },
    { href: '/ferramentas', label: 'Ferramentas Clínicas' },
    { href: '/ferramentas/calculadora-tfg', label: 'Calculadora TFG' },
  ],
  institucional: [
    { href: '/#sobre', label: 'Sobre' },
    { href: '/#especialidades', label: 'Especialidades' },
    { href: '/lab', label: 'Lab Evolution' },
  ],
}

/**
 * Footer premium do site Vet do Rim.
 * Logo com glow dourado luminoso (sem mais brightness-0 invert).
 * Links com hover dourado animado.
 */
export function Footer() {
  return (
    <footer
      className="border-t border-slate-200 dark:border-white/5 text-slate-500 dark:text-science-500 mt-auto relative z-10"
      style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(8,15,32,0.03) 100%)' }}
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center group mb-4 h-16" aria-label="Vet do Rim">
              {/* Logo vertical colorida no tema claro */}
              <img 
                src="/logo-vertical.svg" 
                alt="Vet do Rim" 
                className="h-14 sm:h-16 w-auto block dark:hidden group-hover:scale-103 transition-all duration-300"
              />
              {/* Logo vertical dourada no tema escuro */}
              <img 
                src="/logo-vertical-gold.svg" 
                alt="Vet do Rim" 
                className="h-14 sm:h-16 w-auto hidden dark:block group-hover:scale-103 transition-all duration-300"
              />
            </Link>
            <p className="text-sm leading-relaxed max-w-xs text-slate-600 dark:text-science-500">
              Nefrologia e urologia veterinária avançada. Ciência, tecnologia e
              atendimento humanizado.
            </p>
            <div className="flex gap-2 mt-5">
              <a
                href="mailto:contato@vetdorim.com.br"
                className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300 text-slate-400 hover:text-gold-500 dark:hover:text-gold-400 hover:scale-110"
                aria-label="Enviar e-mail"
              >
                <Mail className="h-4 w-4" aria-hidden />
              </a>
              <a
                href="https://www.instagram.com/vetdorim/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300 text-slate-400 hover:text-pink-500 dark:hover:text-pink-400 hover:scale-110"
                aria-label="Instagram @vetdorim"
              >
                <IconInstagram className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/5527997987058"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300 text-slate-400 hover:text-[#25D366] hover:scale-110"
                aria-label="WhatsApp"
              >
                <IconWhatsApp className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Conteúdo */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gold-500/70 dark:text-gold-400/50 mb-4">
              Conteúdo
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.conteudo.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="relative text-sm text-slate-600 dark:text-science-500 hover:text-slate-900 dark:hover:text-white transition-colors duration-200 group/flink"
                  >
                    {link.label}
                    <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-gold-400 group-hover/flink:w-full transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Institucional */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gold-500/70 dark:text-gold-400/50 mb-4">
              Institucional
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.institucional.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="relative text-sm text-slate-600 dark:text-science-500 hover:text-slate-900 dark:hover:text-white transition-colors duration-200 group/flink"
                  >
                    {link.label}
                    <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-gold-400 group-hover/flink:w-full transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row justify-between gap-3 text-xs text-slate-500 dark:text-science-500">
          <p>© {new Date().getFullYear()} Vet do Rim. Todos os direitos reservados.</p>
          <p>
            Conteúdo de caráter educacional. Não substitui consulta veterinária presencial.
          </p>
        </div>
      </div>
    </footer>
  )
}
