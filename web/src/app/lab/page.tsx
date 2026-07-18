import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FlaskConical, Users, Activity, TrendingUp } from 'lucide-react'
import {
  assertServerQuerySucceeded,
  throwServerQueryFailure,
} from '@/lib/server-query-safety'

export const metadata: Metadata = {
  title: 'Dashboard — Lab Evolution',
  description: 'Painel clínico do Lab Evolution. Gerencie seus pacientes renais.',
  robots: { index: false, follow: false },
}

export default async function LabDashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/auth/login?redirectTo=/lab')

  // Métricas rápidas (dados reais do banco)
  const [petsResult, tutoresResult] = await Promise.all([
    supabase.from('pets').select('id', { count: 'exact', head: true }),
    supabase.from('tutores').select('id', { count: 'exact', head: true }),
  ])
  assertServerQuerySucceeded(petsResult.error, 'LAB_PETS_COUNT_FAILED')
  assertServerQuerySucceeded(tutoresResult.error, 'LAB_TUTORES_COUNT_FAILED')
  const totalPets = petsResult.count
  const totalTutores = tutoresResult.count

  // Perfil do usuário logado
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  assertServerQuerySucceeded(profileError, 'LAB_PROFILE_QUERY_FAILED')
  if (!profile) throwServerQueryFailure('LAB_PROFILE_NOT_FOUND')

  // Saudação dinâmica por horário de Brasília (UTC-3)
  const brtHour = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  ).getHours()
  const greeting = brtHour < 12 ? 'Bom dia' : brtHour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doutor(a)'

  const cards = [
    {
      icon: Users,
      label: 'Tutores cadastrados',
      value: totalTutores ?? 0,
      color: 'text-brand-600 dark:text-brand-400 bg-brand-500/10',
    },
    {
      icon: FlaskConical,
      label: 'Pacientes cadastrados',
      value: totalPets ?? 0,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    },
    {
      icon: Activity,
      label: 'Consultas este mês',
      value: '—',
      color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
    },
    {
      icon: TrendingUp,
      label: 'Adesão ao protocolo',
      value: '—',
      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Saudação dinâmica */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-slate-600 dark:text-science-200 mt-1 text-sm">
          Visão geral dos seus pacientes renais · Lab Evolution
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="glass-card rounded-2xl border-slate-200 dark:border-white/5 p-5 flex items-start gap-4"
          >
            <div className={`p-2.5 rounded-xl ${color}`}>
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-display">{value}</p>
              <p className="text-xs text-slate-600 dark:text-science-200 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder: lista de pacientes recentes */}
      <div className="glass-card rounded-2xl border-slate-200 dark:border-white/5 p-6">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-4">Pacientes recentes</h2>
        <p className="text-sm text-slate-600 dark:text-science-200">
          Acesse a seção <strong className="text-slate-900 dark:text-white">Pacientes</strong> no menu lateral para gerenciar seus pacientes renais.
        </p>
      </div>
    </div>
  )
}
