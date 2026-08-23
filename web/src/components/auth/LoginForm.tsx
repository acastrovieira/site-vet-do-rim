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

function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}

/**
 * Formulário de login com Supabase Auth (Email + Google OAuth).
 * Redireciona para /lab ou rota solicitada após autenticação bem-sucedida.
 */
export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, setIsGooglePending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitInFlightRef = useRef(false)

  async function handleGoogleLogin() {
    if (isPending || isGooglePending) return
    setError(null)
    setIsGooglePending(true)

    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const nextParam = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''
      const callbackUrl = `${origin}/auth/callback${nextParam}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })

      if (error) {
        setError('Não foi possível conectar com o Google. Tente novamente.')
        setIsGooglePending(false)
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Google OAuth error:', err)
      }
      setError('Erro ao iniciar login com Google. Verifique sua conexão.')
      setIsGooglePending(false)
    }
  }

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

  const isAnyLoading = isPending || isGooglePending

  return (
    <div className="space-y-5">
      {/* Botão Google Login */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isAnyLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-white font-medium text-sm hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed group"
      >
        {isGooglePending ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden />
        ) : (
          <GoogleIcon className="h-5 w-5 group-hover:scale-105 transition-transform duration-200" />
        )}
        <span>{isGooglePending ? 'Conectando ao Google...' : 'Entrar com o Google'}</span>
      </button>

      {/* Divisor "ou continue com email" */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-slate-200 dark:border-white/10 w-full" />
        <span className="bg-white dark:bg-[#0A0A0C] px-3 text-xs font-medium text-slate-400 uppercase tracking-wider shrink-0">
          ou com e-mail
        </span>
      </div>

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
            disabled={isAnyLoading}
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
              disabled={isAnyLoading}
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
          disabled={isAnyLoading}
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
              Entrar com e-mail
            </>
          )}
        </button>
      </form>
    </div>
  )
}

