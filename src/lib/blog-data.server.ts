import { getBlogPost, getBlogPosts } from '#/lib/blog.server'
import type { RuntimeDependencies } from '#/lib/cloudflare-context'
import type { ReactionCount } from '#/lib/reactions'
import { getPostReactions } from '#/lib/reactions.server'

export async function loadHomeData() {
  return { posts: await getBlogPosts() }
}

export async function loadPostData(context: RuntimeDependencies, request: Request, slug: string) {
  const post = await getBlogPost(slug)
  if (!post) return null
  try {
    const result = await getPostReactions(context, request, post.slug)
    return { post, reactions: result.reactions, cookie: result.cookie }
  } catch (error) {
    console.error('Failed to read post reactions', error)
    return { post, reactions: [] as ReactionCount[], cookie: undefined }
  }
}
