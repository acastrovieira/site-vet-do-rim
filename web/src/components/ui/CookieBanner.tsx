'use client'

import { useState, useEffect } from 'react'

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const hasAccepted = localStorage.getItem('vetdorim_cookies_accepted')
    if (!hasAccepted) {
      setIsVisible(true)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem('vetdorim_cookies_accepted', 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

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
            Utilizamos cookies para garantir que você tenha a melhor experiência na nossa
            plataforma, além de analisar nosso tráfego conforme a Lei Geral de Proteção de
            Dados (LGPD).
          </p>
        </div>

        {/* CTA dourado */}
        <div className="flex shrink-0 gap-3 w-full sm:w-auto">
          <button
            onClick={acceptCookies}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-250 whitespace-nowrap hover:-translate-y-0.5"
            style={{
              background: '#C8A97A',
              color: '#0D1F3C',
              boxShadow: '0 4px 14px rgba(200, 169, 122, 0.35)',
            }}
          >
            Entendi e concordo
          </button>
        </div>
      </div>
    </div>
  )
}
