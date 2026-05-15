import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { ArrowLeft, Calendar, Clock, Tag } from 'lucide-react'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  try {
    const post = getPostBySlug(slug)
    return {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      keywords: post.frontmatter.tags,
      authors: [{ name: post.frontmatter.autor }],
      alternates: { canonical: `/blog/${slug}` },
      openGraph: {
        title: post.frontmatter.title,
        description: post.frontmatter.description,
        type: 'article',
        publishedTime: post.frontmatter.date,
        authors: [post.frontmatter.autor],
        tags: post.frontmatter.tags,
      },
    }
  } catch {
    return { title: 'Artigo não encontrado' }
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params

  let post
  try {
    post = getPostBySlug(slug)
  } catch {
    notFound()
  }

  const { frontmatter, content } = post

  // JSON-LD Article schema (E-E-A-T)
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    headline: frontmatter.title,
    description: frontmatter.description,
    datePublished: frontmatter.date,
    author: {
      '@type': 'Person',
      name: frontmatter.autor,
      ...(frontmatter.crmv && { identifier: frontmatter.crmv }),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Vet do Rim',
      url: 'https://vetdorim.com.br',
    },
    keywords: frontmatter.tags?.join(', '),
    inLanguage: 'pt-BR',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Header />
      <main id="main-content" className="pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-8" aria-label="Navegação de breadcrumb">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Blog Científico
            </Link>
          </nav>

          {/* Header do artigo */}
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                <Tag className="h-3 w-3" aria-hidden />
                {frontmatter.categoria}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                {new Date(frontmatter.date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {frontmatter.leitura} de leitura
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight text-balance mb-4">
              {frontmatter.title}
            </h1>

            <p className="text-lg text-slate-500 leading-relaxed">
              {frontmatter.description}
            </p>

            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                {frontmatter.autor.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{frontmatter.autor}</p>
                {frontmatter.crmv && (
                  <p className="text-xs text-slate-400">{frontmatter.crmv}</p>
                )}
              </div>
            </div>
          </header>

          {/* Conteúdo MDX */}
          <div className="prose prose-slate prose-vet max-w-none
            prose-headings:font-display prose-headings:font-bold
            prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline
            prose-code:text-brand-700 prose-code:bg-brand-50 prose-code:rounded prose-code:px-1
            prose-blockquote:border-brand-400 prose-blockquote:text-slate-500">
            <MDXRemote source={content} />
          </div>

          {/* Footer do artigo */}
          <footer className="mt-12 pt-8 border-t border-slate-100">
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              ⚠️ Este artigo tem caráter educacional e informativo. Não substitui avaliação clínica
              presencial nem o julgamento do médico veterinário responsável pelo paciente.
            </p>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:gap-3 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Ver todos os artigos
            </Link>
          </footer>
        </div>
      </main>
      <Footer />
    </>
  )
}
