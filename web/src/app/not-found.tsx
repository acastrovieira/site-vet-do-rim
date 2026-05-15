import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { Search, ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Página não encontrada — Vet do Rim',
  robots: { index: false, follow: false },
}

/**
 * Página 404 global — exibida quando uma rota não existe.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-screen flex items-center justify-center pt-16 px-4"
        aria-labelledby="not-found-heading"
      >
        <div className="max-w-lg w-full text-center py-24">
          {/* Ícone decorativo */}
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-3xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <Search className="h-10 w-10 text-brand-300" strokeWidth={1.5} aria-hidden />
            </div>
          </div>

          {/* Código 404 */}
          <p className="font-display text-8xl font-bold text-gradient-brand mb-4" aria-hidden>
            404
          </p>

          {/* Mensagem */}
          <h1
            id="not-found-heading"
            className="font-display text-2xl font-bold text-slate-900 mb-3"
          >
            Página não encontrada
          </h1>
          <p className="text-slate-500 leading-relaxed mb-8 max-w-sm mx-auto">
            A página que você procura não existe ou foi movida.
            Verifique o endereço ou use um dos links abaixo.
          </p>

          {/* Links de navegação */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar ao início
            </Link>
            <Link
              href="/ferramentas/calculadora-tfg"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Calculadora TFG gratuita
            </Link>
          </div>

          {/* Links úteis */}
          <div className="text-sm text-slate-400">
            <p className="mb-2">Links úteis:</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/blog" className="text-brand-600 hover:underline">Blog Científico</Link>
              <Link href="/ferramentas" className="text-brand-600 hover:underline">Ferramentas</Link>
              <Link href="/auth/login" className="text-brand-600 hover:underline">Lab Evolution</Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
