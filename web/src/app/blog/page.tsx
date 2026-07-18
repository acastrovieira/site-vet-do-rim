import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { getAllPosts } from '@/lib/blog'
import { formatCivilDate } from '@/lib/civil-date'
import { ArrowRight, BookOpen, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog Científico — Nefrologia e Urologia Veterinária',
  description:
    'Artigos científicos sobre nefrologia e urologia veterinária. Estadiamento IRIS, TFG, DRC, urolitíase e mais — escritos por especialistas.',
  keywords: [
    'blog nefrologia veterinária',
    'artigos urologia veterinária',
    'doença renal crônica cão gato',
    'IRIS staging veterinário',
    'taxa filtração glomerular',
  ],
  alternates: { canonical: '/blog' },
}

const categoriaColors: Record<string, string> = {
  Nefrologia: 'bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-200 border border-transparent dark:border-brand-500/30',
  Urologia: 'bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 border border-transparent dark:border-violet-500/30',
  Diagnóstico: 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border border-transparent dark:border-emerald-500/30',
  Nutrição: 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200 border border-transparent dark:border-amber-500/30',
  Tratamento: 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 border border-transparent dark:border-rose-500/30',
}

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <>
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Hero do blog */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Conteúdo Científico
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white text-balance mb-4">
              Blog{' '}
              <span className="text-gradient-brand dark:text-gradient-gold">Científico</span>
            </h1>
            <p className="text-slate-500 dark:text-science-200 text-lg max-w-xl mx-auto leading-relaxed">
              Artigos baseados em evidências sobre nefrologia e urologia veterinária,
              escritos para médicos veterinários e tutores informados.
            </p>
          </div>

          {/* Grid de artigos */}
          {posts.length === 0 ? (
            <div className="text-center py-24 text-slate-400">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Artigos em breve</p>
              <p className="text-sm mt-1">Novos conteúdos científicos serão publicados em breve.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => {
                const colorClass = categoriaColors[post.frontmatter.categoria] ?? 'bg-slate-50 text-slate-600'
                return (
                  <article
                    key={post.slug}
                    className="group flex flex-col rounded-2xl glass-card overflow-hidden hover:border-brand-200 dark:hover:border-gold-400/30 transition-all duration-300"
                  >
                    {/* Thumbnail placeholder */}
                    <div className="h-44 flex items-center justify-center border-b border-slate-200 dark:border-white/5" style={{ background: 'rgba(128,128,128,0.05)' }}>
                      <BookOpen
                        className="h-12 w-12 text-slate-300 dark:text-white/20 group-hover:text-brand-300 dark:group-hover:text-gold-400 transition-colors duration-300"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      {/* Meta */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colorClass}`}>
                          {post.frontmatter.categoria}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-white/40 flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden />
                          {formatCivilDate(post.frontmatter.date, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-white/40 ml-auto">{post.frontmatter.leitura}</span>
                      </div>

                      {/* Título */}
                      <h2 className="font-display font-bold text-slate-900 dark:text-white text-base leading-snug mb-2 group-hover:text-brand-700 dark:group-hover:text-gold-400 transition-colors duration-200 flex-1">
                        {post.frontmatter.title}
                      </h2>

                      {/* Excerpt */}
                      <p className="text-sm text-slate-500 dark:text-science-200 leading-relaxed mb-4 line-clamp-2">
                        {post.frontmatter.description}
                      </p>

                      {/* CTA */}
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:gap-2.5 transition-all duration-200"
                        aria-label={`Ler artigo: ${post.frontmatter.title}`}
                      >
                        Ler artigo
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
