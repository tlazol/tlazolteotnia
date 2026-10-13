import handler from '@tanstack/react-start/server-entry'
import { createCspNonce, createHtmlSecurityHeaders } from '#/lib/security-headers'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const nonce = createCspNonce()
    const response = await handler.fetch(request, {
      context: {
        db: env.DB,
        reactionCountsCache: await caches.open('reaction-counts'),
        reactionCookieSecret: env.REACTION_COOKIE_SECRET,
        waitUntil: ctx.waitUntil.bind(ctx),
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
