import Image from 'next/image'

interface VetDoRimLogoProps {
  /** Largura intrínseca (Next.js otimização). Tamanho real = className CSS */
  width?: number
  /** Altura intrínseca (Next.js otimização). Tamanho real = className CSS */
  height?: number
  className?: string
  /**
   * 'color'  = logo original navy + dourado (sem efeitos)
   * 'glow'   = logo com glow dourado luminoso — ideal para fundos escuros
   * 'auto'   = reage automaticamente à classe .dark (glow no dark, normal no light)
   * 'white'  = logo invertida (branca) — fallback para casos extremos
   */
  variant?: 'color' | 'glow' | 'auto' | 'white'
  /** Adiciona animação de flutuação suave */
  animated?: boolean
  /** Adiciona animação de glow pulsante */
  pulseGlow?: boolean
  priority?: boolean
}

/**
 * Logo oficial Vet do Rim — PNG 1024×1024 com fundo transparente.
 * Tamanho visual controlado via className (Tailwind responsivo).
 *
 * Agora com glow dourado luminoso em vez do antigo brightness-0 invert
 * que apagava as cores da marca no dark mode.
 *
 * @example
 * // Header desktop — auto glow no dark mode
 * <VetDoRimLogo className="w-10 h-10 sm:w-12 sm:h-12" priority />
 *
 * @example
 * // Hero com animação flutuante e glow pulsante
 * <VetDoRimLogo className="w-32 h-32" variant="glow" animated pulseGlow />
 */
export function VetDoRimLogo({
  width = 256,
  height = 256,
  className = '',
  variant = 'auto',
  animated = false,
  pulseGlow = false,
  priority = false,
}: VetDoRimLogoProps) {
  const effectClasses: string[] = []

  if (variant === 'white') {
    effectClasses.push('brightness-0 invert')
  } else if (variant === 'glow') {
    effectClasses.push('logo-glow-dark')
  } else if (variant === 'auto') {
    // Light mode: sem efeito. Dark mode: glow dourado luminoso
    effectClasses.push('dark:logo-glow-dark')
  }
  // 'color' = sem efeitos, usa as cores originais

  if (animated) {
    effectClasses.push('animate-float-gentle')
  }

  if (pulseGlow) {
    effectClasses.push('animate-pulse-glow')
  }

  return (
    <Image
      src="/logo.svg"
      alt="Vet do Rim — Nefrologia e Urologia Veterinária"
      width={width}
      height={height}
      quality={95}
      className={`object-contain select-none shrink-0 transition-all duration-500 ${effectClasses.join(' ')} ${className}`}
      priority={priority}
      fetchPriority={priority ? 'high' : 'auto'}
    />
  )
}
