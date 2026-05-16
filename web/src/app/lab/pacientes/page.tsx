import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FlaskConical, Plus, Search } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pacientes — Lab Evolution',
  description: 'Lista de pacientes renais cadastrados no Lab Evolution.',
  robots: { index: false, follow: false },
}

export default async function PacientesPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pets, error } = await (supabase as any)
    .from('pets')
    .select('id, nome, especie, raca, status_paciente, criado_em, tutores(nome)')
    .order('criado_em', { ascending: false })
    .limit(50) as {
      data: Array<{
        id: string
        nome: string
        especie: string
        raca: string | null
        status_paciente: string
        criado_em: string
        tutores: { nome: string } | null
      }> | null
      error: Error | null
    }

  const statusColors: Record<string, string> = {
    ativo: 'bg-emerald-50 text-emerald-700',
    monitoramento: 'bg-amber-50 text-amber-700',
    inativo: 'bg-slate-50 text-slate-500',
    obito: 'bg-red-50 text-red-700',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Pacientes renais cadastrados · Lab Evolution
          </p>
        </div>
        <Link
          href="/lab/pacientes/novo"
          id="btn-novo-paciente"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          aria-label="Cadastrar novo paciente"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Novo paciente
        </Link>
      </div>

      {/* Search (UI apenas — funcionalidade futura) */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
        <input
          type="search"
          placeholder="Buscar por nome ou tutor…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          disabled
          aria-label="Busca de pacientes (em breve)"
        />
      </div>

      {/* Tabela / Lista */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {error || !pets || pets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FlaskConical className="h-12 w-12 mb-4 opacity-30" strokeWidth={1.5} />
            <p className="font-semibold text-slate-500">Nenhum paciente cadastrado</p>
            <p className="text-sm mt-1">Adicione o primeiro paciente para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Lista de pacientes">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Paciente</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Espécie</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Tutor</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5" aria-label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pets.map((pet) => (
                  <tr key={pet.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {pet.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{pet.nome}</p>
                          <p className="text-xs text-slate-400">{pet.raca ?? 'Raça não informada'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 capitalize hidden sm:table-cell">{pet.especie}</td>
                    <td className="px-5 py-4 text-slate-600 hidden md:table-cell">
                      {pet.tutores?.nome ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[pet.status_paciente] ?? 'bg-slate-50 text-slate-500'}`}>
                        {pet.status_paciente}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/lab/pacientes/${pet.id}/laudos`}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                        aria-label={`Ver laudos de ${pet.nome}`}
                      >
                        Ver laudos →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
