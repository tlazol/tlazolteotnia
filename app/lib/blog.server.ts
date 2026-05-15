import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'

const blogDirectory = path.join(process.cwd(), 'content', 'blog')

export type BlogPost = {
  slug: string
  title: string
  date: string
  description: string
  tags: string[]
  body: string
}

export type BlogPostSummary = Omit<BlogPost, 'body'>

type BlogFrontmatter = {
  title?: string
  date?: string | Date
  description?: string
  tags?: string[]
  draft?: boolean
}

export async function getBlogPosts(): Promise<BlogPostSummary[]> {
  const posts = await readAllPosts()

  return posts
    .filter((post) => !post.draft)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .map(({ body: _body, draft: _draft, ...post }) => post)
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const posts = await readAllPosts()
  const post = posts.find((item) => item.slug === slug && !item.draft)

  if (!post) {
    return null
  }

  const { draft: _draft, ...publicPost } = post
  return publicPost
}

async function readAllPosts() {
  let files: string[]

  try {
    files = await readdir(blogDirectory)
  } catch {
    return []
  }

  const posts = await Promise.all(
    files.filter((file) => file.endsWith('.md')).map(async (file) => readPostFile(file))
  )

  return posts
}

async function readPostFile(file: string) {
  const slug = file.replace(/\.md$/, '')
  const source = await readFile(path.join(blogDirectory, file), 'utf8')
  const { content, data } = matter(source)
  const frontmatter = data as BlogFrontmatter

  return {
    slug,
    title: frontmatter.title ?? slug,
    date: normalizeDate(frontmatter.date),
    description: frontmatter.description ?? '',
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
    draft: frontmatter.draft === true,
    body: content
  }
}

function normalizeDate(date: BlogFrontmatter['date']) {
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10)
  }

  return date ?? '1970-01-01'
}
