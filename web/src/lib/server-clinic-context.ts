import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClinicMembershipRole, Database } from '../types/database.ts'
import { isUuid } from './identifiers.ts'

type ServerSupabaseClient = SupabaseClient<Database>

export interface ActiveClinicContext {
  clinicId: string
  membershipRole: ClinicMembershipRole
}

export interface ActiveClinicOption {
  clinicId: string
  clinicName: string
  membershipRole: ClinicMembershipRole
}

export type ActiveClinicLookupResult =
  | { ok: true; context: ActiveClinicContext | null }
  | { ok: false }

export type ActiveClinicListResult =
  | { ok: true; clinics: ActiveClinicOption[] }
  | { ok: false }

/**
 * Resolve a clinica ativa do usuario autenticado falhando fechado em caso de
 * erro de consulta no banco (`ok: false`), diferenciando erro de infra de
 * usuario sem membership (`ok: true, context: null`).
 *
 * Quando `preferredClinicId` (UUID) for informado, valida vinculo e status ativo
 * da clinica solicitada antes de aceita-la; caso tenha sido revogada ou suspensa,
 * cai de forma segura na primeira membership ativa por `criado_em`.
 */
export async function resolveActiveClinicResult(
  supabase: ServerSupabaseClient,
  userId: string,
  preferredClinicId?: string | null,
): Promise<ActiveClinicLookupResult> {
  const trimmedPreference = typeof preferredClinicId === 'string'
    ? preferredClinicId.trim()
    : ''
  const requestedClinicId = isUuid(trimmedPreference) ? trimmedPreference : null

  if (requestedClinicId !== null) {
    const { data: preferred, error: preferredError } = await supabase
      .from('clinic_memberships')
      .select('clinic_id, role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('clinic_id', requestedClinicId)
      .maybeSingle()

    if (preferredError) return { ok: false }

    if (preferred) {
      const { data: activeClinicRow, error: clinicError } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', preferred.clinic_id)
        .eq('status', 'active')
        .maybeSingle()

      if (clinicError) return { ok: false }

      if (activeClinicRow) {
        return {
          ok: true,
          context: { clinicId: preferred.clinic_id, membershipRole: preferred.role },
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('clinic_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false }
  if (!data) return { ok: true, context: null }

  return {
    ok: true,
    context: { clinicId: data.clinic_id, membershipRole: data.role },
  }
}

/**
 * Wrapper de compatibilidade para chamadores legados: resolve a clinica ativa
 * ou retorna null quando nao ha membership (ou em erro — prefira `resolveActiveClinicResult`
 * para distinguir indisponibilidade fail-closed).
 */
export async function resolveActiveClinic(
  supabase: ServerSupabaseClient,
  userId: string,
  preferredClinicId?: string | null,
): Promise<ActiveClinicContext | null> {
  const result = await resolveActiveClinicResult(supabase, userId, preferredClinicId)
  return result.ok ? result.context : null
}

/**
 * Lista todas as clinicas ativas em que o usuario possui vinculo ativo,
 * preservando a ordem cronologica de ingresso (`criado_em`).
 */
export async function listActiveUserClinics(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<ActiveClinicListResult> {
  const { data: memberships, error: membershipsError } = await supabase
    .from('clinic_memberships')
    .select('clinic_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('criado_em', { ascending: true })
    .order('clinic_id', { ascending: true })

  if (membershipsError) return { ok: false }
  if (!memberships || memberships.length === 0) return { ok: true, clinics: [] }

  const uniqueClinicIds = Array.from(new Set(memberships.map((item) => item.clinic_id)))
  const { data: clinicsData, error: clinicsError } = await supabase
    .from('clinics')
    .select('id, nome')
    .in('id', uniqueClinicIds)
    .eq('status', 'active')

  if (clinicsError) return { ok: false }

  const clinicNameById = new Map<string, string>()
  for (const row of clinicsData ?? []) {
    clinicNameById.set(row.id, row.nome)
  }

  const clinics: ActiveClinicOption[] = []
  for (const membership of memberships) {
    const clinicName = clinicNameById.get(membership.clinic_id)
    if (!clinicName) continue
    clinics.push({
      clinicId: membership.clinic_id,
      clinicName,
      membershipRole: membership.role,
    })
  }

  return { ok: true, clinics }
}

export function resolveActiveClinicFromList(
  clinics: readonly ActiveClinicOption[],
  preferredClinicId?: string | null,
): ActiveClinicOption | null {
  if (clinics.length === 0) return null

  const trimmedPreference = typeof preferredClinicId === 'string'
    ? preferredClinicId.trim()
    : ''
  if (isUuid(trimmedPreference)) {
    const matched = clinics.find((clinic) => clinic.clinicId === trimmedPreference)
    if (matched) return matched
  }

  return clinics[0]
}
