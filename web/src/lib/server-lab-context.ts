import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseAppRole, roleHome } from '@/lib/route-authorization'
import { readActiveClinicCookie } from '@/lib/server-active-clinic'
import { resolveActiveClinicResult } from '@/lib/server-clinic-context'
import { throwServerQueryFailure } from '@/lib/server-query-safety'

/**
 * Resolve e valida no servidor a sessao, o papel profissional (`vet` | `admin`)
 * e a clinica ativa do usuário antes de qualquer consulta RSC em `/lab/**`.
 * Falha fechado em erros de consulta ao banco ou ausencia de permissao.
 */
export async function requireLabClinicContext(redirectTo = '/lab') {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    redirect('/auth/login?error=profile')
  }

  const role = parseAppRole(profile.role)
  if (!role) redirect('/auth/login?error=profile')
  if (role !== 'vet' && role !== 'admin') redirect(roleHome(role))

  const preferredClinicId = await readActiveClinicCookie()
  const clinicLookup = await resolveActiveClinicResult(supabase, user.id, preferredClinicId)
  if (!clinicLookup.ok) {
    throwServerQueryFailure('CLINIC_CONTEXT_QUERY_FAILED')
  }

  return {
    supabase,
    user,
    role,
    activeClinic: clinicLookup.context,
  }
}
