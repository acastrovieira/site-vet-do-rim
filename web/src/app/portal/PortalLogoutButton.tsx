'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function PortalLogoutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const logoutInFlightRef = useRef(false)

  function handleLogout() {
    if (logoutInFlightRef.current) return
    logoutInFlightRef.current = true
    setError(null)

    startTransition(async () => {
      try {
        const supabase = createClient()
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) {
          setError('Não foi possível encerrar a sessão. Tente novamente.')
          return
        }
        router.replace('/auth/login')
        router.refresh()
      } catch {
        setError('Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente.')
      } finally {
        logoutInFlightRef.current = false
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {isPending ? 'Saindo…' : 'Sair'}
      </button>
      {error && <p role="alert" className="max-w-56 text-right text-xs text-red-600">{error}</p>}
    </div>
  )
}
