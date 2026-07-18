'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { usePathname } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'
import {
  getAnalyticsConsent,
  isAnalyticsAllowedPath,
  subscribeToAnalyticsConsent,
} from '@/lib/analytics-consent'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsent,
    () => null,
  )

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (consent !== 'accepted' || !key || !isAnalyticsAllowedPath(pathname)) {
      if (posthog.__loaded) posthog.opt_out_capturing()
      return
    }

    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        mask_personal_data_properties: true,
      })
    }
    posthog.opt_in_capturing()
  }, [consent, pathname])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
