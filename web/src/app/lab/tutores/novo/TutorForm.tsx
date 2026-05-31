'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Phone, Mail, MapPin, AlertCircle, Loader2 } from 'lucide-react'

async function salvarTutor(formData: {
  nome: string
  telefone: string
  email: string | null
  cpf: string | null
  cep: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
}) {
  const res = await fetch('/api/tutores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  })
  return res.json() as Promise<{ ok: boolean; id?: string; error?: string; code?: string }>
}

/**
 * Formulário de criação de tutor — Client Component.
 * Usa fetch para a API Route ao invés de Server Action,
 * garantindo controle completo do estado e feedback de erro visível.
 */
export function TutorForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const nome = (fd.get('nome') as string)?.trim()
    const telefone = (fd.get('telefone') as string)?.trim()

    if (!nome || !telefone) {
      setError('Preencha o nome completo e o telefone antes de salvar.')
      return
    }

    startTransition(async () => {
      const result = await salvarTutor({
        nome,
        telefone,
        email: (fd.get('email') as string)?.trim() || null,
        cpf: (fd.get('cpf') as string)?.trim() || null,
        cep: (fd.get('cep') as string)?.trim() || null,
        endereco: (fd.get('endereco') as string)?.trim() || null,
        cidade: (fd.get('cidade') as string)?.trim() || null,
        estado: (fd.get('estado') as string)?.trim() || null,
      })

      if (!result.ok || !result.id) {
        // Exibe o erro real do Supabase para diagnóstico
        const msg = result.code === 'RLS_DENIED'
          ? 'Sem permissão para salvar. Verifique as políticas RLS no Supabase.'
          : result.error
            ? `Erro: ${result.error}`
            : 'Não foi possível salvar o tutor. Tente novamente.'
        setError(msg)
        return
      }

      router.push(`/lab/tutores/${result.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Feedback de erro com mensagem real */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <p className="break-words">{error}</p>
        </div>
      )}

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
          disabled={isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            'Salvar tutor'
          )}
        </button>
      </div>
    </form>
  )
}
