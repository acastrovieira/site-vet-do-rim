import Link from 'next/link'
import Image from 'next/image'
import { Mail, ExternalLink } from 'lucide-react'

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
                width={48}
                height={48}
                className="object-contain brightness-0 invert"
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
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" aria-hidden />
              </a>
              <a
                href="https://instagram.com/vetdorim"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Instagram"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <a
                href="https://youtube.com/@vetdorim"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="YouTube"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
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
