'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

/**
 * Formulário de recuperação de senha.
 * Chama supabase.auth.resetPasswordForEmail() com redirectTo apontando
 * para /auth/callback?next=/auth/redefinir-senha.
 */
export function RecoverForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    setErrorMsg('')

    const supabase = createClient()
    // redirectTo deve ser exatamente a URL cadastrada no Supabase Redirect URLs.
    // O Supabase adiciona automaticamente ?code=...&type=recovery ao final.
    // O /auth/callback detecta type=recovery e redireciona para /auth/redefinir-senha.
    const redirectTo = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })

    if (error) {
      console.error('[RecoverForm] resetPasswordForEmail error:', error)
      setStatus('error')
      // Mensagens amigáveis por código de erro Supabase
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        setErrorMsg('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
      } else if (error.message?.includes('not found') || error.message?.includes('invalid')) {
        setErrorMsg('E-mail não encontrado. Verifique o endereço e tente novamente.')
      } else if (error.message?.includes('redirect')) {
        setErrorMsg('Erro de configuração de redirecionamento. Contate o suporte.')
      } else {
        setErrorMsg(`Erro ao enviar: ${error.message ?? 'Tente novamente em instantes.'}`)
      }
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h2 className="font-display text-xl font-bold text-slate-900">E-mail enviado!</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para
          redefinir sua senha.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Não recebeu?{' '}
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="text-brand-600 font-semibold hover:underline"
          >
            Tentar novamente
          </button>
        </p>
        <Link
          href="/auth/login"
          className="mt-2 text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
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
        <label htmlFor="recover-email" className="block text-sm font-medium text-slate-700 mb-1.5">
          E-mail cadastrado
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="recover-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                       placeholder:text-slate-400 transition-all"
          />
        </div>
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
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
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao login
        </Link>
      </div>
    </form>
  )
}
