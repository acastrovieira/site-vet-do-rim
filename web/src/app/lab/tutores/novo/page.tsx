import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, User, Phone, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react'
import { TutorForm } from './TutorForm'

export const metadata: Metadata = {
  title: 'Novo Tutor — Lab Evolution',
  description: 'Cadastrar novo tutor de paciente renal.',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ error?: string; ok?: string }>
}

export default async function NovoTutorPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams

  // Valida se usuário está logado (SSR)
  const { data: { user } } = await supabase.auth.getUser()

  const errorMsg =
    params.error === 'campos_obrigatorios'
      ? 'Preencha o nome completo e o telefone antes de salvar.'
      : params.error === 'salvar_falhou'
        ? 'Não foi possível salvar o tutor. Tente novamente.'
        : params.error === 'sem_permissao'
          ? 'Sem permissão para inserir dados. Contacte o administrador (RLS).'
          : params.error
            ? `Erro ao salvar: ${params.error}`
            : null

  const successMsg = params.ok === '1' ? 'Tutor salvo com sucesso!' : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/lab/tutores"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Voltar para tutores"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Novo tutor</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Cadastre o responsável pelo paciente</p>
        </div>
      </div>

      {/* Feedback */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <p>{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Info usuário para debug */}
      {!user && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Sessão expirada. <Link href="/auth/login" className="font-semibold underline">Faça login novamente</Link>.
        </div>
      )}

      {/* Formulário Client Component com feedback completo */}
      <TutorForm />
    </div>
  )
}
