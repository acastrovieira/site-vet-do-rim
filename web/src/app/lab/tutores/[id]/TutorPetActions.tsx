'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Heart, Trash2, AlertTriangle, X, CalendarDays, Copy, CheckCircle } from 'lucide-react'

interface Pet {
  id: string
  nome: string
  especie: string
  raca: string | null
  status_paciente: string
}

interface TutorPetActionsProps {
  pet: Pet
  tutorNome: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
  em_tratamento: { label: 'Em tratamento', color: 'bg-blue-100 text-blue-700' },
  alta: { label: 'Alta', color: 'bg-emerald-100 text-emerald-700' },
  obito: { label: 'Óbito', color: 'bg-slate-200 text-slate-500' },
  inativo: { label: 'Inativo', color: 'bg-slate-100 text-slate-400' },
}

/** Gera a mensagem de condolências personalizada */
function gerarMensagemCondolencias(tutorNome: string, petNome: string): string {
  return `Querido(a) ${tutorNome},

Gostaríamos de expressar nossa mais sincera condolência pela partida de ${petNome}. 💙

Sabemos que ele(a) era muito mais do que um pet — era parte da sua família, seu companheiro fiel em tantos momentos. A perda de um ser tão especial deixa uma saudade que palavras raramente conseguem conter.

Ficamos honrados por ter cuidado de ${petNome} e por ter feito parte dessa jornada ao seu lado. Que a lembrança de todo o amor que vocês compartilharam seja um conforto neste momento tão difícil.

Com carinho e empatia,
Equipe Vet do Rim 🌷`
}

/**
 * Ações de um pet: registrar óbito ou excluir.
 * Exibe modais de confirmação com cuidado e empatia.
 */
export function TutorPetActions({ pet, tutorNome }: TutorPetActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [obitModal, setObitModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [dataObito, setDataObito] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [copied, setCopied] = useState(false)

  const mensagemCondolencias = gerarMensagemCondolencias(tutorNome, pet.nome)
  const statusInfo = STATUS_LABELS[pet.status_paciente] ?? { label: pet.status_paciente, color: 'bg-slate-100 text-slate-500' }
  const isObito = pet.status_paciente === 'obito'

  async function handleRegistrarObito() {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('pets')
        .update({
          status_paciente: 'obito',
          data_obito: dataObito || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pet.id)

      if (!error) {
        // Suprime follow-ups ativos do pet
        const { data: triagens } = await supabase
          .from('triagens')
          .select('id')
          .eq('pet_id', pet.id)

        if (triagens && triagens.length > 0) {
          const triagemIds = triagens.map((t: { id: string }) => t.id)
          await supabase
            .from('follow_ups')
            .update({ opt_out: true })
            .in('triagem_id', triagemIds)
        }
      }
      setObitModal(false)
      router.refresh()
    })
  }

  async function handleExcluirPet() {
    startTransition(async () => {
      const supabase = createClient()
      await supabase
        .from('pets')
        .update({
          status_paciente: 'inativo',
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pet.id)
      setDeleteModal(false)
      router.refresh()
    })
  }

  function handleCopiarMensagem() {
    navigator.clipboard.writeText(mensagemCondolencias).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
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
              onClick={() => setObitModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              aria-label={`Registrar óbito de ${pet.nome}`}
            >
              <Heart className="h-3.5 w-3.5" aria-hidden />
              Registrar óbito
            </button>
            <button
              type="button"
              onClick={() => setDeleteModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
              aria-label={`Excluir ${pet.nome}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Excluir
            </button>
          </>
        )}
      </div>

      {/* ── Modal de Óbito ── */}
      {obitModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal aria-labelledby="obito-modal-title">
          <div className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8">
            <button
              onClick={() => setObitModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-50 mb-4">
                <Heart className="h-7 w-7 text-brand-500" strokeWidth={1.5} />
              </div>
              <h2 id="obito-modal-title" className="font-display text-xl font-bold text-slate-900 mb-2">
                Registrar Óbito — {pet.nome}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Lamentamos profundamente a perda de {pet.nome}. Ao registrar o óbito, o sistema
                pausará automaticamente todos os envios de follow-ups, lembretes e propagandas
                para este tutor referentes a este paciente.
              </p>
            </div>

            {/* Data do óbito */}
            <div className="mb-5">
              <label htmlFor="data-obito" className="block text-sm font-medium text-slate-700 mb-1.5">
                Data do óbito <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="data-obito"
                  type="date"
                  value={dataObito}
                  onChange={(e) => setDataObito(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* Mensagem de condolências */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">
                  Mensagem de condolências sugerida
                </p>
                <button
                  type="button"
                  onClick={handleCopiarMensagem}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                >
                  {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-line max-h-44 overflow-y-auto">
                {mensagemCondolencias}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Copie e envie esta mensagem manualmente para o tutor via WhatsApp ou e-mail.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setObitModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegistrarObito}
                disabled={isPending}
                className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Registrando...' : 'Confirmar óbito'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Exclusão ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal aria-labelledby="delete-modal-title">
          <div className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8">
            <button
              onClick={() => setDeleteModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-red-50 mb-4">
                <AlertTriangle className="h-7 w-7 text-red-500" strokeWidth={1.5} />
              </div>
              <h2 id="delete-modal-title" className="font-display text-xl font-bold text-slate-900 mb-2">
                Excluir {pet.nome}?
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                O registro de <strong>{pet.nome}</strong> será marcado como inativo e não aparecerá
                mais nas listagens. O histórico clínico será preservado para fins de auditoria.
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                Digite <strong>{pet.nome}</strong> para confirmar
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={pet.nome}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDeleteModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExcluirPet}
                disabled={isPending || deleteConfirm !== pet.nome}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Excluindo...' : 'Excluir pet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
