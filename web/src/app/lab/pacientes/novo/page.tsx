import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { PacienteForm } from './PacienteForm'

export const metadata: Metadata = {
  title: 'Novo Paciente — Lab Evolution',
  description: 'Cadastrar novo paciente renal no Lab Evolution.',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NovoPacientePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()

  // Carrega lista de tutores no server (sem expor ao client desnecessariamente)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tutores } = await (supabase as any)
    .from('tutores')
    .select('id, nome')
    .order('nome', { ascending: true })
    .limit(200) as { data: Array<{ id: string; nome: string }> | null }

  const errorMsg = params.error
    ? `Erro ao carregar: ${params.error}`
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/lab/pacientes"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Voltar para pacientes"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Novo paciente</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Cadastre o animal para acompanhamento renal</p>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <p>{errorMsg}</p>
        </div>
      )}

      {!user && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Sessão expirada. <Link href="/auth/login" className="font-semibold underline">Faça login novamente</Link>.
        </div>
      )}

      <PacienteForm tutores={tutores ?? []} />
    </div>
  )
}
