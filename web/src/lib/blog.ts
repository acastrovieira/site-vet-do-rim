import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const POSTS_DIR = path.join(process.cwd(), 'src', 'content', 'blog')

export interface PostFrontmatter {
  title: string
  description: string
  date: string // ISO 8601: YYYY-MM-DD
  categoria: string
  tags: string[]
  autor: string
  crmv?: string
  leitura: string // ex: "8 min"
  featured?: boolean
}

export interface Post {
  slug: string
  frontmatter: PostFrontmatter
  content: string
}

/**
 * Retorna todos os posts do blog ordenados por data (mais recente primeiro).
 */
export function getAllPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return []

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'))

  const posts = files.map((filename) => {
    const slug = filename.replace(/\.mdx$/, '')
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8')
    const { data, content } = matter(raw)
    return {
      slug,
      frontmatter: data as PostFrontmatter,
      content,
    }
  })

  return posts.sort(
    (a, b) =>
      new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
  )
}

/**
 * Retorna um post pelo slug. Lança erro se não encontrado.
 */
export function getPostBySlug(slug: string): Post {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Post não encontrado: ${slug}`)
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  return {
    slug,
    frontmatter: data as PostFrontmatter,
    content,
  }
}

/**
 * Retorna posts de uma categoria específica.
 */
export function getPostsByCategoria(categoria: string): Post[] {
  return getAllPosts().filter(
    (p) => p.frontmatter.categoria.toLowerCase() === categoria.toLowerCase()
  )
}
