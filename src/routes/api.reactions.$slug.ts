import { createFileRoute } from '@tanstack/react-router'
import { handleGetReactions, handlePostReaction } from '#/lib/reaction-api.server'

export const Route = createFileRoute('/api/reactions/$slug')({
  server: {
    handlers: {
      GET: ({ context, params, request }) => handleGetReactions(context, request, params.slug),
      POST: ({ context, params, request }) => handlePostReaction(context, request, params.slug)
    }
  }
})
