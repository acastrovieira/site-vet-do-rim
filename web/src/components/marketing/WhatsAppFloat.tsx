'use client'

import { usePathname } from 'next/navigation'

const SENSITIVE_ROUTE_PREFIXES = ['/auth', '/lab', '/portal', '/admin', '/dashboard']

/**
 * Botão flutuante do WhatsApp.
 * Fixo no canto inferior direito em todas as páginas de marketing.
 * Padrão UX #1 para conversão em sites brasileiros.
 */
export function WhatsAppFloat() {
  const pathname = usePathname()
  const isSensitiveRoute = SENSITIVE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  if (isSensitiveRoute) return null

  const phone = '5527997987058'
  const message = encodeURIComponent(
    'Olá! Vim pelo site do Vet do Rim e gostaria de saber mais sobre os serviços.',
  )
  const href = `https://wa.me/${phone}?text=${message}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco pelo WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 group"
    >
      {/* Tooltip */}
      <span
        className="hidden sm:block bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg
                   opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0
                   transition-all duration-200 whitespace-nowrap shadow-lg pointer-events-none"
      >
        Fale conosco
      </span>

      {/* Botão */}
      <div className="relative">
        {/* Anel pulsante */}
        <span
          className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30"
          aria-hidden
        />
        <span
          className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20 animation-delay-300"
          aria-hidden
        />

        {/* Círculo principal */}
        <div
          className="relative h-14 w-14 rounded-full flex items-center justify-center shadow-xl shadow-[#25D366]/40
                     bg-[#25D366] hover:bg-[#22c55e] transition-colors duration-200 hover:scale-110 active:scale-95"
        >
          {/* Ícone WhatsApp SVG oficial */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="h-7 w-7"
            aria-hidden
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.849L.057 23.486a.5.5 0 00.611.64l5.801-1.522A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.002-1.368l-.36-.213-3.726.977.996-3.635-.234-.374A9.774 9.774 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
          </svg>
        </div>
      </div>
    </a>
  )
}
