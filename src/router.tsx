import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { getGlobalStartContext } from '@tanstack/react-start'
import type { RequestContext } from './lib/cloudflare-context'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    // Hydration scripts capture the nonce before the stream handler runs.
    ssr: { nonce: getGlobalStartContext()?.nonce },
    scrollRestoration: true,
    defaultPreload: 'intent'
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
    server: { requestContext: RequestContext }
  }
}
