import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FlaskConical, Users, Activity, TrendingUp } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Dashboard — Lab Evolution',
  description: 'Painel clínico do Lab Evolution. Gerencie seus pacientes renais.',
  robots: { index: false, follow: false },
}

export default async function LabDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Métricas rápidas (dados reais do banco)
  const [{ count: totalPets }, { count: totalTutores }] = await Promise.all([
    supabase.from('pets').select('*', { count: 'exact', head: true }),
    supabase.from('tutores').select('*', { count: 'exact', head: true }),
  ])

  // Perfil do usuário logado
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user!.id)
    .single() as { data: { full_name: string | null; role: string } | null; error: Error | null }

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
      color: 'text-brand-500 bg-brand-50',
    },
    {
      icon: FlaskConical,
      label: 'Pacientes ativos',
      value: totalPets ?? 0,
      color: 'text-emerald-500 bg-emerald-50',
    },
    {
      icon: Activity,
      label: 'Consultas este mês',
      value: '—',
      color: 'text-violet-500 bg-violet-50',
    },
    {
      icon: TrendingUp,
      label: 'Adesão ao protocolo',
      value: '—',
      color: 'text-amber-500 bg-amber-50',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Saudação dinâmica */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-science-200 mt-1 text-sm">
          Visão geral dos seus pacientes renais · Lab Evolution
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="glass-card rounded-2xl border-white/5 p-5 flex items-start gap-4"
          >
            <div className={`p-2.5 rounded-xl ${color} bg-opacity-10`}>
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-display">{value}</p>
              <p className="text-xs text-science-200 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder: lista de pacientes recentes */}
      <div className="glass-card rounded-2xl border-white/5 p-6">
        <h2 className="font-display font-semibold text-white mb-4">Pacientes recentes</h2>
        <p className="text-sm text-science-200">
          Acesse a seção <strong className="text-white">Pacientes</strong> no menu lateral para gerenciar seus pacientes renais.
        </p>
      </div>
    </div>
  )
}
