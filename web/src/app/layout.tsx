import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import type { Metadata } from 'next'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
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
    default: 'Vet do Rim — Nefrologia e Urologia Veterinária de Alta Complexidade',
    template: '%s | Vet do Rim',
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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Vet do Rim' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vet do Rim — Nefrologia e Urologia Veterinária',
    description: 'Especialistas em nefrologia e urologia veterinária.',
    images: ['/og-image.png'],
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
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
