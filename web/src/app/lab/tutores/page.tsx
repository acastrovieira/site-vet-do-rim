import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, Plus, Phone, Mail, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Tutores — Lab Evolution',
  description: 'Lista de tutores de pacientes renais cadastrados no Lab Evolution.',
  robots: { index: false, follow: false },
}

export default async function TutoresPage() {
  const supabase = await createClient()

  type TutorRow = {
    id: string
    nome: string
    email: string | null
    telefone: string
    cidade: string | null
    estado: string | null
    criado_em: string
  }

  const { data: tutores, error } = await supabase
    .from('tutores')
    .select('id, nome, email, telefone, cidade, estado, criado_em')
    .order('criado_em', { ascending: false })
    .limit(50) as { data: TutorRow[] | null; error: Error | null }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Tutores</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Tutores de pacientes renais cadastrados · Lab Evolution
          </p>
        </div>
        <Link
          href="/lab/tutores/novo"
          id="btn-novo-tutor"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          aria-label="Cadastrar novo tutor"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Novo tutor
        </Link>
      </div>

      {/* Grid de tutores */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {error || !tutores || tutores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Users className="h-12 w-12 mb-4 opacity-30" strokeWidth={1.5} />
            <p className="font-semibold text-slate-500">Nenhum tutor cadastrado</p>
            <p className="text-sm mt-1">Os tutores dos seus pacientes aparecerão aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Lista de tutores">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tutor</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Contato</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Localização</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Cadastrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tutores.map((tutor) => (
                  <tr key={tutor.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                    <td className="px-5 py-4">
                      <Link href={`/lab/tutores/${tutor.id}`} className="flex items-center gap-3 w-full">
                        <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {tutor.nome.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">{tutor.nome}</p>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-brand-400 ml-auto transition-colors" aria-hidden />
                      </Link>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <div className="space-y-0.5">
                        {tutor.telefone && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                            <Phone className="h-3 w-3 text-slate-400" aria-hidden />
                            {tutor.telefone}
                          </div>
                        )}
                        {tutor.email && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                            <Mail className="h-3 w-3 text-slate-400" aria-hidden />
                            {tutor.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs hidden md:table-cell">
                      {tutor.cidade && tutor.estado
                        ? `${tutor.cidade}, ${tutor.estado}`
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs hidden lg:table-cell">
                      {new Date(tutor.criado_em).toLocaleDateString('pt-BR')}
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
