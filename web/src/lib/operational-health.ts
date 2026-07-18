import { timingSafeEqual } from 'node:crypto'

export const OPERATIONAL_NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Expires: '0',
  Pragma: 'no-cache',
} as const

const PLACEHOLDER_MARKERS = [
  'dummy-',
  'example.',
  'project_ref',
  'replace-with',
  'placeholder',
]

function isPlaceholder(value: string) {
  const normalized = value.toLowerCase()
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
}

export function isConfiguredSupabaseUrl(
  value: string | undefined,
): value is string {
  if (!value || isPlaceholder(value)) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === '' &&
      /^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
  } catch {
    return false
  }
}

export function isConfiguredSupabasePublicKey(
  value: string | undefined,
): value is string {
  if (!value || value.length > 4096 || isPlaceholder(value)) return false

  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value)) return true
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return false
  }

  try {
    const payload = JSON.parse(
      Buffer.from(value.split('.')[1], 'base64url').toString('utf8'),
    ) as { role?: unknown }

    // A legacy service_role JWT in NEXT_PUBLIC_* would be exposed to browsers.
    return payload.role === 'anon'
  } catch {
    return false
  }
}

type ReadinessEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
}

export function getReadinessChecks(env?: ReadinessEnv) {
  const source = env ?? {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  return {
    runtime: true,
    supabasePublicUrlConfigured: isConfiguredSupabaseUrl(source.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublicKeyConfigured: isConfiguredSupabasePublicKey(
      source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  }
}

export function isReady(checks: ReturnType<typeof getReadinessChecks>) {
  return Object.values(checks).every(Boolean)
}

export function hasValidBearerSecret(
  authorization: string | null,
  expectedSecret: string,
) {
  if (
    !authorization?.startsWith('Bearer ') ||
    expectedSecret.length < 32 ||
    expectedSecret.length > 4096 ||
    authorization.length !== 'Bearer '.length + expectedSecret.length
  ) {
    return false
  }

  const supplied = Buffer.from(authorization.slice('Bearer '.length), 'utf8')
  const expected = Buffer.from(expectedSecret, 'utf8')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function getBoundedTimeoutMs(value: string | undefined, fallback = 5_000) {
  if (!value || !/^\d+$/.test(value)) return fallback

  const parsed = Number(value)
  return parsed >= 1_000 && parsed <= 10_000 ? parsed : fallback
}

export function parseHttpsHealthUrl(value: string | undefined) {
  if (!value) return null

  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      !url.hostname
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}
