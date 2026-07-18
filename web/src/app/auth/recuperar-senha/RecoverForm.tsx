'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

/**
 * Formulário de recuperação de senha.
 * Chama supabase.auth.resetPasswordForEmail() com redirectTo apontando
 * para o callback PKCE. O SDK preserva o tipo `recovery` junto ao verificador.
 */
export function RecoverForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const submitInFlightRef = useRef(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.reportValidity()) return
    if (!email.trim()) return
    if (submitInFlightRef.current) return
    submitInFlightRef.current = true

    setStatus('loading')
    setErrorMsg('')

    const supabase = createClient()
    const redirectTo = new URL('/auth/callback', window.location.origin).toString()

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      if (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[RecoverForm] resetPasswordForEmail failed', {
            code: error.code ?? 'unknown',
          })
        }
        setStatus('error')
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          setErrorMsg('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
        } else if (error.message?.includes('redirect')) {
          setErrorMsg('Não foi possível concluir a recuperação. Contate o suporte.')
        } else {
          setErrorMsg('Não foi possível processar a solicitação agora. Tente novamente em instantes.')
        }
      } else {
        setStatus('sent')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Não foi possível processar a solicitação agora. Verifique sua conexão e tente novamente.')
    } finally {
      submitInFlightRef.current = false
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">E-mail enviado!</h2>
        <p className="text-sm text-slate-500 dark:text-science-200 max-w-xs">
          Verifique sua caixa de entrada em <strong className="break-all">{email}</strong> e clique no link para
          redefinir sua senha.
        </p>
        <p className="text-xs text-slate-400 dark:text-science-400 mt-2">
          Não recebeu?{' '}
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="text-brand-600 dark:text-gold-400 font-semibold hover:underline"
          >
            Tentar novamente
          </button>
        </p>
        <Link
          href="/auth/login"
          className="mt-2 text-sm text-slate-500 dark:text-science-200 hover:text-slate-700 dark:hover:text-white flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="recover-email" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
          E-mail cadastrado
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-science-400" />
          <input
            id="recover-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
            placeholder="seu@email.com"
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
        disabled={status === 'loading' || !email.trim()}
        className="w-full py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold
                   hover:bg-brand-600 active:scale-[0.98] transition-all duration-150
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Enviando...' : 'Enviar link de recuperação'}
      </button>

      <div className="text-center">
        <Link
          href="/auth/login"
          className="text-sm text-slate-500 dark:text-science-200 hover:text-slate-700 dark:hover:text-white flex items-center justify-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao login
        </Link>
      </div>
    </form>
  )
}
