import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { getAllPosts } from '@/lib/blog'
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
  Nefrologia: 'bg-brand-50 text-brand-700',
  Urologia: 'bg-violet-50 text-violet-700',
  Diagnóstico: 'bg-emerald-50 text-emerald-700',
  Nutrição: 'bg-amber-50 text-amber-700',
  Tratamento: 'bg-rose-50 text-rose-700',
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold uppercase tracking-wider mb-6">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Conteúdo Científico
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 text-balance mb-4">
              Blog{' '}
              <span className="text-gradient-brand">Científico</span>
            </h1>
            <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
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
                    className="group flex flex-col rounded-2xl border border-slate-100 bg-white overflow-hidden hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300"
                  >
                    {/* Thumbnail placeholder */}
                    <div className="h-44 bg-gradient-to-br from-brand-50 via-sky-50 to-science-100 flex items-center justify-center">
                      <BookOpen
                        className="h-12 w-12 text-brand-200 group-hover:text-brand-300 transition-colors duration-300"
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
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden />
                          {new Date(post.frontmatter.date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto">{post.frontmatter.leitura}</span>
                      </div>

                      {/* Título */}
                      <h2 className="font-display font-bold text-slate-900 text-base leading-snug mb-2 group-hover:text-brand-700 transition-colors duration-200 flex-1">
                        {post.frontmatter.title}
                      </h2>

                      {/* Excerpt */}
                      <p className="text-sm text-slate-500 leading-relaxed mb-4 line-clamp-2">
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
