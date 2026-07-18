import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vetdorim.com.br').replace(/\/+$/, '')

const publicRoutes = [
  '',
  '/blog',
  '/ferramentas',
  '/ferramentas/calculadora-tfg',
  '/ferramentas/controle-de-peso',
  '/ferramentas/estadiamento-iris',
  '/ferramentas/injuria-renal-aguda',
  '/ferramentas/planilha-laboratorial',
  '/legal/privacidade',
  '/legal/termos',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/blog' || route === '/ferramentas' ? 0.8 : 0.6,
  }))

  const postEntries: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: post.frontmatter.date,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticEntries, ...postEntries]
}
