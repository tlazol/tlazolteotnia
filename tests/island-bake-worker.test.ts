import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BakeRequest, BakeResponse } from '../src/lib/island-bake.worker'
import type { BakeSnapshot } from '../src/lib/island-bake-cache'
import { createIsland, decorCode, GRASS } from '../src/lib/island-world'

const cache = vi.hoisted(() => ({
  snapshot: null as unknown,
  writable: true,
  read: vi.fn(),
  write: vi.fn()
}))
vi.mock('../src/lib/island-bake-cache', async (original) => ({
  ...(await original<typeof import('../src/lib/island-bake-cache')>()),
  readBakeSnapshot: cache.read,
  writeBakeSnapshot: cache.write
}))

afterEach(() => vi.unstubAllGlobals())

async function worker() {
  vi.resetModules()
  const messages: BakeResponse[] = []
  const scope = {
    onmessage: null as ((event: { data: BakeRequest }) => Promise<void>) | null,
    postMessage(message: BakeResponse, transfer: Transferable[]) {
      // Exercise the real ownership transfer: the worker loses these buffers.
      messages.push(structuredClone(message, { transfer }))
    }
  }
  vi.stubGlobal('self', scope)
  await import('../src/lib/island-bake.worker')
  return {
    async bake(request: BakeRequest) {
      messages.length = 0
      await scope.onmessage?.({ data: structuredClone(request) })
      return structuredClone(messages)
    }
  }
}

function worldRequest(serial = 1): BakeRequest {
  const world = createIsland(10, 10)
  world.ground.fill(GRASS)
  world.decor[55] = decorCode('rock')
  return { serial, ...world }
}

function setupCache() {
  cache.snapshot = null
  cache.writable = true
  cache.read.mockReset().mockImplementation(async () => ({
    snapshot: structuredClone(cache.snapshot),
    writable: cache.writable
  }))
  cache.write.mockReset().mockImplementation(async (snapshot: BakeSnapshot) => {
    cache.snapshot = structuredClone(snapshot)
  })
}

describe('island worker caching', () => {
  it('renders identical points from persistent cache and handles the next edit correctly', async () => {
    setupCache()
    const request = worldRequest()
    const fresh = await worker()
    const original = await fresh.bake(request)
    expect(cache.write).toHaveBeenCalledOnce()
    const cached = await worker()
    expect(await cached.bake(request)).toEqual(original)
    expect(cache.write).toHaveBeenCalledOnce()

    request.serial = 2
    request.decor[55] = decorCode('tree')
    expect(await cached.bake(request)).toEqual(await fresh.bake(request))
  })

  it('recomputes and replaces a broken snapshot instead of failing the island', async () => {
    setupCache()
    const first = await worker()
    const request = worldRequest()
    const original = await first.bake(request)
    const snapshot = cache.snapshot as BakeSnapshot
    cache.snapshot = { ...snapshot, chunks: [{ ...snapshot.chunks[0], terrain: null }] }
    const next = await worker()
    expect(await next.bake(request)).toEqual(original)
    expect(cache.write).toHaveBeenCalledTimes(2)
  })

  it('does not copy scenery for persistence when storage is unavailable', async () => {
    setupCache()
    cache.writable = false
    const instance = await worker()
    const clone = vi.spyOn(globalThis, 'structuredClone')
    const messages = await instance.bake(worldRequest())
    const chunkClones = clone.mock.calls.filter(
      ([value]) => value && typeof value === 'object' && 'terrain' in value
    )
    clone.mockRestore()
    expect(messages.at(-1)?.type).toBe('done')
    expect(cache.write).not.toHaveBeenCalled()
    // All cloning here belongs to the harness's incoming message and transfers;
    // there must be no extra cloning of individual chunks for a disabled cache.
    expect(chunkClones).toHaveLength(0)
  })
})
