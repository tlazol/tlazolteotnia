import { data } from 'react-router'
import {
  appendVisitorCookie,
  createReaction,
  getPostReactions,
  readReactionEmoji,
  requirePost
} from '~/lib/reactions.server'
import type { Route } from './+types/api.reactions.$slug'

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const post = await requirePost(params.slug)
  const headers = new Headers({ 'Cache-Control': 'private, no-store' })
  try {
    const result = await getPostReactions(context, request, post.slug)
    appendVisitorCookie(headers, result.cookie)
    return data(
      {
        reactions: result.reactions,
        reactedEmojis: result.reactions.filter((r) => r.reacted).map((r) => r.emoji)
      },
      { headers }
    )
  } catch (error) {
    console.error('Failed to read reactions', error)
    return data({ reactions: [], reactedEmojis: [] }, { headers })
  }
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const post = await requirePost(params.slug)
  const emoji = readReactionEmoji(await request.formData())
  try {
    const result = await createReaction(context, request, post.slug, emoji)
    const headers = new Headers({ 'Cache-Control': 'private, no-store' })
    appendVisitorCookie(headers, result.cookie)
    return data({ reaction: result.reaction, created: result.created }, { headers })
  } catch (error) {
    console.error('Failed to save reaction', error)
    return data({ error: 'リアクションを送信できませんでした。' }, { status: 503 })
  }
}
