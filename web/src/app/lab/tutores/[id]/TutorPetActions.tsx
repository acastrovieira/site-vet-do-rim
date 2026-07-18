'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Archive, AlertTriangle, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useAccessibleDialog } from '@/hooks/useAccessibleDialog'
import {
  getMutationErrorCopy,
  isMutationOutcomeAmbiguous,
  requestJsonMutation,
} from '@/lib/client-mutation'

interface Pet {
  id: string
  nome: string
  especie: string
  raca: string | null
  status_paciente: string
}

interface TutorPetActionsProps {
  pet: Pet
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
  em_tratamento: { label: 'Em tratamento', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  alta: { label: 'Alta', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  obito: { label: 'Óbito', color: 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-science-200' },
  inativo: { label: 'Inativo', color: 'bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-science-400' },
}

/**
 * Ações de um pet. O registro de óbito permanece contido até existir
 * uma RPC transacional e auditável para o pet e seus acompanhamentos.
 */
export function TutorPetActions({ pet }: TutorPetActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [mutationLocked, setMutationLocked] = useState(false)
  const [requiresVerification, setRequiresVerification] = useState(false)
  const mutationInFlightRef = useRef(false)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const deleteDialogRef = useAccessibleDialog({
    open: deleteModal,
    onClose: () => setDeleteModal(false),
    closeDisabled: isPending || mutationLocked,
    initialFocusRef: deleteCancelRef,
  })

  const statusInfo = STATUS_LABELS[pet.status_paciente] ?? { label: pet.status_paciente, color: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-science-200' }
  const isObito = pet.status_paciente === 'obito'

  async function handleExcluirPet() {
    if (mutationInFlightRef.current) return
    mutationInFlightRef.current = true
    setMutationLocked(true)
    startTransition(async () => {
      let releaseMutation = true
      try {
        const result = await requestJsonMutation(
          `/api/pets/${pet.id}`,
          { status_paciente: 'inativo' },
          { method: 'PATCH' },
        )

        if (!result.ok || !result.id) {
          if (isMutationOutcomeAmbiguous(result) || result.code === 'STATE_CONFLICT') {
            releaseMutation = false
            setRequiresVerification(true)
            router.refresh()
          }
          const copy = result.code === 'STATE_CONFLICT'
            ? {
                title: 'Situação do paciente alterada',
                message: 'Outra operação modificou este paciente. Atualize a tela e confirme o estado antes de agir novamente.',
              }
            : getMutationErrorCopy(result, 'paciente')
          toast({
            type: 'error',
            ...copy,
          })
          return
        }

        releaseMutation = false

        toast({
          type: 'success',
          title: 'Paciente inativado',
          message: `${pet.nome} não aparecerá mais nas listagens ativas.`,
        })
        setDeleteModal(false)
        router.refresh()
      } finally {
        if (releaseMutation) {
          mutationInFlightRef.current = false
          setMutationLocked(false)
        }
      }
    })
  }

  return (
    <>
      {/* Inline status + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        {!isObito && (
          <>
            <button
              type="button"
              onClick={() => toast({
                type: 'info',
                title: 'Registro de óbito em revisão',
                message: 'Esta ação está temporariamente bloqueada até que paciente e acompanhamentos sejam atualizados em uma única transação auditável.',
              })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-amber-200 px-3 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
              aria-label={`Registro de óbito de ${pet.nome} temporariamente indisponível`}
            >
              <Heart className="h-3.5 w-3.5" aria-hidden />
              Óbito em revisão
            </button>
            <button
              type="button"
              onClick={() => setDeleteModal(true)}
              disabled={mutationLocked || isPending}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-100 px-3 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
              aria-label={`Inativar ${pet.nome}`}
            >
              <Archive className="h-3.5 w-3.5" aria-hidden />
              Inativar
            </button>
          </>
        )}
      </div>

      {/* ── Modal de inativação ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            ref={deleteDialogRef}
            className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-white dark:bg-[#0F2244] border border-transparent dark:border-white/10 p-5 shadow-2xl sm:rounded-3xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-description"
            aria-busy={isPending}
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={() => setDeleteModal(false)}
              disabled={isPending || mutationLocked}
              className="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-science-400 dark:hover:bg-white/5 dark:hover:text-white sm:right-5 sm:top-5"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-500/10 mb-4">
                <AlertTriangle className="h-7 w-7 text-red-500" strokeWidth={1.5} />
              </div>
              <h2 id="delete-modal-title" className="break-words font-display text-xl font-bold text-slate-900 [overflow-wrap:anywhere] dark:text-white mb-2">
                Inativar {pet.nome}?
              </h2>
              <p id="delete-modal-description" className="break-words text-sm text-slate-500 [overflow-wrap:anywhere] dark:text-science-200 leading-relaxed">
                O registro de <strong>{pet.nome}</strong> será marcado como inativo e não aparecerá
                mais nas listagens. O histórico clínico será preservado para fins de auditoria.
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
                Digite <strong>{pet.nome}</strong> para confirmar
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                disabled={isPending || mutationLocked}
                placeholder={pet.nome}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
              />
            </div>

            {requiresVerification && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              >
                Não foi possível confirmar o resultado. Confira o estado atual do paciente antes de iniciar outra operação.
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="mt-2 block min-h-11 font-semibold underline hover:no-underline"
                >
                  Atualizar situação
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                ref={deleteCancelRef}
                type="button"
                onClick={() => setDeleteModal(false)}
                disabled={isPending || mutationLocked}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-science-100 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExcluirPet}
                disabled={isPending || mutationLocked || deleteConfirm !== pet.nome}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Inativando...' : requiresVerification ? 'Confira a situação' : 'Inativar paciente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
