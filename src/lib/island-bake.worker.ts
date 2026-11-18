// Bakes the island's points off the main thread. Each message carries the whole
// island as it now is; the baker works out what changed and answers with new
// heights, the chunks it baked again, and `done`.
//
// Decoration models cost the most and do not depend on the island, so on the
// first bake the baker asks for the ones it has not cached (`need`). The page
// shares them out among helper copies of this worker (`models`) and passes
// each one back here as it is baked (`model`). Chunks wait only for the models
// they read; if the helpers are gone (`models-unavailable`) the baker makes the
// rest itself.

import {
  BAKE_CHUNK,
  type BakedChunk,
  type BakedModel,
  bakeModel,
  IslandBaker,
  modelBuffers,
  modelKeysByPriority,
  prioritizeChunks
} from './island-bake'
import {
  cachedModels,
  matchesBakeSnapshot,
  readBakeSnapshot,
  readModelCache,
  writeBakeSnapshot,
  writeModelCache
} from './island-bake-cache'
import { TILE_SIZE } from './island-world'

export type BakeRequest = {
  serial: number
  columns: number
  rows: number
  ground: Uint8Array
  decor: Uint8Array
  viewport?: { left: number; top: number; right: number; bottom: number }
  // Whether the page can bake models in helpers for this request.
  helpers?: boolean
}
export type ModelMessage =
  // To a helper: bake these models.
  | { type: 'models'; keys: string[] }
  // To the baker: a model a helper baked.
  | { type: 'model'; model: BakedModel }
  // To the baker: no more models will come from helpers.
  | { type: 'models-unavailable' }
export type BakeResponse =
  | {
      type: 'heights'
      serial: number
      rect: { x: number; y: number; width: number; height: number }
      heights: Float32Array
    }
  | { type: 'chunk'; serial: number; chunk: BakedChunk }
  | { type: 'need'; serial: number; keys: string[] }
  | { type: 'model'; model: BakedModel }
  | { type: 'done'; serial: number }
  | { type: 'error'; message: string }

// Typed by hand: the project's DOM types and the worker's do not mix.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BakeRequest | ModelMessage>) => void) | null
  postMessage: (message: BakeResponse, transfer: Transferable[]) => void
}
let baker: IslandBaker | null = null
// Models asked of the helpers and not yet here, and a bake waiting for the next.
const expected = new Set<string>()
let arrival: (() => void) | null = null

function settleWaiters() {
  arrival?.()
  arrival = null
}

const nextArrival = () =>
  new Promise<void>((resolve) => {
    arrival = resolve
  })

// A message to itself: queued behind any already waiting, without the delay
// nested timers get.
let yieldChannel: MessageChannel | null = null
const yieldToMessages = () =>
  new Promise<void>((resolve) => {
    yieldChannel ??= new MessageChannel()
    yieldChannel.port1.onmessage = () => resolve()
    yieldChannel.port2.postMessage(null)
  })

const awaitsModels = (keys: Set<string>) => {
  for (const key of keys) if (expected.has(key)) return true
  return false
}

function receive(message: ModelMessage) {
  if (message.type === 'models') {
    // A helper: bake each model in turn and hand it over.
    for (const key of message.keys) {
      const model = bakeModel(key)
      post({ type: 'model', model }, modelBuffers(model))
    }
    return
  }
  if (message.type === 'model') {
    baker?.addModel(message.model)
    expected.delete(message.model.key)
  } else expected.clear()
  settleWaiters()
}

const withTimeout = <T>(promise: Promise<T>, fallback: T, ms = 150) =>
  Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))])

scope.onmessage = async (event: MessageEvent<BakeRequest | ModelMessage>) => {
  if ('type' in event.data) {
    try {
      receive(event.data)
    } catch (error) {
      post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  const { serial, columns, rows, ground, decor, viewport, helpers } = event.data
  try {
    const initial = !baker
    // Production workers have content-hashed URLs. Vite's development module
    // URLs include dependency timestamps, so art edits invalidate the cache too.
    const version =
      import.meta.url +
      (import.meta.env.DEV
        ? performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .sort()
            .join('|')
        : '')
    // Start disk access before preparing heights. Arm the snapshot's timeout
    // only when yielding below: CPU work must not consume its I/O allowance.
    const cacheRead = initial ? readBakeSnapshot() : null
    const modelRead = initial ? readModelCache() : null
    if (!baker || baker.columns !== columns || baker.rows !== rows)
      baker = new IslandBaker(columns, rows)
    let modelsWritable = false
    let modelsLoaded = 0
    if (modelRead) {
      // Models first: the helpers should start on the missing ones while the
      // heights are prepared here.
      const models = await withTimeout(modelRead, { cache: null, writable: false })
      modelsWritable = models.writable
      for (const model of cachedModels(models.cache, version)) baker.addModel(model)
      modelsLoaded = baker.models().length
      if (helpers) {
        const chunkColumns = Math.ceil((columns * TILE_SIZE) / BAKE_CHUNK)
        const chunkRows = Math.ceil((rows * TILE_SIZE) / BAKE_CHUNK)
        const all = Array.from({ length: chunkColumns * chunkRows }, (_, i) => i)
        const order = prioritizeChunks(all, chunkColumns, viewport).chunks
        const keys = modelKeysByPriority(columns, decor, chunkColumns, order).filter(
          (key) => !baker?.hasModel(key)
        )
        for (const key of keys) expected.add(key)
        if (keys.length) post({ type: 'need', serial, keys })
      }
    }
    const change = baker.update(ground, decor)
    if (change) {
      const heights = baker.heightRect(change.rect)
      post({ type: 'heights', serial, rect: change.rect, heights }, [heights.buffer])
      const cache = cacheRead
        ? await withTimeout(cacheRead, { snapshot: null, writable: false })
        : { snapshot: null, writable: false }
      const cached = cache.snapshot
      const cachedChunks = matchesBakeSnapshot(cached, version, columns, rows, ground, decor)
        ? new Map(cached.chunks.map((chunk) => [chunk.index, chunk]))
        : null
      const save = initial && cache.writable && !cachedChunks
      const snapshot: BakedChunk[] = []
      const pending = prioritizeChunks(change.chunks, baker.chunkColumns, viewport).chunks
      const reads = new Map<number, Set<string>>()
      const modelsOf = (index: number) => {
        let keys = reads.get(index)
        if (!keys) {
          keys = baker?.chunkModels(index) ?? new Set()
          reads.set(index, keys)
        }
        return keys
      }
      while (pending.length) {
        // The first chunk in order that has all its models; while the helpers
        // are still at work, a later one may go ahead of one that waits.
        // Models that came in meanwhile are counted before choosing.
        if (!cachedChunks && expected.size) await yieldToMessages()
        const next =
          cachedChunks || !expected.size
            ? 0
            : pending.findIndex((index) => !awaitsModels(modelsOf(index)))
        if (next < 0) {
          await nextArrival()
          continue
        }
        const [index] = pending.splice(next, 1)
        const chunk = cachedChunks?.get(index) ?? baker.bakeChunk(index)
        if (save) snapshot.push(structuredClone(chunk))
        post({ type: 'chunk', serial, chunk }, [
          chunk.terrain.position.buffer,
          chunk.terrain.color.buffer,
          chunk.decor.position.buffer,
          chunk.decor.color.buffer,
          chunk.decor.anim.buffer
        ])
      }
      if (save)
        void writeBakeSnapshot({
          version,
          columns,
          rows,
          ground,
          decor,
          chunks: snapshot
        })
    }
    // Keep what was baked for the next visit, whatever the island looks like then.
    if (modelsWritable && baker.models().length > modelsLoaded)
      void writeModelCache({ version, models: baker.models() })
    post({ type: 'done', serial })
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

function post(message: BakeResponse, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer)
}
