import {
  type BlogPost,
  type BlogPostRecord,
  type BlogPostSummary,
  parseBlogPosts,
  sortBlogPostsNewestFirst,
  toPublicBlogPost
} from '~/lib/blog-post'

export type { BlogPost, BlogPostSummary } from '~/lib/blog-post'

const blogSources = import.meta.glob<string>('/content/blog/*.md', {
  eager: true,
  import: 'default',
  query: '?raw'
})

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
    const publicPost = toPublicBlogPost(post)
    postsBySlug.set(publicPost.slug, publicPost)
  }

  return {
    postsBySlug,
    summaries: sortBlogPostsNewestFirst(publishedPosts).map((post) => {
      const { body: _body, ...summary } = toPublicBlogPost(post)
      return summary
    })
  }
}

async function readAllPosts(): Promise<BlogPostRecord[]> {
  return parseBlogPosts(
    Object.entries(blogSources).map(([path, source]) => ({
      path: path.replace(/^\//, ''),
      source
    }))
  )
}
