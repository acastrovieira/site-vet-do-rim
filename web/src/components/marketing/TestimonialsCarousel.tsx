import {
  BadgeCheck,
  ClipboardCheck,
  FileCheck2,
} from 'lucide-react'

const evidenceCommitments = [
  {
    title: 'Depoimentos com autorização',
    description:
      'Relatos só devem ser publicados quando houver consentimento verificável, escopo definido e possibilidade de revogação.',
    icon: BadgeCheck,
  },
  {
    title: 'Indicadores com metodologia',
    description:
      'Números de atendimento ou satisfação exigem fonte, período de medição, responsável e critério de cálculo.',
    icon: ClipboardCheck,
  },
  {
    title: 'Resultados sem promessa',
    description:
      'Casos clínicos variam individualmente; comunicação pública não deve prometer resposta terapêutica ou prognóstico.',
    icon: FileCheck2,
  },
]

/**
 * Política pública de evidência usada enquanto não existe um acervo
 * versionado de consentimentos, fontes e metodologias para marketing clínico.
 */
export function PublicEvidenceCommitments() {
  return (
    <div data-public-evidence-policy className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {evidenceCommitments.map(({ title, description, icon: Icon }) => (
        <article
          key={title}
          className="relative rounded-2xl border border-white/10 bg-white/5 p-6"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/10 text-gold-400">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="mt-5 font-display text-lg font-bold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/65">{description}</p>
        </article>
      ))}
    </div>
  )
}
