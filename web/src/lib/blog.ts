import fs from 'fs'
import path from 'path'
import { parse as parseYaml } from 'yaml'
import { assertCivilDate, compareCivilDatesDescending } from './civil-date.ts'

const POSTS_DIR = path.resolve(process.cwd(), 'src', 'content', 'blog')
const BLOG_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isValidBlogSlug(value: string) {
  return BLOG_SLUG_RE.test(value)
}

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

function parsePost(raw: string): { frontmatter: PostFrontmatter; content: string } {
  const normalized = raw.replace(/^\uFEFF/, '').trimStart()
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    throw new Error('Frontmatter ausente ou invalido no post MDX.')
  }

  const frontmatter = parseYaml(match[1]) as PostFrontmatter
  assertCivilDate(frontmatter.date)

  return {
    frontmatter,
    content: match[2],
  }
}

/**
 * Retorna todos os posts do blog ordenados por data (mais recente primeiro).
 */
export function getAllPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return []

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'))

  const posts = files.map((filename) => {
    const slug = filename.replace(/\.mdx$/, '')
    if (!isValidBlogSlug(slug)) {
      throw new Error('Nome de arquivo invalido no diretorio de posts.')
    }
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8')
    const { frontmatter, content } = parsePost(raw)
    return {
      slug,
      frontmatter,
      content,
    }
  })

  return posts.sort((a, b) => compareCivilDatesDescending(
    a.frontmatter.date,
    b.frontmatter.date,
  ))
}

/**
 * Retorna um post pelo slug. Lança erro se não encontrado.
 */
export function getPostBySlug(slug: string): Post {
  if (!isValidBlogSlug(slug)) {
    throw new Error('Post nao encontrado.')
  }

  const filePath = path.resolve(POSTS_DIR, `${slug}.mdx`)
  if (path.dirname(filePath) !== POSTS_DIR) {
    throw new Error('Post nao encontrado.')
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('Post nao encontrado.')
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { frontmatter, content } = parsePost(raw)
  return {
    slug,
    frontmatter,
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
