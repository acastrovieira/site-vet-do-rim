'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, UserPlus, CheckCircle2 } from 'lucide-react'

/**
 * Formulário de cadastro com Supabase Auth.
 * Cria conta e perfil com role (vet | tutor).
 */
export function CadastroForm() {
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string
    const fullName = form.get('full_name') as string
    const requestedRole = form.get('role') === 'vet' ? 'vet' : 'tutor'

    startTransition(async () => {
      try {
        const supabase = createClient()

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, requested_role: requestedRole },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(
          error.message.includes('already registered')
            ? 'Este email já está cadastrado. Faça login.'
            : error.message
        )
        return
      }

        setSuccess(true)
      } catch {
        setError('Nao foi possivel criar a conta agora. Verifique sua conexao e tente novamente.')
      }
    })
  }

  if (success) {
    return (
      <div className="text-center py-4" role="status">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h2 className="font-display font-bold text-slate-900 text-lg mb-2">
          Conta criada com sucesso!
        </h2>
        <p className="text-sm text-slate-500">
          Enviamos um link de confirmação para o seu email. Verifique a caixa de entrada (e o spam).
          {' '}
          Solicitacoes de acesso veterinario dependem de aprovacao administrativa.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Nome completo */}
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1.5">
          Nome completo
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          disabled={isPending}
          placeholder="Dr. Nome Sobrenome"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-60"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          placeholder="seu@email.com"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-60"
        />
      </div>

      {/* Perfil */}
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1.5">
          Perfil de acesso
        </label>
        <select
          id="role"
          name="role"
          required
          disabled={isPending}
          defaultValue=""
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-60 bg-white"
        >
          <option value="" disabled>Selecione seu perfil…</option>
          <option value="vet">Médico(a) Veterinário(a)</option>
          <option value="tutor">Tutor de paciente</option>
        </select>
      </div>

      {/* Senha */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            disabled={isPending}
            placeholder="Mínimo 8 caracteres"
            className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={showPassword ? 'Ocultar campo de senha' : 'Mostrar campo de senha'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div role="alert" className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          <span className="shrink-0 mt-0.5">⚠️</span>
          {error}
        </div>
      )}

      {/* LGPD */}
      <p className="text-xs text-slate-400 leading-relaxed">
        Ao criar conta, você concorda com nossos{' '}
        <a href="/legal/termos" className="text-brand-600 hover:underline">Termos de Uso</a>{' '}
        e{' '}
        <a href="/legal/privacidade" className="text-brand-600 hover:underline">Política de Privacidade</a>
        , em conformidade com a LGPD.
      </p>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-all duration-200 shadow-sm hover:shadow-brand-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Criando conta...
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" aria-hidden />
            Criar conta
          </>
        )}
      </button>
    </form>
  )
}
