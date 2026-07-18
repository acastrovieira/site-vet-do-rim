'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * Boundary global de erros do Next.js App Router.
 * Exibida quando uma rota ou componente lança uma exceção não tratada.
 * NUNCA exibe stack traces em produção.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Mantém o log correlacionável sem copiar mensagem, stack ou dados do provedor.
    console.error('[GlobalError]', {
      digest: error.digest ?? 'unavailable',
      type: error.name,
    })
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-science-50 px-4">
      <div className="max-w-md w-full text-center">
        {/* Ícone */}
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" strokeWidth={1.5} />
          </div>
        </div>

        {/* Mensagem */}
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">
          Algo deu errado
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          Ocorreu um erro inesperado. Tente novamente ou volte ao início.
          {error.digest && (
            <span className="block mt-2 text-xs text-slate-300 font-mono">
              Ref: {error.digest}
            </span>
          )}
        </p>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Tentar novamente
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            <Home className="h-4 w-4" aria-hidden />
            Ir ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
