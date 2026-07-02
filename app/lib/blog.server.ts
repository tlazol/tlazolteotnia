import { parse as parseYaml } from 'yaml'

const blogSources = import.meta.glob<string>('/content/blog/*.md', {
  eager: true,
  import: 'default',
  query: '?raw'
})

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
  return Object.entries(blogSources).map(([file, source]) => readPostFile(file, source))
}

function readPostFile(file: string, source: string): BlogPostRecord {
  const slug = file.split('/').at(-1)?.replace(/\.md$/, '')

  if (!slug) {
    throw new Error(`Failed to derive a blog slug from ${file}`)
  }

  const { body, frontmatter } = parseBlogSource(source)

  return {
    slug,
    title: frontmatter.title ?? slug,
    date: normalizeDate(frontmatter.date),
    description: frontmatter.description ?? '',
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
    draft: frontmatter.draft === true,
    body
  }
}

function parseBlogSource(source: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)

  if (!match) {
    return { body: source, frontmatter: {} as BlogFrontmatter }
  }

  return {
    body: source.slice(match[0].length),
    frontmatter: (parseYaml(match[1]) ?? {}) as BlogFrontmatter
  }
}

function normalizeDate(date: BlogFrontmatter['date']) {
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10)
  }

  return date ?? '1970-01-01'
}
