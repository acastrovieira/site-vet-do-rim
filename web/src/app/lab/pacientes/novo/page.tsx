import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { PacienteForm } from './PacienteForm'
import { isUuid } from '@/lib/identifiers'
import {
  resolveTutorSelection,
  TUTOR_SELECTION_LIMIT,
  type TutorOption,
} from '@/lib/lab/tutor-selection'

export const metadata: Metadata = {
  title: 'Novo Paciente — Lab Evolution',
  description: 'Cadastrar novo paciente renal no Lab Evolution.',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ tutor_id?: string | string[] }>
}

export default async function NovoPacientePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { tutor_id: rawDefaultTutorId } = await searchParams
  const requestedTutorId = isUuid(rawDefaultTutorId) ? rawDefaultTutorId : undefined

  // Carrega um item além do limite seguro para detectar truncamento e falhar fechado.
  const tutorListQuery = supabase
    .from('tutores')
    .select('id, nome')
    .order('nome', { ascending: true })
    .order('id', { ascending: true })
    .limit(TUTOR_SELECTION_LIMIT + 1)
  const selectedTutorQuery = requestedTutorId
    ? supabase
      .from('tutores')
      .select('id, nome')
      .eq('id', requestedTutorId)
      .maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [rawTutorListResult, rawSelectedTutorResult] = await Promise.all([
    tutorListQuery,
    selectedTutorQuery,
  ])
  const { data: tutorRows, error: tutorsListError } = rawTutorListResult as {
    data: TutorOption[] | null
    error: Error | null
  }
  const { data: selectedTutor, error: selectedTutorError } = rawSelectedTutorResult as {
    data: TutorOption | null
    error: Error | null
  }

  const selection = resolveTutorSelection(tutorRows ?? [], requestedTutorId, selectedTutor)
  const {
    safeDefaultTutorId,
    selectionRequiresTutorFlow,
    tutores,
  } = selection
  const tutoresError = tutorsListError ?? (
    requestedTutorId && !safeDefaultTutorId ? selectedTutorError : null
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={safeDefaultTutorId ? `/lab/tutores/${safeDefaultTutorId}` : '/lab/pacientes'}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          aria-label="Voltar"
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

      {user && tutoresError && (
        <div className="px-4 py-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-sm" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">Não foi possível carregar os tutores</p>
              <p className="mt-1">O cadastro permanece bloqueado para evitar associar o paciente ao tutor errado.</p>
              <Link href="/lab/pacientes/novo" className="mt-3 inline-flex items-center gap-2 font-semibold underline">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Tentar novamente
              </Link>
            </div>
          </div>
        </div>
      )}

      {user && !tutoresError && selectionRequiresTutorFlow && (
        <div className="px-4 py-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-sm" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">Selecione o tutor antes de cadastrar o paciente</p>
              <p className="mt-1">
                Há mais de 200 tutores cadastrados. Para evitar uma associação incorreta, localize o tutor na lista pesquisável e use a ação de adicionar paciente no perfil dele.
              </p>
              <Link href="/lab/tutores" className="mt-3 inline-flex font-semibold underline">
                Localizar tutor
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Formulário — erros/sucesso via Toast */}
      {user && !tutoresError && !selectionRequiresTutorFlow && (
        <PacienteForm tutores={tutores ?? []} defaultTutorId={safeDefaultTutorId} />
      )}
    </div>
  )
}
