'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

/**
 * Formulário de redefinição de senha.
 * Usa onAuthStateChange para capturar o evento PASSWORD_RECOVERY
 * que chega via fragmento #access_token na URL (PKCE flow do Supabase Auth v2).
 */
export function ResetForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [status, setStatus] = useState<'loading-session' | 'idle' | 'loading' | 'done' | 'error' | 'no-session'>('loading-session')
  const [errorMsg, setErrorMsg] = useState('')
  const sessionChecked = useRef(false)

  useEffect(() => {
    if (sessionChecked.current) return
    sessionChecked.current = true

    const supabase = createClient()

    // Tenta primeiro verificar sessão já existente (ex: refresh de página)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus('idle')
        return
      }
      // Aguarda evento de recovery (link do e-mail ainda não processado)
      // O Supabase processa o #access_token do fragmento da URL automaticamente
      const { data: listener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setStatus('idle')
          listener.subscription.unsubscribe()
        }
      })

      // Timeout de segurança: se após 5s nenhum evento chegar, link é inválido
      const timeout = setTimeout(() => {
        supabase.auth.getSession().then(({ data: d }) => {
          if (d.session) {
            setStatus('idle')
          } else {
            setStatus('no-session')
          }
        })
        listener.subscription.unsubscribe()
      }, 5000)

      return () => {
        clearTimeout(timeout)
        listener.subscription.unsubscribe()
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

    setStatus('loading')
    setErrorMsg('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setErrorMsg('Erro ao atualizar senha. O link pode ter expirado — solicite um novo.')
    } else {
      setStatus('done')
      setTimeout(() => router.push('/lab'), 3000)
    }
  }

  if (status === 'loading-session') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Verificando link de recuperação...</p>
      </div>
    )
  }

  if (status === 'no-session') {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-sm text-slate-600">
          Link de recuperação inválido ou expirado.
        </p>
        <a
          href="/auth/recuperar-senha"
          className="inline-block text-sm text-brand-600 font-semibold hover:underline"
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
        <h2 className="font-display text-xl font-bold text-slate-900">Senha atualizada!</h2>
        <p className="text-sm text-slate-500">Redirecionando para o painel...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Nova senha */}
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1.5">
          Nova senha
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="new-password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                       placeholder:text-slate-400 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showPw ? 'Ocultar campo de senha' : 'Mostrar campo de senha'}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirmação */}
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1.5">
          Confirmar nova senha
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="confirm-password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
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
