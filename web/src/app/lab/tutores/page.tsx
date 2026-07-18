import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, Plus, Phone, Mail, ChevronRight, AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { ListPagination } from '@/components/lab/ListPagination'
import { listPageRange, parseListPage } from '@/lib/list-pagination'

export const metadata: Metadata = {
  title: 'Tutores — Lab Evolution',
  description: 'Lista de tutores de pacientes renais cadastrados no Lab Evolution.',
  robots: { index: false, follow: false },
}

const PAGE_SIZE = 25

interface TutoresPageProps {
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

function tutorsHref(page: number, query: string) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (page > 1) params.set('page', String(page))
  const search = params.toString()
  return search ? `/lab/tutores?${search}` : '/lab/tutores'
}

export default async function TutoresPage({ searchParams }: TutoresPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const query = normalizedQuery(params?.q)
  const page = parseListPage(params?.page, PAGE_SIZE)
  const { firstRow, lastRow } = listPageRange(page, PAGE_SIZE)

  type TutorRow = {
    id: string
    nome: string
    email: string | null
    telefone: string
    cidade: string | null
    estado: string | null
    criado_em: string
  }

  let tutorsQuery = supabase
    .from('tutores')
    .select('id, nome, email, telefone, cidade, estado, criado_em', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .order('id', { ascending: false })
    .range(firstRow, lastRow)

  if (query) tutorsQuery = tutorsQuery.ilike('nome', `%${query}%`)

  const { data: tutores, error, count } = await tutorsQuery as {
    data: TutorRow[] | null
    error: Error | null
    count: number | null
  }

  const hasQueryError = Boolean(error) || count === null
  const totalItems = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  if (!hasQueryError && totalItems > 0 && page > totalPages) {
    redirect(tutorsHref(totalPages, query))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Tutores</h1>
          <p className="text-slate-500 dark:text-science-200 mt-1 text-sm">
            Tutores de pacientes renais cadastrados · Lab Evolution
          </p>
        </div>
        <Link
          href="/lab/tutores/novo"
          id="btn-novo-tutor"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          aria-label="Cadastrar novo tutor"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Novo tutor
        </Link>
      </div>

      <form action="/lab/tutores" method="get" className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-science-400" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={query}
            maxLength={80}
            placeholder="Buscar por nome do tutor…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-science-500"
            aria-label="Buscar tutores por nome"
          />
        </div>
        <button type="submit" className="min-h-10 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600">
          Buscar
        </button>
        {query && (
          <Link href="/lab/tutores" className="min-h-10 rounded-xl border border-slate-200 px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-science-100 dark:hover:bg-white/5">
            Limpar
          </Link>
        )}
      </form>

      {/* Grid de tutores */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
        {hasQueryError ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center" role="alert">
            <AlertTriangle className="h-11 w-11 mb-4 text-amber-500" strokeWidth={1.5} aria-hidden />
            <p className="font-semibold text-slate-700 dark:text-science-100">Não foi possível carregar os tutores</p>
            <p className="text-sm text-slate-500 dark:text-science-200 mt-1 max-w-md">
              Nenhum dado foi alterado. Verifique sua conexão e tente novamente.
            </p>
            <Link
              href="/lab/tutores"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-science-100 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Tentar novamente
            </Link>
          </div>
        ) : !tutores || tutores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-science-400">
            <Users className="h-12 w-12 mb-4 opacity-30" strokeWidth={1.5} aria-hidden />
            <p className="font-semibold text-slate-500 dark:text-science-200">{query ? 'Nenhum tutor encontrado' : 'Nenhum tutor cadastrado'}</p>
            <p className="text-sm mt-1">{query ? 'Tente outro nome ou limpe a busca.' : 'Os tutores dos seus pacientes aparecerão aqui.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Lista de tutores">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-science-200 uppercase tracking-wider">Tutor</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-science-200 uppercase tracking-wider hidden sm:table-cell">Contato</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-science-200 uppercase tracking-wider hidden md:table-cell">Localização</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-science-200 uppercase tracking-wider hidden lg:table-cell">Cadastrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {tutores.map((tutor) => (
                  <tr key={tutor.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-5 py-4">
                      <Link href={`/lab/tutores/${tutor.id}`} className="flex items-center gap-3 w-full">
                        <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {tutor.nome.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-gold-400 transition-colors">{tutor.nome}</p>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-brand-400 ml-auto transition-colors" aria-hidden />
                      </Link>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <div className="space-y-0.5">
                        {tutor.telefone && (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-science-200 text-xs">
                            <Phone className="h-3 w-3 text-slate-400" aria-hidden />
                            {tutor.telefone}
                          </div>
                        )}
                        {tutor.email && (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-science-200 text-xs">
                            <Mail className="h-3 w-3 text-slate-400" aria-hidden />
                            {tutor.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-science-200 text-xs hidden md:table-cell">
                      {tutor.cidade && tutor.estado
                        ? `${tutor.cidade}, ${tutor.estado}`
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-400 dark:text-science-400 text-xs hidden lg:table-cell">
                      {new Date(tutor.criado_em).toLocaleDateString('pt-BR')}
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
          basePath="/lab/tutores"
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
          query={query}
        />
      )}
    </div>
  )
}
