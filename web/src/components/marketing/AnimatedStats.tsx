import {
  BookOpenCheck,
  PawPrint,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'

const principles = [
  {
    title: 'Cães e gatos',
    description: 'Conteúdo e ferramentas delimitam explicitamente as espécies contempladas.',
    icon: PawPrint,
  },
  {
    title: 'Decisão clínica humana',
    description: 'Resultados digitais apoiam, mas não substituem, a avaliação do médico-veterinário.',
    icon: Stethoscope,
  },
  {
    title: 'Limites explícitos',
    description: 'Recursos em revisão permanecem contidos até receber validação clínica independente.',
    icon: ShieldCheck,
  },
  {
    title: 'Conteúdo educacional',
    description: 'Artigos informam fontes e deixam claro quando a consulta presencial é necessária.',
    icon: BookOpenCheck,
  },
]

/**
 * Princípios institucionais verificáveis, sem métricas comerciais sem fonte.
 * O nome do arquivo foi preservado para evitar uma renomeação destrutiva no worktree.
 */
export function PracticePrinciples() {
  return (
    <div data-practice-principles className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 py-12">
      {principles.map(({ title, description, icon: Icon }) => (
        <article key={title} className="card-clinical p-6 sm:p-7 rounded-2xl">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(26, 58, 107, 0.1)', color: '#1A3A6B' }}
          >
            <Icon className="w-5 h-5" aria-hidden />
          </div>
          <h3 className="font-display text-lg font-bold text-science-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-science-600 dark:text-navy-200">
            {description}
          </p>
        </article>
      ))}
    </div>
  )
}
