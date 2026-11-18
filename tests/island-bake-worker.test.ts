import { afterEach, describe, expect, it, vi } from 'vitest'
import { bakeModel } from '../src/lib/island-bake'
import type { BakeRequest, BakeResponse, ModelMessage } from '../src/lib/island-bake.worker'
import type { BakeSnapshot, ModelCache } from '../src/lib/island-bake-cache'
import { createIsland, decorCode, GRASS } from '../src/lib/island-world'

const cache = vi.hoisted(() => ({
  snapshot: null as unknown,
  writable: true,
  models: null as unknown,
  read: vi.fn(),
  write: vi.fn(),
  readModels: vi.fn(),
  writeModels: vi.fn()
}))
vi.mock('../src/lib/island-bake-cache', async (original) => ({
  ...(await original<typeof import('../src/lib/island-bake-cache')>()),
  readBakeSnapshot: cache.read,
  writeBakeSnapshot: cache.write,
  readModelCache: cache.readModels,
  writeModelCache: cache.writeModels
}))

afterEach(() => vi.unstubAllGlobals())

async function worker() {
  vi.resetModules()
  const messages: BakeResponse[] = []
  const scope = {
    onmessage: null as ((event: { data: BakeRequest | ModelMessage }) => Promise<void>) | null,
    postMessage(message: BakeResponse, transfer: Transferable[]) {
      // Exercise the real ownership transfer: the worker loses these buffers.
      messages.push(structuredClone(message, { transfer }))
    }
  }
  vi.stubGlobal('self', scope)
  await import('../src/lib/island-bake.worker')
  return {
    messages,
    async bake(request: BakeRequest) {
      messages.length = 0
      await scope.onmessage?.({ data: structuredClone(request) })
      return structuredClone(messages)
    },
    // Starts a bake without waiting for it, as the page does.
    start(request: BakeRequest) {
      messages.length = 0
      return scope.onmessage?.({ data: structuredClone(request) })
    },
    send(message: ModelMessage) {
      return scope.onmessage?.({ data: message })
    }
  }
}

function worldRequest(serial = 1): BakeRequest {
  const world = createIsland(10, 10)
  world.ground.fill(GRASS)
  world.decor[55] = decorCode('rock')
  return { serial, ...world }
}

// Trees and palms across two chunks, so models are shared out and waited for.
function woodedRequest(): BakeRequest {
  const world = createIsland(20, 10)
  world.ground.fill(GRASS)
  for (const tile of [22, 26, 33, 45, 57, 64, 71, 88, 95, 116, 133, 147])
    world.decor[tile] = decorCode(tile % 3 ? 'tree' : 'palm')
  world.decor[150] = decorCode('rock')
  return { serial: 1, ...world, viewport: { left: 0, top: 0, right: 160, bottom: 160 } }
}

function setupCache() {
  cache.snapshot = null
  cache.writable = true
  cache.models = null
  cache.read.mockReset().mockImplementation(async () => ({
    snapshot: structuredClone(cache.snapshot),
    writable: cache.writable
  }))
  cache.write.mockReset().mockImplementation(async (snapshot: BakeSnapshot) => {
    cache.snapshot = structuredClone(snapshot)
  })
  cache.readModels.mockReset().mockImplementation(async () => ({
    cache: structuredClone(cache.models),
    writable: cache.writable
  }))
  cache.writeModels.mockReset().mockImplementation(async (models: ModelCache) => {
    cache.models = structuredClone(models)
  })
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 5))
  expect(check()).toBe(true)
}

// Chunks may come in another order when some wait for their models.
const byChunk = (messages: BakeResponse[]) =>
  new Map(
    messages.flatMap((message) =>
      message.type === 'chunk' ? [[message.chunk.index, message.chunk] as const] : []
    )
  )

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
    expect(cache.writeModels).not.toHaveBeenCalled()
    // All cloning here belongs to the harness's incoming message and transfers;
    // there must be no extra cloning of individual chunks for a disabled cache.
    expect(chunkClones).toHaveLength(0)
  })
})

describe('island worker helpers', () => {
  it('asks for the models it lacks and bakes the same island from those handed back', async () => {
    setupCache()
    cache.writable = false
    const alone = await (await worker()).bake(woodedRequest())
    const shared = await worker()
    const bake = shared.start({ ...woodedRequest(), helpers: true })
    await until(() => shared.messages.some((message) => message.type === 'need'))
    const need = shared.messages.find((message) => message.type === 'need')
    if (need?.type !== 'need') throw new Error('No models were asked for')
    expect(need.keys.length).toBeGreaterThan(3)
    expect(new Set(need.keys).size).toBe(need.keys.length)
    // Nothing that reads a model can be baked before it comes.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(shared.messages.some((message) => message.type === 'done')).toBe(false)
    // Handed back out of order, as helpers finish.
    for (const key of [...need.keys].reverse()) {
      const model = bakeModel(key)
      await shared.send({ type: 'model', model })
    }
    await bake
    expect(shared.messages.at(-1)?.type).toBe('done')
    expect(byChunk(shared.messages)).toEqual(byChunk(alone))
  }, 30_000)

  it('bakes the rest itself when the helpers are lost', async () => {
    setupCache()
    cache.writable = false
    const alone = await (await worker()).bake(woodedRequest())
    const shared = await worker()
    const bake = shared.start({ ...woodedRequest(), helpers: true })
    await until(() => shared.messages.some((message) => message.type === 'need'))
    const need = shared.messages.find((message) => message.type === 'need')
    if (need?.type !== 'need') throw new Error('No models were asked for')
    await shared.send({ type: 'model', model: bakeModel(need.keys[0]) })
    await shared.send({ type: 'models-unavailable' })
    await bake
    expect(byChunk(shared.messages)).toEqual(byChunk(alone))
  }, 30_000)

  it('bakes models as a helper and hands each one over', async () => {
    const helper = await worker()
    const keys = ['rock:0:0', 'tree:1:2']
    await helper.send({ type: 'models', keys })
    expect(helper.messages).toEqual(keys.map((key) => ({ type: 'model', model: bakeModel(key) })))
  })

  it('keeps models for the next visit and asks for none it already has', async () => {
    setupCache()
    const first = await worker()
    await first.bake(woodedRequest())
    expect(cache.writeModels).toHaveBeenCalledOnce()
    // The island changed since: its snapshot no longer fits, the models still do.
    cache.snapshot = null
    const next = await worker()
    const messages = await next.bake({ ...woodedRequest(), helpers: true })
    expect(messages.some((message) => message.type === 'need')).toBe(false)
    expect(messages.at(-1)?.type).toBe('done')
    expect(cache.writeModels).toHaveBeenCalledOnce()
  }, 30_000)
})
