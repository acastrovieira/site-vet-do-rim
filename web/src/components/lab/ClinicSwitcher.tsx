'use client'

import { Building2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { resolvePostClinicSwitchPath } from '@/lib/active-clinic-cookie'
import { requestJsonMutation } from '@/lib/client-mutation'
import type { ActiveClinicOption } from '@/lib/server-clinic-context'

interface ClinicSwitcherProps {
  clinics: readonly ActiveClinicOption[]
  activeClinicId: string | null
  onSwitched?: () => void
}

/**
 * Exibe a clinica ativa na barra lateral e permite troca explicita quando o
 * profissional possui multiplos vinculos ativos em `clinic_memberships`.
 */
export function ClinicSwitcher({
  clinics,
  activeClinicId,
  onSwitched,
}: ClinicSwitcherProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSwitching, setIsSwitching] = useState(false)
  const [optimisticClinicId, setOptimisticClinicId] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const switchInFlightRef = useRef(false)

  if (clinics.length === 0) return null

  const activeClinic = clinics.find((clinic) => clinic.clinicId === activeClinicId) ?? clinics[0]

  if (clinics.length === 1) {
    return (
      <div className="px-3 pt-3">
        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-science-300">
            <Building2 className="h-3 w-3 shrink-0 text-gold-400" aria-hidden />
            <span>Clínica ativa</span>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-white">
            {activeClinic.clinicName}
          </p>
        </div>
      </div>
    )
  }

  const isBusy = isSwitching || isPending
  const selectValue = isBusy && optimisticClinicId ? optimisticClinicId : activeClinic.clinicId

  async function handleClinicChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextClinicId = event.target.value
    if (!nextClinicId || nextClinicId === activeClinic.clinicId || switchInFlightRef.current) return

    switchInFlightRef.current = true
    setSwitchError(null)
    setOptimisticClinicId(nextClinicId)
    setIsSwitching(true)

    try {
      const result = await requestJsonMutation(
        '/api/lab/active-clinic',
        { clinic_id: nextClinicId },
        { method: 'POST' },
      )

      if (!result.ok) {
        setOptimisticClinicId(null)
        setSwitchError(
          result.code === 'UNAUTHENTICATED'
            ? 'Sessão expirada. Entre novamente.'
            : 'Não foi possível trocar a clínica ativa. Tente novamente.',
        )
        return
      }

      const nextPath = resolvePostClinicSwitchPath(pathname)
      startTransition(() => {
        onSwitched?.()
        if (nextPath) {
          router.replace(nextPath)
        }
        router.refresh()
      })
    } finally {
      setIsSwitching(false)
      switchInFlightRef.current = false
    }
  }

  return (
    <div className="px-3 pt-3">
      <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] px-3 py-2">
        <label
          htmlFor="active-clinic-select"
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-science-300"
        >
          <Building2 className="h-3 w-3 shrink-0 text-gold-400" aria-hidden />
          <span>Clínica ativa</span>
        </label>
        <select
          id="active-clinic-select"
          aria-label="Clínica ativa"
          value={selectValue}
          onChange={handleClinicChange}
          disabled={isBusy}
          className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-400 disabled:opacity-60"
        >
          {clinics.map((clinic) => (
            <option key={clinic.clinicId} value={clinic.clinicId}>
              {clinic.clinicName}
            </option>
          ))}
        </select>
        {switchError && (
          <p role="alert" className="mt-1.5 text-[11px] leading-4 text-red-600 dark:text-red-400">
            {switchError}
          </p>
        )}
      </div>
    </div>
  )
}
