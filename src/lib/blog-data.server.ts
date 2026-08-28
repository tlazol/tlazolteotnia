import type { RuntimeDependencies } from '#/lib/cloudflare-context'
import { getBlogPost, getBlogPosts } from '#/lib/blog.server'
import type { ReactionCount } from '#/lib/reactions'
import { getPostReactions, getReactionCountsBySlug } from '#/lib/reactions.server'

export async function loadHomeData(context: RuntimeDependencies, request: Request) {
  const posts = await getBlogPosts()
  try {
    const result = await getReactionCountsBySlug(
      context,
      request,
      posts.map((post) => post.slug)
    )
    return { posts, reactionsBySlug: result.reactionsBySlug, cookie: result.cookie }
  } catch (error) {
    console.error('Failed to read home reactions', error)
    return { posts, reactionsBySlug: {} as Record<string, ReactionCount[]>, cookie: undefined }
  }
}

export async function loadPostData(
  context: RuntimeDependencies,
  request: Request,
  slug: string,
  includeSummaries = true
) {
  const [post, posts] = await Promise.all([
    getBlogPost(slug),
    includeSummaries ? getBlogPosts() : Promise.resolve([])
  ])
  if (!post) return null
  try {
    const result = await getPostReactions(context, request, post.slug)
    return { post, posts, reactions: result.reactions, cookie: result.cookie }
  } catch (error) {
    console.error('Failed to read post reactions', error)
    return { post, posts, reactions: [] as ReactionCount[], cookie: undefined }
  }
}
