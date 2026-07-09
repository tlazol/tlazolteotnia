import { createRequestHandler, RouterContextProvider } from 'react-router'
import { dbContext, reactionSecretContext } from '../app/lib/cloudflare-context'

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE
)

export default {
  fetch(request: Request, env: Env) {
    const context = new RouterContextProvider()
    context.set(dbContext, env.DB)
    context.set(reactionSecretContext, env.REACTION_COOKIE_SECRET)
    return requestHandler(request, context)
  }
} satisfies ExportedHandler<Env>
