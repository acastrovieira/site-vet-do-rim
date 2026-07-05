import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { requirePublicEnv } from '@/lib/env'

/**
 * Cria um cliente Supabase para uso em Server Components e Server Actions.
 * Utiliza cookies de sessão do Next.js de forma segura.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll chamado de Server Component — pode ser ignorado com segurança
            // se o middleware está atualizando as sessões dos usuários.
          }
        },
      },
    }
  )
}
