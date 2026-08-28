import type { RuntimeDependencies } from '#/lib/cloudflare-context'
import {
  appendVisitorCookie,
  createReaction,
  getPostReactions,
  readReactionEmoji,
  requirePost
} from '#/lib/reactions.server'

export async function handleGetReactions(
  context: RuntimeDependencies,
  request: Request,
  slug: string
) {
  const post = await requirePost(slug)
  const headers = new Headers({ 'Cache-Control': 'private, no-store' })
  try {
    const result = await getPostReactions(context, request, post.slug)
    appendVisitorCookie(headers, result.cookie)
    return Response.json(
      {
        reactions: result.reactions,
        reactedEmojis: result.reactions
          .filter((reaction) => reaction.reacted)
          .map((reaction) => reaction.emoji)
      },
      { headers }
    )
  } catch (error) {
    console.error('Failed to read reactions', error)
    return Response.json({ reactions: [], reactedEmojis: [] }, { headers })
  }
}

export async function handlePostReaction(
  context: RuntimeDependencies,
  request: Request,
  slug: string
) {
  const post = await requirePost(slug)
  const emoji = readReactionEmoji(await request.formData())
  try {
    const result = await createReaction(context, request, post.slug, emoji)
    const headers = new Headers({ 'Cache-Control': 'private, no-store' })
    appendVisitorCookie(headers, result.cookie)
    return Response.json({ reaction: result.reaction, created: result.created }, { headers })
  } catch (error) {
    console.error('Failed to save reaction', error)
    return Response.json({ error: 'リアクションを送信できませんでした。' }, { status: 503 })
  }
}
