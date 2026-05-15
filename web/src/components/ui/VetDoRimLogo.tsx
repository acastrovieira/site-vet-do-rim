import Image from 'next/image'

interface VetDoRimLogoProps {
  /** Largura intrínseca (Next.js otimização). Tamanho real = className CSS */
  width?: number
  /** Altura intrínseca (Next.js otimização). Tamanho real = className CSS */
  height?: number
  className?: string
  /**
   * 'color'  = logo navy + dourado — fundos claros (usa mix-blend-multiply automaticamente)
   * 'white'  = logo invertida — fundos escuros (brightness-0 invert)
   */
  variant?: 'color' | 'white'
  priority?: boolean
}

/**
 * Logo oficial Vet do Rim — PNG 1024×1024 com fundo transparente.
 * Tamanho visual controlado via className (Tailwind responsivo).
 *
 * @example
 * // Header desktop
 * <VetDoRimLogo className="w-10 h-10 sm:w-12 sm:h-12" priority />
 *
 * @example
 * // Footer escuro
 * <VetDoRimLogo variant="white" className="w-12 h-12 sm:w-14 sm:h-14" />
 */
export function VetDoRimLogo({
  width = 256,
  height = 256,
  className = '',
  variant = 'color',
  priority = false,
}: VetDoRimLogoProps) {
  const blendClass = variant === 'color' ? 'mix-blend-multiply' : 'brightness-0 invert'

  return (
    <Image
      src="/logo.png"
      alt="Vet do Rim — Nefrologia e Urologia Veterinária"
      width={width}
      height={height}
      quality={95}
      className={`object-contain select-none shrink-0 ${blendClass} ${className}`}
      priority={priority}
    />
  )
}
