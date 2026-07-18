import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { TutorForm } from './TutorForm'

export const metadata: Metadata = {
  title: 'Novo Tutor — Lab Evolution',
  description: 'Cadastrar novo tutor de paciente renal.',
  robots: { index: false, follow: false },
}

export default async function NovoTutorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/lab/tutores"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          aria-label="Voltar para tutores"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Novo tutor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-sm">
            Cadastre o responsável pelo paciente
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
      {user && <TutorForm />}
    </div>
  )
}
