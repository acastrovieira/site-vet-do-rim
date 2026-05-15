import Image from 'next/image'

interface VetDoRimLogoProps {
  width?: number
  height?: number
  className?: string
  /**
   * 'color'  = logo original navy + dourado (padrão, fundos claros)
   * 'white'  = logo invertida para fundos escuros
   */
  variant?: 'color' | 'white'
  /**
   * true = exibe apenas o símbolo sem texto — ideal para header compacto e favicon
   * (para este logo, sempre exibe o símbolo pois não tem texto integrado)
   */
  symbolOnly?: boolean
}

/**
 * Logo oficial da marca Vet do Rim.
 * PNG premium: dois gotas navy com gato + cão e rim dourado no centro.
 * Substitua /images/logo-oficial.png pela imagem oficial de alta resolução.
 */
export function VetDoRimLogo({
  width = 160,
  height = 160,
  className = '',
  variant = 'color',
  symbolOnly = false,
}: VetDoRimLogoProps) {
  // Em symbolOnly, manter proporção quadrada para o ícone
  const displayWidth = symbolOnly ? height : width
  const displayHeight = height

  return (
    <Image
      src="/images/logo-oficial.png"
      alt="Vet do Rim — Nefrologia e Urologia Veterinária"
      width={displayWidth}
      height={displayHeight}
      quality={95}
      className={`object-contain select-none ${
        variant === 'white' ? 'brightness-0 invert' : ''
      } ${className}`}
      style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
      priority
    />
  )
}
