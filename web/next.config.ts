import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // ── Segurança ─────────────────────────────────────────────
  // Remove o header "X-Powered-By: Next.js" para não expor informações do servidor
  poweredByHeader: false,

  // ── Imagens ───────────────────────────────────────────────
  images: {
    // Formatos modernos para imagens otimizadas
    formats: ['image/avif', 'image/webp'],
    // Qualidades suportadas (75 = padrão, 95 = logo premium)
    qualities: [75, 95],
    // Cache TTL mínimo para imagens otimizadas (60 dias)
    minimumCacheTTL: 5184000,
    // Domínios externos permitidos (Supabase Storage)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },

  // ── Performance ───────────────────────────────────────────
  // Compressão gzip habilitada
  compress: true,

  turbopack: {
    root: path.resolve(__dirname),
  },

  // ── Experimental ─────────────────────────────────────────
  experimental: {
    // Otimiza importações de pacotes de ícones (reduz bundle size)
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
