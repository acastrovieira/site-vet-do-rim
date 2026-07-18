import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LabShell } from '@/components/lab/LabShell'
import { parseAppRole, roleHome } from '@/lib/route-authorization'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Layout protegido do Lab Evolution.
 * A sessão já foi validada pelo middleware; aqui carregamos o perfil do usuário.
 */
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) redirect('/auth/login?redirectTo=/lab')

  // Only the fields needed by the client shell cross the server boundary.
  const { data: rawProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .maybeSingle()
  const role = parseAppRole(rawProfile?.role)

  if (profileError || !rawProfile || !role) redirect('/auth/login?error=profile')
  if (role !== 'vet' && role !== 'admin') redirect(roleHome(role))

  return (
    <LabShell
      profile={{ fullName: rawProfile.full_name, role }}
    >
      {children}
    </LabShell>
  )
}
