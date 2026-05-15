import Link from 'next/link'
import Image from 'next/image'
import { Mail } from 'lucide-react'

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
 */
export function Footer() {
  return (
    <footer className="bg-science-900 text-slate-400 mt-auto" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4" aria-label="Vet do Rim">
              <Image
                src="/logo.png"
                alt="Vet do Rim"
                width={64}
                height={64}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain brightness-0 invert shrink-0"
              />
              <div>
                <span className="block font-display font-bold text-base text-white tracking-tight leading-none">
                  Vet do Rim
                </span>
                <span className="block text-[10px] text-slate-400 tracking-wider font-medium mt-0.5">
                  Nefrologia Veterinária
                </span>
              </div>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs">
              Nefrologia e urologia veterinária de alta complexidade. Ciência, tecnologia e
              atendimento humanizado.
            </p>
            <div className="flex gap-3 mt-5">
              <a
                href="mailto:contato@vetdorim.com.br"
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                aria-label="Enviar e-mail"
              >
                <Mail className="h-4 w-4" aria-hidden />
              </a>
              <a
                href="https://www.instagram.com/vetdorim/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-pink-400"
                aria-label="Instagram @vetdorim"
              >
                <IconInstagram className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/5527997987058"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-[#25D366]"
                aria-label="WhatsApp"
              >
                <IconWhatsApp className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Conteúdo */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Conteúdo
            </h3>
            <ul className="space-y-2">
              {footerLinks.conteudo.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Institucional */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Institucional
            </h3>
            <ul className="space-y-2">
              {footerLinks.institucional.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between gap-3 text-xs">
          <p>© {new Date().getFullYear()} Vet do Rim. Todos os direitos reservados.</p>
          <p>
            Conteúdo de caráter educacional. Não substitui consulta veterinária presencial.
          </p>
        </div>
      </div>
    </footer>
  )
}
