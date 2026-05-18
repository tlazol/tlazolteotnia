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

type BlogPostRecord = BlogPost & {
  draft: boolean
}

type BlogPostCache = {
  postsBySlug: Map<string, BlogPost>
  summaries: BlogPostSummary[]
}

let blogPostCachePromise: Promise<BlogPostCache> | null = null

export async function getBlogPosts(): Promise<BlogPostSummary[]> {
  const cache = await getBlogPostCache()

  return cache.summaries
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const cache = await getBlogPostCache()
  const post = cache.postsBySlug.get(slug)

  if (!post) {
    return null
  }

  return post
}

async function getBlogPostCache() {
  if (process.env.NODE_ENV !== 'production') {
    return buildBlogPostCache()
  }

  blogPostCachePromise ??= buildBlogPostCache().catch((error) => {
    blogPostCachePromise = null
    throw error
  })

  return blogPostCachePromise
}

async function buildBlogPostCache(): Promise<BlogPostCache> {
  const posts = await readAllPosts()
  const publishedPosts = posts.filter((post) => !post.draft)
  const postsBySlug = new Map<string, BlogPost>()

  for (const post of publishedPosts) {
    const { draft: _draft, ...publicPost } = post
    postsBySlug.set(publicPost.slug, publicPost)
  }

  return {
    postsBySlug,
    summaries: [...publishedPosts]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .map(({ body: _body, draft: _draft, ...post }) => post)
  }
}

async function readAllPosts(): Promise<BlogPostRecord[]> {
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

async function readPostFile(file: string): Promise<BlogPostRecord> {
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
