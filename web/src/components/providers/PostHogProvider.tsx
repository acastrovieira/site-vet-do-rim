'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Inicializa o PostHog se a chave estiver definida
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY && typeof window !== 'undefined') {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only', // Opcional, para anonimizar melhor ou reduzir custos
        capture_pageview: false // Se preferirmos capturar via route handler (manual)
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
