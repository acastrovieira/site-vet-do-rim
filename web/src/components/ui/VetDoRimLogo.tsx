interface VetDoRimLogoProps {
  className?: string
  /**
   * 'color'  = logo original azul noturno + dourado (sem efeitos)
   * 'glow'   = logo com glow dourado luminoso — ideal para fundos escuros
   * 'auto'   = reage automaticamente à classe .dark (glow no dark, normal no light)
   * 'white'  = logo invertida (branca) — fallback para casos extremos
   */
  variant?: 'color' | 'glow' | 'auto' | 'white'
  /** Exibe a assinatura de texto ao lado/abaixo do símbolo */
  showText?: boolean
  /** Adiciona animação de flutuação suave */
  animated?: boolean
  /** Adiciona animação de glow pulsante */
  pulseGlow?: boolean
  priority?: boolean // Mantido para compatibilidade de API
}

/**
 * Logo oficial Vet do Rim — Reconstruído em SVG puro e responsivo.
 * Sem dependência de arquivos PNG/SVG externos pesados.
 * 
 * Suporta o modo escuro automático e injeção de estilos de brilho (glow).
 */
export function VetDoRimLogo({
  className = '',
  variant = 'auto',
  showText = false,
  animated = false,
  pulseGlow = false,
}: VetDoRimLogoProps) {
  const effectClasses: string[] = []

  if (variant === 'glow') {
    effectClasses.push('logo-glow-dark')
  } else if (variant === 'auto') {
    effectClasses.push('dark:logo-glow-dark')
  }

  if (animated) {
    effectClasses.push('animate-float-gentle')
  }

  if (pulseGlow) {
    effectClasses.push('animate-pulse-glow')
  }

  // Define as classes de cores baseadas no variant
  const isWhite = variant === 'white'
  const kidneyColor = isWhite ? 'fill-white' : 'fill-[#0D1B2A] dark:fill-white'
  const cutoutColor = isWhite ? 'fill-[#0A0A0C] dark:fill-[#0A0A0C]' : 'fill-[#F4F3EE] dark:fill-[#0A0A0C]'
  const textColor = isWhite ? 'fill-white' : 'fill-[#0D1B2A] dark:fill-[#F4F3EE]'
  const subtitleColor = isWhite ? 'fill-white/80' : 'fill-[#333333] dark:fill-[#F4F3EE]/80'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={showText ? '0 0 800 500' : '290 80 220 220'}
      className={`select-none shrink-0 transition-all duration-500 ${effectClasses.join(' ')} ${className}`}
      aria-label="Vet do Rim — Nefrologia e Urologia Veterinária"
    >
      {/* SÍMBOLO */}
      <g id="simbolo" transform="translate(400, 180)">
        {/* Rim Esquerdo com Espaço Negativo do Gato */}
        <path
          className={`${kidneyColor} transition-colors duration-500`}
          d="M -15,-90 C -55,-90 -95,-60 -95,-15 C -95,25 -75,55 -35,55 C -25,55 -15,45 -15,30 C -15,5 -25,-15 -25,-35 C -25,-48 -20,-58 -15,-65 C -15,-75 -15,-90 -15,-90 Z"
        />
        <path
          className={`${cutoutColor} transition-colors duration-500`}
          d="M -45,55 C -45,35 -35,25 -35,10 C -35,-2 -40,-10 -40,-20 C -40,-21 -38,-24 -36,-24 C -34,-24 -32,-21 -32,-20 C -32,-10 -25,-2 -25,10 C -25,25 -15,35 -15,55 Z"
        />
        <circle cx="-36" cy="-20" r="1.5" className={`${cutoutColor} transition-colors duration-500`} />

        {/* Rim Direito com Espaço Negativo do Cachorro */}
        <path
          className={`${kidneyColor} transition-colors duration-500`}
          d="M 15,-90 C 55,-90 95,-60 95,-15 C 95,25 75,55 35,55 C 25,55 15,45 15,30 C 15,5 25,-15 25,-35 C 25,-48 20,-58 15,-65 C 15,-75 15,-90 15,-90 Z"
        />
        <path
          className={`${cutoutColor} transition-colors duration-500`}
          d="M 45,55 C 45,35 35,25 35,10 C 35,-2 40,-10 40,-20 C 40,-21 38,-24 36,-24 C 34,-24 32,-21 32,-20 C 32,-10 25,-2 25,10 C 25,25 15,35 15,55 Z"
        />
        <circle cx="36" cy="-20" r="1.5" className={`${cutoutColor} transition-colors duration-500`} />

        {/* Linhas Vasculares Douradas */}
        <path
          className="stroke-[#BFA27E] fill-none transition-colors duration-500"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M -85,15 C -65,45 -35,65 -5,65 C 5,65 5,30 -5,15"
        />
        <path
          className="stroke-[#BFA27E] fill-none transition-colors duration-500"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 85,15 C 65,45 35,65 5,65 C -5,65 -5,30 5,15"
        />
        <line x1="-5" y1="50" x2="-5" y2="105" className="stroke-[#BFA27E]" strokeWidth={3} />
        <line x1="5" y1="50" x2="5" y2="105" className="stroke-[#BFA27E]" strokeWidth={3} />
      </g>

      {/* ASSINATURA DE TEXTO (Apenas se showText for true) */}
      {showText && (
        <>
          <text
            x="400"
            y="360"
            className={`font-display font-bold text-[52px] ${textColor} transition-colors duration-500`}
            style={{ textAnchor: 'middle', letterSpacing: '4px' }}
          >
            VET DO RIM
          </text>
          <text
            x="400"
            y="410"
            className={`font-sans font-normal text-[16px] ${subtitleColor} transition-colors duration-500`}
            style={{ textAnchor: 'middle', letterSpacing: '7px' }}
          >
            NEFROLOGIA E UROLOGIA VETERINÁRIA
          </text>
        </>
      )}
    </svg>
  )
}
