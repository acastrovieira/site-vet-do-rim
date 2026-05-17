'use client'

import { useState, useEffect } from 'react'

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Verifica se já aceitou
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
    <div className="fixed bottom-0 inset-x-0 pb-4 sm:pb-6 px-4 sm:px-6 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="mx-auto max-w-4xl glass-card border border-white/10 p-4 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6 shadow-2xl">
        <div className="flex-1 text-sm text-science-200">
          <p>
            <strong className="text-white">Nós respeitamos sua privacidade.</strong> Utilizamos cookies para
            garantir que você tenha a melhor experiência na nossa plataforma, além de analisar nosso tráfego
            conforme a Lei Geral de Proteção de Dados (LGPD).
          </p>
        </div>
        <div className="flex shrink-0 gap-3 w-full sm:w-auto">
          <button
            onClick={acceptCookies}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gold-400/10 text-gold-400 border border-gold-400/20 text-sm font-bold hover:bg-gold-400 hover:text-[#0A0A0C] transition-all duration-300 whitespace-nowrap"
          >
            Entendi e concordo
          </button>
        </div>
      </div>
    </div>
  )
}
