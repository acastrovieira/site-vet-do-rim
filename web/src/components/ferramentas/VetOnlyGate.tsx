'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Lock, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type GateStatus = 'loading' | 'allowed' | 'blocked-no-auth' | 'blocked-tutor' | 'error'
const ACCESS_CHECK_TIMEOUT_MS = 8_000

/**
 * Gate de acesso exclusivo a veterinários (role = 'vet' | 'admin').
 * Tutores e usuários não autenticados veem uma tela de bloqueio explicativa.
 */
export function VetOnlyGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GateStatus>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      if (!cancelled) setStatus('error')
    }, ACCESS_CHECK_TIMEOUT_MS)

    async function check() {
      try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (cancelled || timedOut) return
        if (authError) throw authError
        if (!user) {
          setStatus('blocked-no-auth')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled || timedOut) return
        if (profileError || !profile) throw profileError ?? new Error('Profile not found')

        if (profile.role === 'vet' || profile.role === 'admin') {
          setStatus('allowed')
        } else {
          setStatus('blocked-tutor')
        }
      } catch {
        if (!cancelled && !timedOut) setStatus('error')
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void check()
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [attempt])

  if (status === 'loading') {
    return (
      <div className="min-h-[400px] flex items-center justify-center" role="status" aria-live="polite">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" aria-hidden />
        <span className="sr-only">Validando acesso profissional…</span>
      </div>
    )
  }

  if (status === 'allowed') return <>{children}</>

  if (status === 'error') {
    return (
      <div className="rounded-3xl border border-amber-200 bg-white shadow-xl shadow-slate-200/40 p-8 text-center max-w-lg mx-auto" role="alert">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 mx-auto mb-6">
          <ShieldAlert className="h-8 w-8 text-amber-600" aria-hidden />
        </div>
        <h2 className="font-display font-bold text-xl text-slate-900 mb-3">
          Não foi possível validar seu acesso
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          A ferramenta permanece bloqueada por segurança. Verifique sua conexão e tente novamente.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              setStatus('loading')
              setAttempt((current) => current + 1)
            }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Tentar novamente
          </button>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            Entrar novamente
          </Link>
        </div>
      </div>
    )
  }

  // Blocked states
  const isTutor = status === 'blocked-tutor'

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 p-10 text-center max-w-lg mx-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-6">
        {isTutor
          ? <ShieldAlert className="h-8 w-8 text-brand-600" aria-hidden />
          : <Lock className="h-8 w-8 text-brand-600" aria-hidden />
        }
      </div>

      <h2 className="font-display font-bold text-xl text-slate-900 mb-3">
        {isTutor ? 'Área exclusiva para veterinários' : 'Acesso restrito a profissionais'}
      </h2>

      <p className="text-slate-500 text-sm leading-relaxed mb-6">
        {isTutor
          ? 'Esta ferramenta de cálculo clínico destina-se exclusivamente a médicos veterinários. Ela envolve informações técnicas e dosagens que devem ser interpretadas e aplicadas por um profissional habilitado. Consulte o veterinário responsável pelo seu pet.'
          : 'Esta ferramenta de cálculo clínico é exclusiva para médicos veterinários verificados. O auto cadastro profissional permanece indisponível até a implantação do processo seguro de aprovação.'
        }
      </p>

      <div className="flex flex-col gap-3">
        {isTutor ? (
          <Link
            href="/portal"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            Ir para o Portal do Tutor
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <>
            <Link
              href="/auth/cadastro"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
            >
              Ver situação do acesso profissional
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              Já tenho conta — entrar
            </Link>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Informação médica veterinária · Uso profissional exclusivo
      </p>
    </div>
  )
}
