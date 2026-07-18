'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, UserPlus, CheckCircle2 } from 'lucide-react'

/**
 * Formulário de cadastro com Supabase Auth.
 * O auto cadastro cria somente conta de tutor. Acesso profissional exige um
 * workflow administrativo auditado que ainda não está disponível.
 */
export function CadastroForm() {
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const submitInFlightRef = useRef(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formElement = e.currentTarget
    if (!formElement.reportValidity()) return

    const form = new FormData(formElement)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const fullName = String(form.get('full_name') ?? '').trim()
    const roleValue = form.get('role')

    if (!email || !fullName || password.length < 8 || roleValue !== 'tutor') {
      setError('Preencha todos os campos e use uma senha com pelo menos 8 caracteres.')
      return
    }

    if (submitInFlightRef.current) return
    submitInFlightRef.current = true

    startTransition(async () => {
      try {
        const supabase = createClient()

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) {
          setError('Não foi possível concluir o cadastro agora. Revise os dados ou tente novamente em instantes.')
          return
        }

        setSuccess(true)
      } catch {
        setError('Não foi possível criar a conta agora. Verifique sua conexão e tente novamente.')
      } finally {
        submitInFlightRef.current = false
      }
    })
  }

  if (success) {
    return (
      <div className="text-center py-4" role="status">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h2 className="font-display font-bold text-slate-900 dark:text-white text-lg mb-2">
          Conta criada com sucesso!
        </h2>
        <p className="text-sm text-slate-500 dark:text-science-200">
          Sua conta de tutor foi criada. Se a confirmação de e-mail estiver
          habilitada neste ambiente, siga o link recebido antes de entrar.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Nome completo */}
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
          Nome completo
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          maxLength={120}
          disabled={isPending}
            placeholder="Nome e sobrenome"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-science-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-60"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={isPending}
          placeholder="seu@email.com"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-science-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-60"
        />
      </div>

      {/* Perfil */}
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
          Perfil de acesso
        </label>
        <select
          id="role"
          name="role"
          required
          disabled={isPending}
          defaultValue=""
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-60 bg-white dark:bg-[#111827]"
        >
          <option value="" disabled>Selecione seu perfil…</option>
          <option value="vet" disabled>Médico(a) Veterinário(a) — acesso em implantação</option>
          <option value="tutor">Tutor de paciente</option>
        </select>
        <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          O auto cadastro profissional está temporariamente indisponível até a
          implantação do processo de verificação e aprovação auditável.
        </p>
      </div>

      {/* Senha */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
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
            maxLength={128}
            disabled={isPending}
            placeholder="Mínimo 8 caracteres"
            className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-science-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:text-science-400 dark:hover:text-white transition-colors"
            aria-label={showPassword ? 'Ocultar campo de senha' : 'Mostrar campo de senha'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div role="alert" className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-sm text-red-700 dark:text-red-300">
          <span className="shrink-0 mt-0.5">⚠️</span>
          {error}
        </div>
      )}

      {/* LGPD */}
      <p className="text-xs text-slate-400 dark:text-science-300 leading-relaxed">
        Ao criar conta, você concorda com nossos{' '}
        <a href="/legal/termos" className="text-brand-600 dark:text-gold-400 hover:underline">Termos de Uso</a>{' '}
        e{' '}
        <a href="/legal/privacidade" className="text-brand-600 dark:text-gold-400 hover:underline">Política de Privacidade</a>
        . Leia os documentos antes de continuar.
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
