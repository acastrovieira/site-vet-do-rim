import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, Home, Stethoscope } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'
import { isRoleAuthorized, parseAppRole, roleHome } from '@/lib/route-authorization'
import { PortalLogoutButton } from './PortalLogoutButton'

type PortalProfile = {
  full_name: string | null
  role: string | null
}

export const metadata = {
  title: 'Portal do Tutor',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) redirect('/auth/login?redirectTo=/portal')

  const { data: rawProfile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()
  const profile = rawProfile as PortalProfile | null
  const role = parseAppRole(profile?.role)

  if (profileError || !role) redirect('/auth/login?error=profile')
  if (!isRoleAuthorized('/portal', role)) redirect(roleHome(role))
  const firstName = profile?.full_name?.trim().split(/\s+/)[0]

  return (
    <main className="min-h-screen bg-science-50 px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-8 flex w-full items-start justify-between gap-4">
          <Link href="/" aria-label="Vet do Rim — Início">
            <VetDoRimLogo
              className="h-24 w-40"
              variant="auto"
              showText
              orientation="vertical"
            />
          </Link>
          <PortalLogoutButton />
        </div>

        <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
            Portal do Tutor
          </p>
          <h1 className="font-display text-3xl font-bold text-slate-900">
            Olá{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
            Seu acesso está ativo. A área clínica completa é restrita à equipe veterinária;
            por aqui você pode acompanhar conteúdos e ferramentas educativas da Vet do Rim.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-200 hover:bg-brand-50"
            >
              <Home className="mb-3 h-5 w-5 text-brand-600" aria-hidden />
              <span className="block text-sm font-semibold text-slate-900">Início</span>
              <span className="mt-1 block text-xs text-slate-500">Voltar ao site institucional.</span>
            </Link>
            <Link
              href="/blog"
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-200 hover:bg-brand-50"
            >
              <FileText className="mb-3 h-5 w-5 text-brand-600" aria-hidden />
              <span className="block text-sm font-semibold text-slate-900">Blog</span>
              <span className="mt-1 block text-xs text-slate-500">Ler conteúdos educativos.</span>
            </Link>
            <Link
              href="/ferramentas"
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-200 hover:bg-brand-50"
            >
              <Stethoscope className="mb-3 h-5 w-5 text-brand-600" aria-hidden />
              <span className="block text-sm font-semibold text-slate-900">Ferramentas</span>
              <span className="mt-1 block text-xs text-slate-500">Acessar recursos disponíveis.</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
