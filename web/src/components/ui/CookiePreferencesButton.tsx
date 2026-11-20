'use client'

import { clearAnalyticsConsent } from '@/lib/analytics-consent'

export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={() => clearAnalyticsConsent()}
      className="underline underline-offset-2 hover:opacity-90 transition-opacity text-left"
    >
      Preferências de cookies
    </button>
  )
}
