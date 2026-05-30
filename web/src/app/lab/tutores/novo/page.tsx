import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { ArrowLeft, User, Phone, Mail, MapPin, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Novo Tutor — Lab Evolution',
  description: 'Cadastrar novo tutor de paciente renal.',
  robots: { index: false, follow: false },
}

/**
 * Server Action para criação de tutor.
 * Redireciona para a página do tutor criado, ou para o formulário com ?error=1 em caso de falha.
 */
async function criarTutor(formData: FormData) {
  'use server'

  const supabase = await createClient()

  // Valida sessão ativa
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const nome = (formData.get('nome') as string)?.trim()
  const telefone = (formData.get('telefone') as string)?.trim()
  const email = (formData.get('email') as string)?.trim() || null
  const cpf = (formData.get('cpf') as string)?.trim() || null
  const cep = (formData.get('cep') as string)?.trim() || null
  const endereco = (formData.get('endereco') as string)?.trim() || null
  const cidade = (formData.get('cidade') as string)?.trim() || null
  const estado = (formData.get('estado') as string)?.trim() || null

  if (!nome || !telefone) {
    redirect('/lab/tutores/novo?error=campos_obrigatorios')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('tutores')
    .insert({
      nome,
      telefone,
      email: email ?? null,
      cpf: cpf ?? null,
      cep: cep ?? null,
      endereco: endereco ?? null,
      cidade: cidade ?? null,
      estado: estado ?? null,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string; details: string } | null }

  if (error || !data) {
    console.error('[criarTutor] Supabase error:', error?.message, error?.details)
    redirect('/lab/tutores/novo?error=salvar_falhou')
  }

  redirect(`/lab/tutores/${data.id}`)
}

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NovoTutorPage({ searchParams }: PageProps) {
  const params = await searchParams
  const errorMsg =
    params.error === 'campos_obrigatorios'
      ? 'Preencha o nome completo e o telefone antes de salvar.'
      : params.error === 'salvar_falhou'
        ? 'Não foi possível salvar o tutor. Verifique sua conexão e tente novamente.'
        : null

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
      <form action={criarTutor} className="space-y-6">
        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-brand-500" aria-hidden />
            <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">
              Dados pessoais
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label htmlFor="nome" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                autoComplete="name"
                placeholder="Ex: Ana Paula Ferreira"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-slate-700 mb-1.5">
                CPF
              </label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                autoComplete="off"
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="h-4 w-4 text-brand-500" aria-hidden />
            <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">
              Contato
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="telefone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Telefone / WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                id="telefone"
                name="telefone"
                type="tel"
                required
                autoComplete="tel"
                placeholder="(27) 99999-9999"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tutor@email.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-brand-500" aria-hidden />
            <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">
              Endereço <span className="text-slate-400 font-normal normal-case">(opcional)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="sm:col-span-2">
              <label htmlFor="endereco" className="block text-sm font-medium text-slate-700 mb-1.5">
                Logradouro
              </label>
              <input
                id="endereco"
                name="endereco"
                type="text"
                autoComplete="street-address"
                placeholder="Rua, Avenida…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="cep" className="block text-sm font-medium text-slate-700 mb-1.5">
                CEP
              </label>
              <input
                id="cep"
                name="cep"
                type="text"
                autoComplete="postal-code"
                placeholder="29000-000"
                maxLength={9}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="cidade" className="block text-sm font-medium text-slate-700 mb-1.5">
                Cidade
              </label>
              <input
                id="cidade"
                name="cidade"
                type="text"
                autoComplete="address-level2"
                placeholder="Cidade"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="estado" className="block text-sm font-medium text-slate-700 mb-1.5">
                Estado (UF)
              </label>
              <select
                id="estado"
                name="estado"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all bg-white"
              >
                <option value="">Selecione…</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 pb-2">
          <Link
            href="/lab/tutores"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            id="btn-salvar-tutor"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          >
            Salvar tutor
          </button>
        </div>
      </form>
    </div>
  )
}
