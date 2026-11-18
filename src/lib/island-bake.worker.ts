// Bakes the island's points off the main thread. Each message carries the whole
// island as it now is; the baker works out what changed and answers with new
// heights, the chunks it baked again, and `done`.

import { type BakedChunk, IslandBaker, prioritizeChunks } from './island-bake'
import { matchesBakeSnapshot, readBakeSnapshot, writeBakeSnapshot } from './island-bake-cache'

export type BakeRequest = {
  serial: number
  columns: number
  rows: number
  ground: Uint8Array
  decor: Uint8Array
  viewport?: { left: number; top: number; right: number; bottom: number }
}
export type BakeResponse =
  | {
      type: 'heights'
      serial: number
      rect: { x: number; y: number; width: number; height: number }
      heights: Float32Array
    }
  | { type: 'chunk'; serial: number; chunk: BakedChunk }
  | { type: 'done'; serial: number }
  | { type: 'error'; message: string }

// Typed by hand: the project's DOM types and the worker's do not mix.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BakeRequest>) => void) | null
  postMessage: (message: BakeResponse, transfer: Transferable[]) => void
}
let baker: IslandBaker | null = null

scope.onmessage = async (event: MessageEvent<BakeRequest>) => {
  const { serial, columns, rows, ground, decor, viewport } = event.data
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
    // Start disk access before preparing heights. Arm the timeout only when
    // yielding below: CPU work must not consume the cache's I/O allowance.
    const cacheRead = initial ? readBakeSnapshot() : null
    if (!baker || baker.columns !== columns || baker.rows !== rows)
      baker = new IslandBaker(columns, rows)
    const change = baker.update(ground, decor)
    if (change) {
      const heights = baker.heightRect(change.rect)
      post({ type: 'heights', serial, rect: change.rect, heights }, [heights.buffer])
      const cache = cacheRead
        ? await Promise.race([
            cacheRead,
            new Promise<{ snapshot: null; writable: false }>((resolve) =>
              setTimeout(() => resolve({ snapshot: null, writable: false }), 150)
            )
          ])
        : { snapshot: null, writable: false }
      const cached = cache.snapshot
      const cachedChunks = matchesBakeSnapshot(cached, version, columns, rows, ground, decor)
        ? new Map(cached.chunks.map((chunk) => [chunk.index, chunk]))
        : null
      const save = initial && cache.writable && !cachedChunks
      const snapshot: BakedChunk[] = []
      const { chunks } = prioritizeChunks(change.chunks, baker.chunkColumns, viewport)
      for (const index of chunks) {
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
    post({ type: 'done', serial })
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

function post(message: BakeResponse, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer)
}
