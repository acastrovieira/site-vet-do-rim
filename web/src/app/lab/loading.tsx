/**
 * Loading UI do Lab Evolution.
 * Exibido enquanto Server Components do /lab estão carregando.
 * Suspense automático do Next.js App Router.
 */
export default function LabLoading() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Carregando painel...">
      {/* Skeleton do header */}
      <div>
        <div className="h-8 w-64 bg-slate-100 dark:bg-white/10 rounded-xl mb-2" />
        <div className="h-4 w-48 bg-slate-100 dark:bg-white/10 rounded-lg" />
      </div>

      {/* Skeleton dos cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-5 flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-white/10 shrink-0" />
            <div className="flex-1">
              <div className="h-7 w-16 bg-slate-100 dark:bg-white/10 rounded-lg mb-1.5" />
              <div className="h-3 w-28 bg-slate-100 dark:bg-white/10 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton do painel principal */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-6">
        <div className="h-5 w-40 bg-slate-100 dark:bg-white/10 rounded-lg mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-white/10 shrink-0" />
              <div className="flex-1 h-4 bg-slate-100 dark:bg-white/10 rounded-lg" />
              <div className="h-4 w-16 bg-slate-100 dark:bg-white/10 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
