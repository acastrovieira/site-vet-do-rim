import { AlertTriangle, ShieldCheck } from 'lucide-react'

interface ClinicalReviewNoticeProps {
  toolName: string
}

export function ClinicalReviewNotice({ toolName }: ClinicalReviewNoticeProps) {
  return (
    <section
      role="status"
      aria-labelledby="clinical-review-title"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8 shadow-sm"
    >
      <div className="flex flex-col items-center text-center">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">
          Revisão de segurança clínica
        </p>
        <h2 id="clinical-review-title" className="font-display text-2xl font-bold text-slate-900">
          Ferramenta temporariamente indisponível
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700">
          A ferramenta de {toolName} foi retirada preventivamente enquanto fórmulas, unidades,
          fontes e limites passam por nova validação independente. Não utilize resultados
          anteriores sem conferência do médico-veterinário responsável.
        </p>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-white/70 px-4 py-3 text-left text-xs leading-relaxed text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <span>
            A ferramenta só será reativada após testes dimensionais, casos clínicos de referência
            e homologação formal por especialistas veterinários.
          </span>
        </div>
      </div>
    </section>
  )
}
