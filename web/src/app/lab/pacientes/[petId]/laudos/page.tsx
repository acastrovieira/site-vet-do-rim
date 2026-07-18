import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LaudoUploader } from '@/components/lab/LaudoUploader'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import {
  assertServerQuerySucceeded,
  throwServerQueryFailure,
} from '@/lib/server-query-safety'
import { ListPagination } from '@/components/lab/ListPagination'
import { isUuid } from '@/lib/identifiers'
import { listPageRange, parseListPage } from '@/lib/list-pagination'

interface Props {
  params: Promise<{ petId: string }>
  searchParams?: Promise<{ page?: string | string[] }>
}

const PAGE_SIZE = 25

const LAUDO_STATUS: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Aguardando análise', color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-science-100' },
  processando: { label: 'Processando', color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  concluido: { label: 'Concluído', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  erro: { label: 'Falha', color: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
}

export function generateMetadata(): Metadata {
  return {
    title: `Laudos do Paciente — Lab Evolution`,
    description: 'Envio e análise de laudos veterinários no Lab Evolution.',
    robots: { index: false, follow: false },
  }
}

export default async function LaudosPacientePage({ params, searchParams }: Props) {
  const { petId } = await params
  if (!isUuid(petId)) notFound()
  const queryParams = await searchParams
  const page = parseListPage(queryParams?.page, PAGE_SIZE)
  const { firstRow, lastRow } = listPageRange(page, PAGE_SIZE)
  const supabase = await createClient()

  type PetRow = { id: string; nome: string; especie: string; raca: string | null }

  // Busca dados do pet para exibir nome
  const { data: pet, error: petError } = await supabase
    .from('pets')
    .select('id, nome, especie, raca')
    .eq('id', petId)
    .maybeSingle() as { data: PetRow | null; error: unknown }

  assertServerQuerySucceeded(petError, 'PATIENT_LAUDOS_QUERY_FAILED')
  if (!pet) notFound()

  type LaudoRow = {
    id: string
    nome_arquivo: string
    tipo_exame: string
    status: string
    created_at: string
  }

  const { data: laudos, error: laudosError, count } = await supabase
    .from('laudos_pdf')
    .select('id, nome_arquivo, tipo_exame, status, created_at', { count: 'exact' })
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(firstRow, lastRow) as {
      data: LaudoRow[] | null
      error: unknown
      count: number | null
    }
  assertServerQuerySucceeded(laudosError, 'PATIENT_REPORT_HISTORY_QUERY_FAILED')
  if (count === null) throwServerQueryFailure('PATIENT_REPORT_HISTORY_COUNT_MISSING')

  const totalItems = count
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  if (totalItems > 0 && page > totalPages) {
    redirect(`/lab/pacientes/${petId}/laudos?page=${totalPages}`)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/lab/pacientes"
          className="flex shrink-0 items-center gap-1.5 text-sm text-slate-500 dark:text-science-200 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Pacientes
        </Link>
        <span className="shrink-0 text-slate-300 dark:text-science-700">/</span>
        <span className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-science-100">{pet.nome}</span>
        <span className="shrink-0 text-slate-300 dark:text-science-700">/</span>
        <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">Laudos</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Laudos — {pet.nome}
        </h1>
        <p className="text-sm text-slate-500 dark:text-science-200 mt-1">
          {pet.especie}{pet.raca ? ` · ${pet.raca}` : ''} · Análise de hemograma e bioquímica por IA
        </p>
      </div>

      {/* Uploader com visualização side-by-side */}
      <LaudoUploader petId={petId} />

      <section className="space-y-4" aria-labelledby="report-history-heading">
        <div>
          <h2 id="report-history-heading" className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Histórico de laudos
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-science-200">
            Todos os registros do paciente, organizados do mais recente para o mais antigo.
          </p>
        </div>

        {!laudos || laudos.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center dark:border-white/10 dark:bg-white/5">
            <FileText className="mx-auto mb-3 h-9 w-9 text-slate-300 dark:text-science-700" aria-hidden />
            <p className="text-sm font-medium text-slate-600 dark:text-science-100">Nenhum laudo registrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {laudos.map((laudo) => {
              const status = LAUDO_STATUS[laudo.status] ?? LAUDO_STATUS.pendente
              return (
                <article key={laudo.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400 dark:text-science-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{laudo.nome_arquivo}</p>
                    <p className="text-xs text-slate-400 dark:text-science-400">
                      {laudo.tipo_exame} · {new Date(laudo.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.color}`}>
                    {status.label}
                  </span>
                </article>
              )
            })}
          </div>
        )}

        <ListPagination
          basePath={`/lab/pacientes/${petId}/laudos`}
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
        />
      </section>
    </div>
  )
}
