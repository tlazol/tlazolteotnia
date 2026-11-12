import handler from '@tanstack/react-start/server-entry'
import { handleIslandRequest } from '#/lib/island-api.server'
import { createCspNonce, createHtmlSecurityHeaders } from '#/lib/security-headers'

export { IslandRoom } from '#/lib/island-room.server'

export default {
  async fetch(request: Request, env: Env) {
    // The shared island's API, including the WebSocket upgrade, is answered
    // before the app; its responses (101 included) are returned as they are.
    const island = await handleIslandRequest(request, env)
    if (island) return island

    const nonce = createCspNonce()
    const response = await handler.fetch(request, {
      context: {
        db: env.DB,
        reactionCookieSecret: env.REACTION_COOKIE_SECRET,
        reactionRateLimiter: env.REACTION_RATE_LIMITER,
        nonce
      }
    })

    if (!response.headers.get('Content-Type')?.startsWith('text/html')) return response
    const headers = new Headers(response.headers)
    for (const [name, value] of Object.entries(createHtmlSecurityHeaders(nonce))) {
      headers.set(name, value)
    }
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText
    })
  }
} satisfies ExportedHandler<Env>
