import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import type { RequestContext } from '#/lib/cloudflare-context'
import { createCspNonce, createHtmlSecurityHeaders } from '#/lib/security-headers'

const startHandler = createStartHandler<{ server: { requestContext: RequestContext } }>(
  async (handlerContext) => {
    const requestContext = handlerContext.router.options.additionalContext?.serverContext
    handlerContext.router.update({
      ssr: { ...handlerContext.router.options.ssr, nonce: requestContext?.nonce }
    })
    return defaultStreamHandler(handlerContext)
  }
)

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const nonce = createCspNonce()
    const response = await startHandler(request, {
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
