import Image from 'next/image'

interface VetDoRimLogoProps {
  /** Largura intrínseca (Next.js otimização). Tamanho real = className CSS */
  width?: number
  /** Altura intrínseca (Next.js otimização). Tamanho real = className CSS */
  height?: number
  className?: string
  /**
   * 'color'  = logo original navy + dourado
   * 'white'  = logo invertida (branca) — ideal para fundos muito escuros onde o navy some
   * 'auto'   = reage automaticamente à classe .dark do Tailwind
   */
  variant?: 'color' | 'white' | 'auto'
  priority?: boolean
}

/**
 * Logo oficial Vet do Rim — PNG 1024×1024 com fundo transparente.
 * Tamanho visual controlado via className (Tailwind responsivo).
 *
 * @example
 * // Header desktop
 * <VetDoRimLogo className="w-10 h-10 sm:w-12 sm:h-12" priority />
 */
export function VetDoRimLogo({
  width = 256,
  height = 256,
  className = '',
  variant = 'auto',
  priority = false,
}: VetDoRimLogoProps) {
  let blendClass = ''
  
  if (variant === 'white') {
    blendClass = 'brightness-0 invert'
  } else if (variant === 'auto') {
    blendClass = 'dark:brightness-0 dark:invert'
  }

  return (
    <Image
      src="/logo.png"
      alt="Vet do Rim — Nefrologia e Urologia Veterinária"
      width={width}
      height={height}
      quality={95}
      className={`object-contain select-none shrink-0 transition-all duration-300 ${blendClass} ${className}`}
      priority={priority}
      fetchPriority={priority ? 'high' : 'auto'}
    />
  )
}
