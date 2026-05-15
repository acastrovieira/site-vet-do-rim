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
  await supabase.auth.getUser()

  // Métricas rápidas (dados reais do banco)
  const [{ count: totalPets }, { count: totalTutores }] = await Promise.all([
    supabase.from('pets').select('*', { count: 'exact', head: true }),
    supabase.from('tutores').select('*', { count: 'exact', head: true }),
  ])

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
      {/* Saudação */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Bom dia, doutor(a) 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Visão geral dos seus pacientes renais · Lab Evolution
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4"
          >
            <div className={`p-2.5 rounded-xl ${color}`}>
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder: lista de pacientes recentes */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="font-display font-semibold text-slate-900 mb-4">Pacientes recentes</h2>
        <p className="text-sm text-slate-400">
          Lista de pacientes aparecerá aqui. Integração com o Lab Evolution atual em andamento.
        </p>
      </div>
    </div>
  )
}
