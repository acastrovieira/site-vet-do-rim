const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}

export function requirePublicEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  const value = publicEnv[name]

  if (!value || value.includes('dummy-') || value.includes('PROJECT_REF')) {
    throw new Error(`${name} is not configured. Check web/.env.local or the deployment environment.`)
  }

  return value
}
