'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Lock, ShieldAlert, ArrowRight } from 'lucide-react'

/**
 * Gate de acesso exclusivo a veterinários (role = 'vet' | 'admin').
 * Tutores e usuários não autenticados veem uma tela de bloqueio explicativa.
 */
export function VetOnlyGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'blocked-no-auth' | 'blocked-tutor'>('loading')

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('blocked-no-auth'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'vet' || profile?.role === 'admin') {
        setStatus('allowed')
      } else {
        setStatus('blocked-tutor')
      }
    }

    check()
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (status === 'allowed') return <>{children}</>

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
          : 'Esta ferramenta de cálculo clínico é exclusiva para médicos veterinários cadastrados. Crie uma conta veterinária gratuita para ter acesso completo.'
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
              Criar conta veterinária gratuita
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
