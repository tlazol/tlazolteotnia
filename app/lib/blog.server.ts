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
  posts: BlogPost[]
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

export async function getBlogFeedPosts(): Promise<BlogPost[]> {
  const cache = await getBlogPostCache()

  return cache.posts
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
  const publishedPosts = sortBlogPostsNewestFirst(posts.filter((post) => !post.draft)).map(
    toPublicBlogPost
  )
  const postsBySlug = new Map<string, BlogPost>()

  for (const post of publishedPosts) {
    postsBySlug.set(post.slug, post)
  }

  return {
    postsBySlug,
    posts: publishedPosts,
    summaries: publishedPosts.map((post) => {
      const { body: _body, ...summary } = post
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
