// Bakes the island's points off the main thread. Each message carries the whole
// island as it now is; the baker works out what changed and answers with new
// heights, the chunks it baked again, and `done`.

import { type BakedChunk, IslandBaker } from './island-bake'

export type BakeRequest = {
  serial: number
  columns: number
  rows: number
  ground: Uint8Array
  decor: Uint8Array
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

scope.onmessage = (event: MessageEvent<BakeRequest>) => {
  const { serial, columns, rows, ground, decor } = event.data
  try {
    if (!baker || baker.columns !== columns || baker.rows !== rows)
      baker = new IslandBaker(columns, rows)
    const change = baker.update(ground, decor)
    if (change) {
      const heights = baker.heightRect(change.rect)
      post({ type: 'heights', serial, rect: change.rect, heights }, [heights.buffer])
      for (const index of change.chunks) {
        const chunk = baker.bakeChunk(index)
        post({ type: 'chunk', serial, chunk }, [
          chunk.terrain.position.buffer,
          chunk.terrain.color.buffer,
          chunk.decor.position.buffer,
          chunk.decor.color.buffer,
          chunk.decor.anim.buffer
        ])
      }
    }
    post({ type: 'done', serial })
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

function post(message: BakeResponse, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer)
}
