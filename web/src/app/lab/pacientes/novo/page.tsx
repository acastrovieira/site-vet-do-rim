import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { ArrowLeft, PawPrint, User, Scale, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Novo Paciente — Lab Evolution',
  description: 'Cadastrar novo paciente renal no Lab Evolution.',
  robots: { index: false, follow: false },
}

/**
 * Server Action para criação de paciente.
 * Redireciona para laudos do paciente criado, ou para o formulário com ?error em caso de falha.
 */
async function criarPaciente(formData: FormData) {
  'use server'

  const supabase = await createClient()

  // Valida sessão ativa
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const nome = (formData.get('nome') as string)?.trim()
  const tutor_id = (formData.get('tutor_id') as string)?.trim()
  const especie = (formData.get('especie') as string)?.trim()
  const raca = (formData.get('raca') as string)?.trim() || null
  const idade_anos = formData.get('idade_anos') ? Number(formData.get('idade_anos')) : null
  const idade_meses = formData.get('idade_meses') ? Number(formData.get('idade_meses')) : null
  const peso_atual = formData.get('peso_atual') ? Number(formData.get('peso_atual')) : null
  const status_paciente = (formData.get('status_paciente') as string) || 'ativo'

  if (!nome || !tutor_id || !especie) {
    redirect('/lab/pacientes/novo?error=campos_obrigatorios')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('pets')
    .insert({
      nome,
      tutor_id,
      especie,
      raca: raca ?? null,
      idade_anos: idade_anos ?? null,
      idade_meses: idade_meses ?? null,
      peso_atual: peso_atual ?? null,
      status_paciente,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string; details: string } | null }

  if (error || !data) {
    console.error('[criarPaciente] Supabase error:', error?.message, error?.details)
    redirect('/lab/pacientes/novo?error=salvar_falhou')
  }

  redirect(`/lab/pacientes/${data.id}/laudos`)
}

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NovoPacientePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams

  const errorMsg =
    params.error === 'campos_obrigatorios'
      ? 'Preencha o nome do animal, a espécie e selecione um tutor.'
      : params.error === 'salvar_falhou'
        ? 'Não foi possível salvar o paciente. Verifique sua conexão e tente novamente.'
        : null

  const { data: tutores } = await supabase
    .from('tutores')
    .select('id, nome')
    .order('nome', { ascending: true })
    .limit(200) as { data: Array<{ id: string; nome: string }> | null }

  const especies = [
    { value: 'canino', label: 'Canino (Cão)' },
    { value: 'felino', label: 'Felino (Gato)' },
    { value: 'equino', label: 'Equino (Cavalo)' },
    { value: 'bovino', label: 'Bovino (Boi/Vaca)' },
    { value: 'suino', label: 'Suíno (Porco)' },
    { value: 'ave', label: 'Ave' },
    { value: 'roedor', label: 'Roedor' },
    { value: 'reptil', label: 'Réptil' },
    { value: 'outro', label: 'Outro' },
  ]

  const statusOptions = [
    { value: 'ativo', label: 'Ativo' },
    { value: 'em_tratamento', label: 'Em tratamento' },
    { value: 'alta', label: 'Alta' },
    { value: 'inativo', label: 'Inativo' },
    { value: 'obito', label: 'Óbito' },
  ]

  const temTutores = tutores && tutores.length > 0

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

      {/* Feedback de erro */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Formulário */}
      <form action={criarPaciente} className="space-y-6">
        {/* Dados do paciente */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <PawPrint className="h-4 w-4 text-brand-500" aria-hidden />
            <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">
              Dados do paciente
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label htmlFor="nome" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nome do animal <span className="text-red-500">*</span>
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                placeholder="Ex: Thor, Luna, Mia…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="especie" className="block text-sm font-medium text-slate-700 mb-1.5">
                Espécie <span className="text-red-500">*</span>
              </label>
              <select
                id="especie"
                name="especie"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all bg-white"
              >
                <option value="">Selecione…</option>
                {especies.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="raca" className="block text-sm font-medium text-slate-700 mb-1.5">
                Raça
              </label>
              <input
                id="raca"
                name="raca"
                type="text"
                placeholder="Ex: Golden Retriever, SRD…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="status_paciente" className="block text-sm font-medium text-slate-700 mb-1.5">
                Status clínico
              </label>
              <select
                id="status_paciente"
                name="status_paciente"
                defaultValue="ativo"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all bg-white"
              >
                {statusOptions.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tutor responsável */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-brand-500" aria-hidden />
            <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">
              Tutor responsável
            </h2>
          </div>

          <div>
            <label htmlFor="tutor_id" className="block text-sm font-medium text-slate-700 mb-1.5">
              Tutor <span className="text-red-500">*</span>
            </label>
            {temTutores ? (
              <select
                id="tutor_id"
                name="tutor_id"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all bg-white"
              >
                <option value="">Selecione o tutor…</option>
                {tutores!.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                Nenhum tutor cadastrado.{' '}
                <Link href="/lab/tutores/novo" className="font-semibold underline hover:no-underline">
                  Cadastre um tutor primeiro
                </Link>{' '}
                e volte aqui.
              </div>
            )}
          </div>
        </div>

        {/* Dados físicos */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-4 w-4 text-brand-500" aria-hidden />
            <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">
              Dados físicos <span className="text-slate-400 font-normal normal-case">(opcional)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label htmlFor="idade_anos" className="block text-sm font-medium text-slate-700 mb-1.5">
                Idade (anos)
              </label>
              <input
                id="idade_anos"
                name="idade_anos"
                type="number"
                min={0}
                max={30}
                step={1}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="idade_meses" className="block text-sm font-medium text-slate-700 mb-1.5">
                Idade (meses)
              </label>
              <input
                id="idade_meses"
                name="idade_meses"
                type="number"
                min={0}
                max={11}
                step={1}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="peso_atual" className="block text-sm font-medium text-slate-700 mb-1.5">
                Peso (kg)
              </label>
              <input
                id="peso_atual"
                name="peso_atual"
                type="number"
                min={0}
                step={0.1}
                placeholder="0.0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 pb-2">
          <Link
            href="/lab/pacientes"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            id="btn-salvar-paciente"
            disabled={!temTutores}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Salvar paciente
          </button>
        </div>
      </form>
    </div>
  )
}
