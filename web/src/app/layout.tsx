import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import type { Metadata } from 'next'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { WhatsAppFloat } from '@/components/marketing/WhatsAppFloat'
import { CookieBanner } from '@/components/ui/CookieBanner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vetdorim.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Vet do Rim — Nefrologia e Urologia Veterinária Avançada',
    template: '%s | Vet do Rim',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      { rel: 'mask-icon', url: '/logo.png', color: '#1A2E5A' },
    ],
  },
  description:
    'Especialistas em nefrologia e urologia veterinária. Atendimento humanizado, medicina de ponta e rigor técnico científico para o bem-estar do seu animal.',
  keywords: [
    'nefrologia veterinária',
    'urologia veterinária',
    'doença renal crônica cão gato',
    'taxa de filtração glomerular veterinária',
    'IRIS staging veterinário',
    'hemodiálise veterinária',
    'urolitíase felina',
  ],
  authors: [{ name: 'Vet do Rim', url: siteUrl }],
  creator: 'Vet do Rim',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: siteUrl,
    siteName: 'Vet do Rim',
    title: 'Vet do Rim — Nefrologia e Urologia Veterinária',
    description:
      'Especialistas em nefrologia e urologia veterinária. Atendimento humanizado, medicina de ponta.',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Vet do Rim — Nefrologia Veterinária' }],
  },
  twitter: {
    card: 'summary',
    title: 'Vet do Rim — Nefrologia e Urologia Veterinária',
    description: 'Especialistas em nefrologia e urologia veterinária.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: siteUrl },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${plusJakarta.variable} h-full antialiased scroll-smooth`}
    >
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vtqemhmsyflhpxxptdls.supabase.co'} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vtqemhmsyflhpxxptdls.supabase.co'} />
      </head>
      <body className="min-h-full flex flex-col transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PostHogProvider>
            {children}
          </PostHogProvider>
          <WhatsAppFloat />
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  )
}
