import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FlaskConical, Plus, Search, AlertTriangle, RefreshCw } from 'lucide-react'
import { redirect } from 'next/navigation'
import { ListPagination } from '@/components/lab/ListPagination'
import { listPageRange, parseListPage } from '@/lib/list-pagination'

export const metadata: Metadata = {
  title: 'Pacientes — Lab Evolution',
  description: 'Lista de pacientes renais cadastrados no Lab Evolution.',
  robots: { index: false, follow: false },
}

const PAGE_SIZE = 25

interface PacientesPageProps {
  searchParams?: Promise<{ q?: string | string[]; page?: string | string[] }>
}

function normalizedQuery(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  return (raw ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s.'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function patientsHref(page: number, query: string) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (page > 1) params.set('page', String(page))
  const search = params.toString()
  return search ? `/lab/pacientes?${search}` : '/lab/pacientes'
}

export default async function PacientesPage({ searchParams }: PacientesPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const query = normalizedQuery(params?.q)
  const page = parseListPage(params?.page, PAGE_SIZE)
  const { firstRow, lastRow } = listPageRange(page, PAGE_SIZE)

  let petsQuery = supabase
    .from('pets')
    .select('id, nome, especie, raca, status_paciente, criado_em, tutores(nome)', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .order('id', { ascending: false })
    .range(firstRow, lastRow)

  if (query) petsQuery = petsQuery.ilike('nome', `%${query}%`)

  const { data: pets, error, count } = await petsQuery as {
      data: Array<{
        id: string
        nome: string
        especie: string
        raca: string | null
        status_paciente: string
        criado_em: string
        tutores: { nome: string } | null
      }> | null
      error: Error | null
      count: number | null
    }

  const hasQueryError = Boolean(error) || count === null
  const totalItems = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  if (!hasQueryError && totalItems > 0 && page > totalPages) {
    redirect(patientsHref(totalPages, query))
  }

  const statusColors: Record<string, string> = {
    ativo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    em_tratamento: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    alta: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    inativo: 'bg-slate-50 text-slate-500 dark:bg-white/10 dark:text-science-300',
    obito: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Pacientes</h1>
          <p className="text-slate-500 dark:text-science-200 mt-1 text-sm">
            Pacientes renais cadastrados · Lab Evolution
          </p>
        </div>
        <Link
          href="/lab/pacientes/novo"
          id="btn-novo-paciente"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          aria-label="Cadastrar novo paciente"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Novo paciente
        </Link>
      </div>

      <form action="/lab/pacientes" method="get" className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-science-400" aria-hidden />
        <input
          name="q"
          type="search"
          defaultValue={query}
          maxLength={80}
          placeholder="Buscar por nome do paciente…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-science-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          aria-label="Buscar pacientes por nome"
        />
        </div>
        <button type="submit" className="min-h-10 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600">
          Buscar
        </button>
        {query && (
          <Link href="/lab/pacientes" className="min-h-10 rounded-xl border border-slate-200 dark:border-white/10 px-5 py-2.5 text-center text-sm font-semibold text-slate-700 dark:text-science-100 hover:bg-slate-50 dark:hover:bg-white/5">
            Limpar
          </Link>
        )}
      </form>

      {/* Tabela / Lista */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
        {hasQueryError ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center" role="alert">
            <AlertTriangle className="h-11 w-11 mb-4 text-amber-500" strokeWidth={1.5} aria-hidden />
            <p className="font-semibold text-slate-700 dark:text-science-100">Não foi possível carregar os pacientes</p>
            <p className="text-sm text-slate-500 dark:text-science-200 mt-1 max-w-md">
              Nenhum dado foi alterado. Verifique sua conexão e tente novamente.
            </p>
            <Link
              href="/lab/pacientes"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-science-100 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Tentar novamente
            </Link>
          </div>
        ) : !pets || pets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-science-400">
            <FlaskConical className="h-12 w-12 mb-4 opacity-30" strokeWidth={1.5} aria-hidden />
            <p className="font-semibold text-slate-500 dark:text-science-200">{query ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}</p>
            <p className="text-sm mt-1">{query ? 'Tente outro nome ou limpe a busca.' : 'Adicione o primeiro paciente para começar.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Lista de pacientes">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-science-200 uppercase tracking-wider">Paciente</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-science-200 uppercase tracking-wider hidden sm:table-cell">Espécie</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-science-200 uppercase tracking-wider hidden md:table-cell">Tutor</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-science-200 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5" aria-label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {pets.map((pet) => (
                  <tr key={pet.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {pet.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{pet.nome}</p>
                          <p className="text-xs text-slate-400 dark:text-science-400">{pet.raca ?? 'Raça não informada'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-science-200 capitalize hidden sm:table-cell">{pet.especie}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-science-200 hidden md:table-cell">
                      {pet.tutores?.nome ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[pet.status_paciente] ?? 'bg-slate-50 text-slate-500 dark:bg-white/10 dark:text-science-300'}`}>
                        {pet.status_paciente}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/lab/pacientes/${pet.id}/laudos`}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                        aria-label={`Ver laudos de ${pet.nome}`}
                      >
                        Ver laudos →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!hasQueryError && (
        <ListPagination
          basePath="/lab/pacientes"
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
          query={query}
        />
      )}
    </div>
  )
}
