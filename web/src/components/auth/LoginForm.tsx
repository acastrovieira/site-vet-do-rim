'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import {
  isRoleAuthorizedForRedirect,
  parseAppRole,
  roleHome,
  safeInternalRedirectPath,
} from '@/lib/route-authorization'

type AuthProfile = {
  role: string | null
}

interface LoginFormProps {
  redirectTo?: string
}

/**
 * Formulário de login com Supabase Auth.
 * Redireciona para /lab após autenticação bem-sucedida.
 */
export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitInFlightRef = useRef(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formElement = e.currentTarget
    if (!formElement.reportValidity()) return

    const form = new FormData(formElement)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (!email || !password) {
      setError('Preencha o e-mail e a senha para continuar.')
      return
    }
    if (submitInFlightRef.current) return
    submitInFlightRef.current = true

    startTransition(async () => {
      try {
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
          setError(
            error.code === 'invalid_credentials' || error.message === 'Invalid login credentials'
              ? 'E-mail ou senha incorretos. Tente novamente.'
              : error.code === 'email_not_confirmed'
                ? 'Confirme seu e-mail antes de entrar.'
                : error.code === 'over_request_rate_limit'
                  ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
                  : 'Não foi possível entrar agora. Tente novamente em instantes.'
          )
          return
        }

        const desiredPath = safeInternalRedirectPath(redirectTo)
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          await supabase.auth.signOut()
          setError('Não foi possível validar a sessão. Entre novamente.')
          return
        }

        const { data: rawProfile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        const profile = rawProfile as AuthProfile | null
        const role = parseAppRole(profile?.role)

        if (profileError || !role) {
          await supabase.auth.signOut()
          setError('Seu perfil de acesso não pôde ser validado. Contate o suporte.')
          return
        }

        const destination = desiredPath && isRoleAuthorizedForRedirect(desiredPath, role)
          ? desiredPath
          : roleHome(role)

        router.push(destination)
        router.refresh()
      } catch (loginError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Login flow failed', {
            type: loginError instanceof Error ? loginError.name : 'UnknownError',
          })
        }
        setError('Não foi possível concluir o login agora. Verifique sua conexão e tente novamente.')
      } finally {
        submitInFlightRef.current = false
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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

      {/* Senha */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-science-100">
            Senha
          </label>
          <a
            href="/auth/recuperar-senha"
            className="text-xs text-brand-600 dark:text-gold-400 hover:underline font-medium"
          >
            Esqueceu a senha?
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            maxLength={128}
            disabled={isPending}
            placeholder="••••••••"
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
        <div
          role="alert"
          className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-sm text-red-700 dark:text-red-300"
        >
          <span className="shrink-0 mt-0.5">⚠️</span>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-all duration-200 shadow-sm hover:shadow-brand-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Entrando...
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden />
            Entrar
          </>
        )}
      </button>
    </form>
  )
}
