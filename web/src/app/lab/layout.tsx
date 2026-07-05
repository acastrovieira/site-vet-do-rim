import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LabShell } from '@/components/lab/LabShell'
import type { Database } from '@/types/database'

type LabProfile = Database['public']['Tables']['profiles']['Row']

/**
 * Layout protegido do Lab Evolution.
 * A sessão já foi validada pelo middleware; aqui carregamos o perfil do usuário.
 */
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirectTo=/lab')

  // Carrega perfil do banco (role, nome)
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as LabProfile | null

  if (profile?.role !== 'vet' && profile?.role !== 'admin') {
    redirect('/portal')
  }

  return (
    <LabShell user={user} profile={profile}>
      {children}
    </LabShell>
  )
}
