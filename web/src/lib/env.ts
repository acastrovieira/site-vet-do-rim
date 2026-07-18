const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}

export function isSafeSupabasePublicKey(value: string | undefined): value is string {
  if (!value || value.length > 4096 || value.startsWith('sb_secret_')) return false
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value)) return true
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return false
  }

  try {
    const encodedPayload = value.split('.')[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
    const paddedPayload = encodedPayload.padEnd(
      Math.ceil(encodedPayload.length / 4) * 4,
      '=',
    )
    const payload = JSON.parse(globalThis.atob(paddedPayload)) as { role?: unknown }
    return payload.role === 'anon'
  } catch {
    return false
  }
}

export function requirePublicEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  const value = publicEnv[name]

  if (
    !value ||
    value.includes('dummy-') ||
    value.includes('PROJECT_REF') ||
    (name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && !isSafeSupabasePublicKey(value))
  ) {
    throw new Error(`${name} is not configured. Check web/.env.local or the deployment environment.`)
  }

  return value
}
