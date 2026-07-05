'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { requirePublicEnv } from '@/lib/env'

/**
 * Cria um cliente Supabase para uso em Client Components.
 * Singleton pattern para evitar múltiplas instâncias.
 */
export function createClient() {
  return createBrowserClient<Database>(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}
