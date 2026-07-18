'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isRecoveryCompletionPayload, type RecoveryDestination } from '@/lib/auth-recovery'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

/**
 * Formulário de redefinição de senha.
 * Aceita a sessão PKCE estabelecida pelo callback SSR e, como contingência,
 * observa um evento de recuperação ainda pendente no cliente.
 */
export function ResetForm({ recoveryAuthorized }: { recoveryAuthorized: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [status, setStatus] = useState<'loading-session' | 'idle' | 'loading' | 'done' | 'error' | 'no-session'>(
    recoveryAuthorized ? 'loading-session' : 'no-session',
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [redirectTarget, setRedirectTarget] = useState<RecoveryDestination | '/auth/login'>('/auth/login')
  const submitInFlightRef = useRef(false)
  useEffect(() => {
    if (!recoveryAuthorized) {
      return
    }

    const supabase = createClient()

    let active = true

    async function validateRecoverySession() {
      try {
        // getSession é usado somente no navegador para detectar a sessão PKCE.
        // A autorização de páginas e dados permanece validada no servidor.
        const { data, error } = await supabase.auth.getSession()
        if (!active) return
        if (error) {
          setStatus('no-session')
          return
        }
        setStatus(data.session ? 'idle' : 'no-session')
      } catch {
        if (active) setStatus('no-session')
      }
    }

    void validateRecoverySession()

    return () => {
      active = false
    }
  }, [recoveryAuthorized])

  useEffect(() => {
    if (status !== 'done') return
    const timeout = setTimeout(() => {
      router.replace(redirectTarget)
      router.refresh()
    }, 3000)
    return () => clearTimeout(timeout)
  }, [redirectTarget, router, status])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.reportValidity()) return
    if (password !== confirm) {
      setErrorMsg('As senhas não coincidem.')
      setStatus('error')
      return
    }
    if (password.length < 8) {
      setErrorMsg('A senha deve ter no mínimo 8 caracteres.')
      setStatus('error')
      return
    }
    if (submitInFlightRef.current) return
    submitInFlightRef.current = true

    setStatus('loading')
    setErrorMsg('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setStatus('error')
        setErrorMsg(
          error.code === 'weak_password'
            ? 'A nova senha não atende aos requisitos de segurança.'
            : error.code === 'same_password'
              ? 'Escolha uma senha diferente da atual.'
              : error.code === 'over_request_rate_limit'
                ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
                : error.code === 'session_not_found' || error.code === 'bad_jwt' || error.code === 'otp_expired'
                  ? 'A sessão de recuperação expirou. Solicite um novo link.'
                  : 'Não foi possível atualizar a senha agora. Tente novamente ou solicite um novo link.',
        )
        return
      }

      let destination: RecoveryDestination | '/auth/login' = '/auth/login'
      try {
        const completionResponse = await fetch('/auth/redefinir-senha/concluir', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        const completionPayload: unknown = await completionResponse.json()
        if (completionResponse.ok && isRecoveryCompletionPayload(completionPayload)) {
          destination = completionPayload.redirectTo
        }
      } catch {
        // A senha ja foi atualizada; a conclusao local usa login como fallback seguro.
      }

      setRedirectTarget(destination)
      setStatus('done')
    } catch {
      setStatus('error')
      setErrorMsg('Não foi possível atualizar a senha. Verifique sua conexão e tente novamente.')
    } finally {
      submitInFlightRef.current = false
    }
  }

  if (status === 'loading-session') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500 dark:text-science-200">Verificando link de recuperação...</p>
      </div>
    )
  }

  if (status === 'no-session') {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-sm text-slate-600 dark:text-science-200">
          Link de recuperação inválido ou expirado.
        </p>
        <a
          href="/auth/recuperar-senha"
          className="inline-block text-sm text-brand-600 dark:text-gold-400 font-semibold hover:underline"
        >
          Solicitar novo link
        </a>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Senha atualizada!</h2>
        <p className="text-sm text-slate-500 dark:text-science-200">
          {redirectTarget === '/auth/login'
            ? 'Entre novamente com a nova senha.'
            : 'Redirecionando para o painel...'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Nova senha */}
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
          Nova senha
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-science-400" />
          <input
            id="new-password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={status === 'loading'}
            placeholder="Mínimo 8 caracteres"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                       placeholder:text-slate-400 dark:placeholder:text-science-500 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            disabled={status === 'loading'}
            className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 inline-flex items-center justify-center text-slate-400 dark:text-science-400 hover:text-slate-600 dark:hover:text-white"
            aria-label={showPw ? 'Ocultar campo de senha' : 'Mostrar campo de senha'}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirmação */}
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
          Confirmar nova senha
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-science-400" />
          <input
            id="confirm-password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={status === 'loading'}
            placeholder="Repita a senha"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                       placeholder:text-slate-400 dark:placeholder:text-science-500 transition-all"
          />
        </div>
      </div>

      {status === 'error' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || !password || !confirm}
        className="w-full py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold
                   hover:bg-brand-600 active:scale-[0.98] transition-all duration-150
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Salvando...' : 'Redefinir senha'}
      </button>
    </form>
  )
}
