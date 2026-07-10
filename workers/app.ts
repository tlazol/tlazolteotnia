import { createRequestHandler, RouterContextProvider } from 'react-router'
import {
  dbContext,
  reactionCountsCacheContext,
  reactionSecretContext,
  waitUntilContext
} from '../app/lib/cloudflare-context'

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE
)

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const context = new RouterContextProvider()
    context.set(dbContext, env.DB)
    context.set(reactionCountsCacheContext, await caches.open('reaction-counts'))
    context.set(reactionSecretContext, env.REACTION_COOKIE_SECRET)
    context.set(waitUntilContext, ctx.waitUntil.bind(ctx))
    return requestHandler(request, context)
  }
} satisfies ExportedHandler<Env>
