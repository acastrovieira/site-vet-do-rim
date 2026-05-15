import Image from 'next/image'

interface VetDoRimLogoProps {
  width?: number
  height?: number
  className?: string
  /** 'color' = navy+gold | 'white' = todo branco (para fundos escuros) */
  variant?: 'color' | 'white'
  /** true = exibe apenas o símbolo (sem textos), ideal para o Header */
  symbolOnly?: boolean
}

/**
 * Logo oficial da marca Vet do Rim.
 * SVG inline — escalável, sem requisição HTTP, sem pixelização.
 */
export function VetDoRimLogo({
  width = 160,
  height = 200,
  className = '',
  variant = 'color',
}: VetDoRimLogoProps) {

  return (
    <Image
      src="/images/logo-oficial.svg"
      alt="Vet do Rim"
      width={width}
      height={height}
      className={`${className} object-contain ${variant === 'white' ? 'brightness-0 invert' : ''}`}
      style={{ 
        width: width ? `${width}px` : 'auto', 
        height: height ? `${height}px` : 'auto' 
      }}
    />
  )
}
