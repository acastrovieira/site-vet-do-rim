'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PawPrint, User, Scale, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const especies = [
  { value: 'canino', label: 'Canino (Cão)' },
  { value: 'felino', label: 'Felino (Gato)' },
  { value: 'equino', label: 'Equino (Cavalo)' },
  { value: 'bovino', label: 'Bovino (Boi/Vaca)' },
  { value: 'suino', label: 'Suíno (Porco)' },
  { value: 'ave', label: 'Ave' },
  { value: 'roedor', label: 'Roedor' },
  { value: 'reptil', label: 'Réptil' },
  { value: 'outro', label: 'Outro' },
]

const statusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'em_tratamento', label: 'Em tratamento' },
  { value: 'alta', label: 'Alta' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'obito', label: 'Óbito' },
]

interface Props {
  tutores: Array<{ id: string; nome: string }>
  defaultTutorId?: string
}

/**
 * Formulário de criação de paciente — Client Component.
 * Usa fetch para /api/pets + useToast para feedback visual.
 */
export function PacienteForm({ tutores, defaultTutorId }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const temTutores = tutores.length > 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const fd = new FormData(e.currentTarget)
    const nome = (fd.get('nome') as string)?.trim()
    const tutor_id = (fd.get('tutor_id') as string)?.trim()
    const especie = (fd.get('especie') as string)?.trim()

    if (!nome || !tutor_id || !especie) {
      toast({
        type: 'warning',
        title: 'Campos obrigatórios',
        message: 'Preencha o nome do animal, espécie e selecione um tutor.',
      })
      return
    }

    const idadeAnosRaw = fd.get('idade_anos') as string
    const idadeMesesRaw = fd.get('idade_meses') as string
    const pesoRaw = fd.get('peso_atual') as string

    startTransition(async () => {
      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          tutor_id,
          especie,
          raca: (fd.get('raca') as string)?.trim() || null,
          idade_anos: idadeAnosRaw ? Number(idadeAnosRaw) : null,
          idade_meses: idadeMesesRaw ? Number(idadeMesesRaw) : null,
          peso_atual: pesoRaw ? Number(pesoRaw) : null,
          status_paciente: (fd.get('status_paciente') as string) || 'ativo',
        }),
      })

      const result = await res.json() as {
        ok: boolean
        id?: string
        error?: string
        code?: string
        hint?: string
      }

      if (!result.ok || !result.id) {
        const isRLS = result.code === 'RLS_DENIED'
        toast({
          type: 'error',
          title: isRLS ? 'Sem permissão de acesso (RLS)' : 'Erro ao salvar paciente',
          message: isRLS
            ? `Política de segurança bloqueou o cadastro. Acesse o Supabase Dashboard → Policies → pets e adicione política INSERT para usuários autenticados.${result.hint ? ` Dica: ${result.hint}` : ''}`
            : result.error ?? 'Erro desconhecido. Verifique sua conexão e tente novamente.',
        })
        return
      }

      toast({
        type: 'success',
        title: 'Paciente salvo!',
        message: `${nome} foi cadastrado com sucesso.`,
      })

      router.push(`/lab/pacientes/${result.id}/laudos`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Dados do paciente */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <PawPrint className="h-4 w-4 text-brand-500" aria-hidden />
          <h2 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-wider">
            Dados do paciente
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label htmlFor="nome" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Nome do animal <span className="text-red-500">*</span>
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              placeholder="Ex: Thor, Luna, Mia…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="especie" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Espécie <span className="text-red-500">*</span>
            </label>
            <select
              id="especie"
              name="especie"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            >
              <option value="">Selecione…</option>
              {especies.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="raca" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Raça
            </label>
            <input
              id="raca"
              name="raca"
              type="text"
              placeholder="Ex: Golden Retriever, SRD…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="status_paciente" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Status clínico
            </label>
            <select
              id="status_paciente"
              name="status_paciente"
              defaultValue="ativo"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            >
              {statusOptions.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tutor responsável */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-brand-500" aria-hidden />
          <h2 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-wider">
            Tutor responsável
          </h2>
        </div>

        <div>
          <label htmlFor="tutor_id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Tutor <span className="text-red-500">*</span>
          </label>
          {temTutores ? (
            <select
              id="tutor_id"
              name="tutor_id"
              required
              defaultValue={defaultTutorId ?? ''}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            >
              <option value="">Selecione o tutor…</option>
              {tutores.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          ) : (
            <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-sm text-amber-800 dark:text-amber-300">
              Nenhum tutor cadastrado.{' '}
              <Link href="/lab/tutores/novo" className="font-semibold underline hover:no-underline">
                Cadastre um tutor primeiro
              </Link>{' '}
              e volte aqui.
            </div>
          )}
        </div>
      </div>

      {/* Dados físicos */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-4 w-4 text-brand-500" aria-hidden />
          <h2 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-wider">
            Dados físicos <span className="text-slate-400 font-normal normal-case">(opcional)</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label htmlFor="idade_anos" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Idade (anos)
            </label>
            <input
              id="idade_anos"
              name="idade_anos"
              type="number"
              min={0}
              max={30}
              step={1}
              placeholder="0"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="idade_meses" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Idade (meses)
            </label>
            <input
              id="idade_meses"
              name="idade_meses"
              type="number"
              min={0}
              max={11}
              step={1}
              placeholder="0"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="peso_atual" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Peso (kg)
            </label>
            <input
              id="peso_atual"
              name="peso_atual"
              type="number"
              min={0}
              step={0.1}
              placeholder="0.0"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-3 pb-2">
        <Link
          href="/lab/pacientes"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          id="btn-salvar-paciente"
          disabled={!temTutores || isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            'Salvar paciente'
          )}
        </button>
      </div>
    </form>
  )
}
