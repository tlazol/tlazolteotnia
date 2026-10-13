import { createMemoryHistory } from '@tanstack/react-router'
import { attachRouterServerSsrUtils } from '@tanstack/react-router/ssr/server'
import { describe, expect, it, vi } from 'vitest'
import { getRouter } from '#/router'

const request = vi.hoisted(() => ({ context: undefined as { nonce: string } | undefined }))

vi.mock('@tanstack/react-start', () => ({
  getGlobalStartContext: () => request.context
}))

vi.mock('#/routeTree.gen', async () => {
  const { createRootRoute } = await import('@tanstack/react-router')
  return { routeTree: createRootRoute() }
})

describe('router CSP hydration', () => {
  it('applies each request nonce to bootstrap scripts before the stream handler runs', async () => {
    for (const nonce of ['first-request-nonce', 'second-request-nonce']) {
      request.context = { nonce }
      const router = getRouter()
      router.update({ history: createMemoryHistory({ initialEntries: ['/'] }) })
      attachRouterServerSsrUtils({ router, manifest: undefined })
      try {
        await router.load()
        await router.serverSsr?.dehydrate()
        const scripts = router.serverSsr?.takeInitialHydrationScriptTags()
        expect(scripts?.before.length).toBeGreaterThan(0)
        expect(scripts?.boundary.attrs?.nonce).toBe(nonce)
        for (const script of scripts?.before ?? []) {
          expect(script.attrs?.nonce).toBe(nonce)
        }
      } finally {
        router.serverSsr?.cleanup()
      }
    }
  })

  it('can create the client router without a server request context', () => {
    request.context = undefined
    expect(getRouter().options.ssr?.nonce).toBeUndefined()
  })
})
