import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './ProfileForm'
import { UserCircle } from 'lucide-react'
import {
  assertServerQuerySucceeded,
  throwServerQueryFailure,
} from '@/lib/server-query-safety'

export const metadata: Metadata = {
  title: 'Meu Perfil — Lab Evolution',
  description: 'Gerencie seus dados pessoais, contato e senha.',
  robots: { index: false, follow: false },
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  type ProfileRow = { full_name: string | null; phone: string | null; address: string | null }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, phone, address')
    .eq('id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  assertServerQuerySucceeded(profileError, 'PROFILE_QUERY_FAILED')
  if (!profile) throwServerQueryFailure('PROFILE_NOT_FOUND')

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <UserCircle className="h-9 w-9" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Meu perfil</h1>
          <p className="text-slate-500 dark:text-science-200 mt-0.5 text-sm">
            Gerencie seus dados pessoais, contato e senha de acesso.
          </p>
        </div>
      </div>

      <ProfileForm
        initialData={{
          fullName: profile?.full_name ?? null,
          email: user.email ?? '',
          phone: profile?.phone ?? null,
          address: profile?.address ?? null,
        }}
      />
    </div>
  )
}
