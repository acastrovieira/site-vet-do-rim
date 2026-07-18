'use client'

import { Lock, Sparkles, ArrowRight } from 'lucide-react'

interface LeadGateProps {
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
}

/**
 * Bloqueio visual para features exclusivas para cadastrados.
 * Exibe cadeado, descrição e CTA para criar conta gratuita.
 */
export function LeadGate({
  title,
  description,
  ctaLabel = 'Criar Conta Gratuita',
  ctaHref = '/auth/cadastro',
}: LeadGateProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-brand-50/30 p-6 text-center dark:border-white/10 dark:from-white/5 dark:to-gold-400/5">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold-400/10 blur-2xl" />

      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 dark:bg-gold-400/10">
          <Lock className="h-5 w-5 text-brand-500 dark:text-gold-400" strokeWidth={2} />
        </div>

        <h4 className="font-display text-sm font-bold text-slate-700 dark:text-white">{title}</h4>
        <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-science-200">{description}</p>

        <a
          href={ctaHref}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
