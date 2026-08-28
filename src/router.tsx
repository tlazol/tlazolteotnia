import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { RequestContext } from './lib/cloudflare-context'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

declare module '@tanstack/router-core' {
  interface Register {
    server: { requestContext: RequestContext }
  }
}

declare module '@tanstack/react-start' {
  interface Register {
    server: { requestContext: RequestContext }
  }
}
