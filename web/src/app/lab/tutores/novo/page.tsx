import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, User, Phone, Mail, MapPin } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Novo Tutor — Lab Evolution',
  description: 'Cadastrar novo tutor de paciente renal.',
  robots: { index: false, follow: false },
}

async function criarTutor(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const nome = formData.get('nome') as string
  const telefone = formData.get('telefone') as string
  const email = (formData.get('email') as string) || null
  const cpf = (formData.get('cpf') as string) || null
  const cep = (formData.get('cep') as string) || null
  const endereco = (formData.get('endereco') as string) || null
  const numero = (formData.get('numero') as string) || null
  const complemento = (formData.get('complemento') as string) || null
  const bairro = (formData.get('bairro') as string) || null
  const cidade = (formData.get('cidade') as string) || null
  const estado = (formData.get('estado') as string) || null

  if (!nome?.trim() || !telefone?.trim()) {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('tutores')
    .insert({
      id: crypto.randomUUID(),
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email?.trim() || null,
      cpf: cpf?.trim() || null,
      cep: cep?.trim() || null,
      endereco: endereco?.trim() || null,
      numero: numero?.trim() || null,
      complemento: complemento?.trim() || null,
      bairro: bairro?.trim() || null,
      cidade: cidade?.trim() || null,
      estado: estado?.trim() || null,
      atualizado_em: new Date().toISOString(),
    })
    .select('id')
    .single() as { data: { id: string } | null; error: Error | null }

  if (error || !data) {
    return
  }

  redirect(`/lab/tutores/${data.id}`)
}

export default function NovoTutorPage() {
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
              <label htmlFor="numero" className="block text-sm font-medium text-slate-700 mb-1.5">
                Número
              </label>
              <input
                id="numero"
                name="numero"
                type="text"
                placeholder="123"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="complemento" className="block text-sm font-medium text-slate-700 mb-1.5">
                Complemento
              </label>
              <input
                id="complemento"
                name="complemento"
                type="text"
                placeholder="Apto, bloco…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="bairro" className="block text-sm font-medium text-slate-700 mb-1.5">
                Bairro
              </label>
              <input
                id="bairro"
                name="bairro"
                type="text"
                placeholder="Bairro"
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

            <div>
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
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm disabled:opacity-60"
          >
            Salvar tutor
          </button>
        </div>
      </form>
    </div>
  )
}
