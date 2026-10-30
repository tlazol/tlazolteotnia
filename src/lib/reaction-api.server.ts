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
  // Require the browser's serialized origin; missing and opaque origins fail closed.
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return Response.json(
      { error: 'リアクションを送信できませんでした。' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }

  try {
    // Cloudflare supplies this header. Never use cookies or X-Forwarded-For as a fallback.
    // Requests without connection metadata share a bucket, including local development.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
    const { success } = await context.reactionRateLimiter.limit({
      key: `tlazolteotnia:reactions:ip:${ip}`
    })
    if (!success) {
      return Response.json(
        { error: '送信が多すぎます。しばらく待ってからお試しください。' },
        {
          status: 429,
          headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' }
        }
      )
    }
  } catch (error) {
    console.error('Failed to check reaction rate limit', error)
    return Response.json(
      { error: 'リアクションを送信できませんでした。' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }

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
