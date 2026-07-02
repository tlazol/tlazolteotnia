import { RouterContextProvider, createRequestHandler } from 'react-router'
import { cloudflareContext } from '~/lib/cloudflare-context'

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE
)

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const context = new RouterContextProvider()
    context.set(cloudflareContext, { env, ctx })

    return requestHandler(request, context)
  }
} satisfies ExportedHandler<Env>
