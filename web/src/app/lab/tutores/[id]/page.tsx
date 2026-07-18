import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  assertServerQuerySucceeded,
  throwServerQueryFailure,
} from '@/lib/server-query-safety'
import { TutorPetActions } from './TutorPetActions'
import { ListPagination } from '@/components/lab/ListPagination'
import { isUuid } from '@/lib/identifiers'
import { listPageRange, parseListPage } from '@/lib/list-pagination'
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  PawPrint,
  User,
  Plus,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Detalhe do Tutor — Lab Evolution',
  robots: { index: false, follow: false },
}

const ESPECIE_EMOJI: Record<string, string> = {
  canino: '🐶', felino: '🐱', equino: '🐴',
  bovino: '🐮', suino: '🐷', ave: '🐦',
  roedor: '🐭', reptil: '🦎', outro: '🐾',
}

const PAGE_SIZE = 24

export default async function TutorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ page?: string | string[] }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const queryParams = await searchParams
  const page = parseListPage(queryParams?.page, PAGE_SIZE)
  const { firstRow, lastRow } = listPageRange(page, PAGE_SIZE)
  const supabase = await createClient()

  type TutorRow = {
    id: string; nome: string; email: string | null; telefone: string
    cidade: string | null; estado: string | null; endereco: string | null
    cep: string | null; criado_em: string
  }

  const { data: tutor, error: tutorError } = await supabase
    .from('tutores')
    .select('id, nome, email, telefone, cidade, estado, endereco, cep, criado_em')
    .eq('id', id)
    .maybeSingle() as { data: TutorRow | null; error: unknown }

  assertServerQuerySucceeded(tutorError, 'TUTOR_DETAIL_QUERY_FAILED')
  if (!tutor) notFound()

  type PetRow = {
    id: string; nome: string; especie: string; raca: string | null
    idade_anos: number | null; status_paciente: string; peso_atual: number | null
  }

  const { data: pets, error: petsError, count: petsCount } = await supabase
    .from('pets')
    .select('id, nome, especie, raca, idade_anos, status_paciente, peso_atual', { count: 'exact' })
    .eq('tutor_id', id)
    .neq('status_paciente', 'inativo')
    .order('criado_em', { ascending: false })
    .order('id', { ascending: false })
    .range(firstRow, lastRow) as {
      data: PetRow[] | null
      error: unknown
      count: number | null
    }
  assertServerQuerySucceeded(petsError, 'TUTOR_PETS_QUERY_FAILED')
  if (petsCount === null) throwServerQueryFailure('TUTOR_PETS_COUNT_MISSING')

  const petsVivos = pets ?? []
  const totalPets = petsCount
  const totalPages = Math.max(1, Math.ceil(totalPets / PAGE_SIZE))
  if (totalPets > 0 && page > totalPages) {
    redirect(`/lab/tutores/${id}?page=${totalPages}`)
  }

  return (
    <div className="space-y-6">
      {/* Voltar */}
      <Link
        href="/lab/tutores"
        className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-science-200 hover:text-slate-800 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para tutores
      </Link>

      {/* Header do tutor */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-xl font-bold shrink-0">
            {tutor.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="break-words font-display text-2xl font-bold text-slate-900 dark:text-white">{tutor.nome}</h1>
            <p className="text-xs text-slate-400 dark:text-science-400 mt-0.5">
              Cadastrado em {new Date(tutor.criado_em).toLocaleDateString('pt-BR')}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tutor.telefone && (
                <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-science-200">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  {tutor.telefone}
                </div>
              )}
              {tutor.email && (
                <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-science-200">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="break-all">{tutor.email}</span>
                </div>
              )}
              {(tutor.cidade || tutor.estado) && (
                <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-science-200">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  {[tutor.cidade, tutor.estado].filter(Boolean).join(', ')}
                </div>
              )}
              {tutor.endereco && (
                <div className="flex min-w-0 items-start gap-2 text-sm text-slate-600 dark:text-science-200">
                  <User className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="break-words">{tutor.endereco}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pets */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-brand-500" strokeWidth={2} />
            Pets ({totalPets})
          </h2>
          <Link
            href={`/lab/pacientes/novo?tutor_id=${id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo pet
          </Link>
        </div>

        {petsVivos.length === 0 ? (
          <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-10 text-center text-slate-400 dark:text-science-400">
            <PawPrint className="h-10 w-10 mx-auto mb-3 opacity-20" strokeWidth={1.5} />
            <p className="font-medium text-slate-500 dark:text-science-200">Nenhum pet cadastrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {petsVivos.map((pet) => (
              <article
                key={pet.id}
                className={`bg-white dark:bg-white/5 rounded-2xl border p-5 transition-all ${
                  pet.status_paciente === 'obito'
                    ? 'border-slate-200 dark:border-white/10 opacity-60'
                    : 'border-slate-100 dark:border-white/10 hover:border-brand-200 dark:hover:border-gold-400/30 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl" role="img" aria-label={pet.especie}>
                    {ESPECIE_EMOJI[pet.especie] ?? '🐾'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="break-words font-display font-bold text-slate-900 dark:text-white">{pet.nome}</p>
                    <p className="text-xs text-slate-400 dark:text-science-400 capitalize">
                      {pet.especie}{pet.raca ? ` · ${pet.raca}` : ''}{pet.idade_anos ? ` · ${pet.idade_anos} anos` : ''}
                    </p>
                    {pet.peso_atual && (
                      <p className="text-xs text-slate-500 dark:text-science-200 mt-0.5">{pet.peso_atual} kg</p>
                    )}
                  </div>
                </div>

                <TutorPetActions pet={pet} />
              </article>
            ))}
          </div>
        )}
        <div className="mt-4">
          <ListPagination
            basePath={`/lab/tutores/${id}`}
            currentPage={page}
            pageSize={PAGE_SIZE}
            totalItems={totalPets}
          />
        </div>
      </div>
    </div>
  )
}
