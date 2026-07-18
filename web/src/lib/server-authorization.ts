import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.ts'
import { parseAppRole, type AppRole } from './route-authorization.ts'

type ServerSupabaseClient = SupabaseClient<Database>

export type ServerAuthorizationResult =
  | {
      ok: true
      role: AppRole
      userId: string
    }
  | {
      ok: false
      code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'AUTHORIZATION_UNAVAILABLE'
      status: 401 | 403 | 503
    }

/**
 * Revalida identidade e papel usando fontes controladas pelo servidor.
 *
 * O papel vem de `public.profiles`, nunca de `user_metadata`, e a RLS continua
 * sendo a segunda barreira no momento da mutacao. Falhas de consulta negam o
 * acesso sem expor detalhes do provedor.
 */
export async function authorizeServerRoles(
  supabase: ServerSupabaseClient,
  allowedRoles: readonly AppRole[],
): Promise<ServerAuthorizationResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, code: 'UNAUTHENTICATED', status: 401 }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, code: 'AUTHORIZATION_UNAVAILABLE', status: 503 }
  }

  const role = parseAppRole(profile?.role)
  if (!role || !allowedRoles.includes(role)) {
    return { ok: false, code: 'FORBIDDEN', status: 403 }
  }

  return { ok: true, role, userId: user.id }
}
