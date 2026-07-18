export const ANALYTICS_CONSENT_KEY = 'vetdorim_analytics_consent'
export const LEGACY_COOKIE_CONSENT_KEY = 'vetdorim_cookies_accepted'
export const ANALYTICS_CONSENT_EVENT = 'vetdorim:analytics-consent'

export type AnalyticsConsent = 'accepted' | 'declined' | null

export function isAnalyticsAllowedPath(pathname: string): boolean {
  return !['/auth', '/lab', '/portal'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null

  try {
    const current = window.localStorage.getItem(ANALYTICS_CONSENT_KEY)
    if (current === 'accepted' || current === 'declined') {
      return current
    }

    // Mantém compatibilidade com quem já consentiu na versão anterior.
    if (window.localStorage.getItem(LEGACY_COOKIE_CONSENT_KEY) === 'true') {
      return 'accepted'
    }
    return null
  } catch {
    // Armazenamento indisponível nunca pode derrubar o layout nem habilitar analytics.
    return 'declined'
  }
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent)
    window.localStorage.removeItem(LEGACY_COOKIE_CONSENT_KEY)
  } catch {
    // Sem persistência confiável, mantém a decisão mais restritiva nesta sessão.
    try {
      window.localStorage.removeItem(ANALYTICS_CONSENT_KEY)
    } catch {
      // O armazenamento pode permanecer totalmente bloqueado.
    }
  }

  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT))
}

export function subscribeToAnalyticsConsent(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === ANALYTICS_CONSENT_KEY ||
      event.key === LEGACY_COOKIE_CONSENT_KEY
    ) {
      onChange()
    }
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(ANALYTICS_CONSENT_EVENT, onChange)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, onChange)
  }
}
