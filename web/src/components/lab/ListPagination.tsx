import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { boundedTotalPages, MAX_LIST_PAGE } from '@/lib/list-pagination'

interface ListPaginationProps {
  basePath: string
  currentPage: number
  pageSize: number
  totalItems: number
  query?: string
}

function pageHref(basePath: string, page: number, query?: string) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (page > 1) params.set('page', String(page))
  const search = params.toString()
  return search ? `${basePath}?${search}` : basePath
}

export function ListPagination({
  basePath,
  currentPage,
  pageSize,
  totalItems,
  query,
}: ListPaginationProps) {
  if (totalItems === 0) return null

  const rawTotalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const totalPages = boundedTotalPages(totalItems, pageSize)
  const reachedOperationalLimit = rawTotalPages > MAX_LIST_PAGE
  const firstItem = (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalItems)
  const previousHref = pageHref(basePath, currentPage - 1, query)
  const nextHref = pageHref(basePath, currentPage + 1, query)
  const controlClass = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors'

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
      aria-label="Paginação da lista"
    >
      <p className="text-sm text-slate-500 dark:text-science-200" aria-live="polite">
        Mostrando {firstItem}–{lastItem} de {totalItems}
      </p>
      {reachedOperationalLimit && currentPage === MAX_LIST_PAGE && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300" role="status">
          Limite de navegação atingido; refine a busca para continuar.
        </p>
      )}
      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={previousHref}
            className={`${controlClass} border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-science-100 dark:hover:bg-white/5`}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Anterior
          </Link>
        ) : (
          <span
            className={`${controlClass} cursor-not-allowed border-slate-100 text-slate-300 dark:border-white/5 dark:text-science-700`}
            aria-disabled="true"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Anterior
          </span>
        )}
        <span className="min-w-20 text-center text-xs font-medium text-slate-500 dark:text-science-200">
          {currentPage} de {totalPages}
        </span>
        {currentPage < totalPages ? (
          <Link
            href={nextHref}
            className={`${controlClass} border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-science-100 dark:hover:bg-white/5`}
            aria-label="Próxima página"
          >
            Próxima
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <span
            className={`${controlClass} cursor-not-allowed border-slate-100 text-slate-300 dark:border-white/5 dark:text-science-700`}
            aria-disabled="true"
          >
            Próxima
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  )
}
