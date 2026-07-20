import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClinicMembershipRole, Database } from '../types/database.ts'
import { parseAppRole, type AppRole } from './route-authorization.ts'
import { resolveActiveClinic } from './server-clinic-context.ts'

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
 * Igual a `ServerAuthorizationResult`, mas no ramo `ok` inclui o contexto de
 * clinica resolvido via `clinic_memberships` (ver `server-clinic-context.ts`).
 */
export type ServerClinicAuthorizationResult =
  | {
      ok: true
      role: AppRole
      userId: string
      clinicId: string | null
      membershipRole: ClinicMembershipRole | null
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

/**
 * Variante de `authorizeServerRoles` que tambem resolve a clinica ativa do
 * usuario (contrato Fase 1.5, docs/architecture/fase1-tenancy-implementation-spec.md
 * secao 4).
 *
 * Retrocompatibilidade deliberada: a fronteira de acesso continua sendo
 * `profiles.role` (via `authorizeServerRoles`), exatamente como hoje, ATE o
 * `enforce` (fora deste lote) trocar as policies para exigirem membership.
 * A ausencia de membership (`clinicId: null`) NAO bloqueia o acesso aqui —
 * ela apenas informa ao chamador que ainda nao ha contexto de clinica para
 * gravar/filtrar por `clinic_id` (estado pre-backfill remoto). Isso permite
 * que APIs comecem a escrever `clinic_id` como defesa em profundidade sem
 * quebrar o comportamento atual quando a membership ainda nao existe.
 */
export async function authorizeClinicAccess(
  supabase: ServerSupabaseClient,
  allowedRoles: readonly AppRole[],
): Promise<ServerClinicAuthorizationResult> {
  const base = await authorizeServerRoles(supabase, allowedRoles)
  if (!base.ok) return base

  const clinicContext = await resolveActiveClinic(supabase, base.userId)

  return {
    ok: true,
    role: base.role,
    userId: base.userId,
    clinicId: clinicContext?.clinicId ?? null,
    membershipRole: clinicContext?.membershipRole ?? null,
  }
}
