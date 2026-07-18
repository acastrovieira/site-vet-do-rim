'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[RootGlobalError]', {
      digest: error.digest ?? 'unavailable',
      type: error.name,
    })
  }, [error])

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 448, textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: 28 }}>
              Algo deu errado
            </h1>
            <p style={{ margin: '0 0 24px', color: '#475569', lineHeight: 1.6 }}>
              Não foi possível carregar a página. Tente novamente ou volte ao início.
              {error.digest && (
                <span style={{ display: 'block', marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                  Ref: {error.digest}
                </span>
              )}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={reset}
                style={{ minHeight: 44, padding: '10px 18px', border: 0, borderRadius: 12, background: '#176b5b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Tentar novamente
              </button>
              <Link
                href="/"
                style={{ minHeight: 44, boxSizing: 'border-box', padding: '10px 18px', border: '1px solid #cbd5e1', borderRadius: 12, color: '#334155', fontWeight: 700, textDecoration: 'none' }}
              >
                Ir ao início
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
