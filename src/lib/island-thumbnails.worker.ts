// Draws the editing palette's pictures off the main thread: baking every look
// of every decoration takes the better part of a second. Grounds are answered
// first, all at once, then each decoration kind as soon as its looks are drawn,
// in the order asked.

import type { PixelBuffer } from './island-art'
import { decorThumbnail, groundThumbnail } from './island-thumbnails'
import { type DecorKind, decorLooks, type LandGround } from './island-world'

export type ThumbnailRequest = { grounds: LandGround[]; groundSize: number; kinds: DecorKind[] }
export type ThumbnailResponse =
  | { type: 'grounds'; grounds: Array<[LandGround, PixelBuffer]> }
  | { type: 'decor'; kind: DecorKind; looks: PixelBuffer[] }
  | { type: 'error'; message: string }

// Typed by hand: the project's DOM types and the worker's do not mix.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ThumbnailRequest>) => void) | null
  postMessage: (message: ThumbnailResponse, transfer: Transferable[]) => void
}

scope.onmessage = (event: MessageEvent<ThumbnailRequest>) => {
  const { grounds, groundSize, kinds } = event.data
  try {
    const swatches = grounds.map((ground): [LandGround, PixelBuffer] => [
      ground,
      groundThumbnail(ground, groundSize)
    ])
    scope.postMessage(
      { type: 'grounds', grounds: swatches },
      swatches.map(([, { data }]) => data.buffer)
    )
    for (const kind of kinds) {
      const looks = Array.from({ length: decorLooks[kind] }, (_, look) =>
        decorThumbnail(kind, look)
      )
      scope.postMessage(
        { type: 'decor', kind, looks },
        looks.map(({ data }) => data.buffer)
      )
    }
  } catch (error) {
    scope.postMessage(
      { type: 'error', message: error instanceof Error ? error.message : String(error) },
      []
    )
  }
}
