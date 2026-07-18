'use client'

import { useSyncExternalStore } from 'react'
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeToAnalyticsConsent,
} from '@/lib/analytics-consent'

export function CookieBanner() {
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsent,
    () => null,
  )

  if (consent !== null) return null

  return (
    <div className="fixed bottom-0 inset-x-0 pb-4 sm:pb-5 px-4 sm:px-6 z-[100]">
      <div
        className="mx-auto max-w-4xl rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-6"
        style={{
          background: '#0F2244',
          border: '1px solid rgba(200, 169, 122, 0.25)',
          boxShadow: '0 -4px 32px rgba(9, 21, 48, 0.5), 0 8px 40px rgba(9, 21, 48, 0.4)',
        }}
      >
        {/* Texto — branco puro, sempre legível */}
        <div className="flex-1 text-sm leading-relaxed" style={{ color: '#FFFFFF' }}>
          <p>
            <strong style={{ color: '#C8A97A' }}>Nós respeitamos sua privacidade.</strong>{' '}
            Usamos armazenamento essencial para o funcionamento da plataforma. Se você
            autorizar, também utilizaremos cookies de análise para entender o uso do site.
          </p>
          <a
            href="/legal/privacidade"
            className="inline-block mt-1 text-xs underline underline-offset-2"
            style={{ color: 'rgba(255,255,255,0.8)' }}
          >
            Política de privacidade
          </a>
        </div>

        {/* CTA dourado */}
        <div className="flex flex-col sm:flex-row shrink-0 gap-2 w-full sm:w-auto">
          <button
            onClick={() => setAnalyticsConsent('declined')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap border border-white/30 text-white hover:bg-white/10 transition-colors"
          >
            Somente necessários
          </button>
          <button
            onClick={() => setAnalyticsConsent('accepted')}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-250 whitespace-nowrap hover:-translate-y-0.5"
            style={{
              background: '#C8A97A',
              color: '#0D1F3C',
              boxShadow: '0 4px 14px rgba(200, 169, 122, 0.35)',
            }}
          >
            Aceitar analytics
          </button>
        </div>
      </div>
    </div>
  )
}
