import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LabShell } from '@/components/lab/LabShell'

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
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <LabShell user={user} profile={profile}>
      {children}
    </LabShell>
  )
}
