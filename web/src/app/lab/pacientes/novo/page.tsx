import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { PacienteForm } from './PacienteForm'

export const metadata: Metadata = {
  title: 'Novo Paciente — Lab Evolution',
  description: 'Cadastrar novo paciente renal no Lab Evolution.',
  robots: { index: false, follow: false },
}

export default async function NovoPacientePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Carrega lista de tutores no server para popular o select
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tutores } = await (supabase as any)
    .from('tutores')
    .select('id, nome')
    .order('nome', { ascending: true })
    .limit(200) as { data: Array<{ id: string; nome: string }> | null }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/lab/pacientes"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          aria-label="Voltar para pacientes"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Novo paciente
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-sm">
            Cadastre o animal para acompanhamento renal
          </p>
        </div>
      </div>

      {/* Sessão expirada */}
      {!user && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-sm">
          Sessão expirada.{' '}
          <Link href="/auth/login" className="font-semibold underline">
            Faça login novamente
          </Link>
          .
        </div>
      )}

      {/* Formulário — erros/sucesso via Toast */}
      <PacienteForm tutores={tutores ?? []} />
    </div>
  )
}
