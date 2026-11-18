// Pictures for the editing palette, drawn the way the island itself is drawn:
// decorations from their baked models, grounds from their lit texels, so what
// the palette shows is what lands on the island.

import { hex, islandPalette, type PixelBuffer, type Rgba } from './island-art'
import { bakeTemplate, flatGroundSlot } from './island-bake'
import { decorModel } from './island-models'
import { palette } from './island-palette'
import { type DecorKind, HOTSPRING, type LandGround, SHALLOWS, SWAMP } from './island-world'

// A decoration's look as it stands on the island, cropped to its outline.
export function decorThumbnail(kind: DecorKind, look: number): PixelBuffer {
  const t = bakeTemplate(decorModel(kind, look))
  let x0 = Number.POSITIVE_INFINITY
  let y0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  let y1 = Number.NEGATIVE_INFINITY
  for (let i = 0; i < t.count; i++) {
    x0 = Math.min(x0, t.x[i])
    y0 = Math.min(y0, t.y[i])
    x1 = Math.max(x1, t.x[i])
    y1 = Math.max(y1, t.y[i])
  }
  if (t.count === 0) return { width: 1, height: 1, data: new Uint8ClampedArray(4) }
  const width = x1 - x0 + 1
  const height = y1 - y0 + 1
  const data = new Uint8ClampedArray(width * height * 4)
  // Each pixel holds one point, the surface or the rim beside it.
  for (let i = 0; i < t.count; i++) {
    const color = palette[t.slot[i]]
    const at = ((t.y[i] - y0) * width + (t.x[i] - x0)) * 4
    data[at] = color.r
    data[at + 1] = color.g
    data[at + 2] = color.b
    data[at + 3] = 255
  }
  return { width, height, data }
}

// Open water in pools is the water shader's: its body color, with one wavelet
// (a bright dash over a line of shadow) so it reads as water.
const poolWater: Partial<Record<LandGround, { base: Rgba; shine: Rgba; deep: Rgba }>> = {
  [SWAMP]: {
    base: hex(islandPalette.lake),
    shine: hex(islandPalette.lakeShine),
    deep: hex(islandPalette.lakeDeep)
  },
  [SHALLOWS]: {
    base: hex(islandPalette.shoal),
    shine: hex(islandPalette.shoalShine),
    deep: hex(islandPalette.shoalDeep)
  },
  [HOTSPRING]: {
    base: hex(islandPalette.spring),
    shine: hex(islandPalette.springShine),
    deep: hex(islandPalette.springDeep)
  }
}

// How far around the origin to look for the window that best sums up a ground.
const SEARCH = 64

// A `size`-pixel square of a ground lying open and flat in full sun. Of the
// windows nearby, the one whose mix of colors is closest to the whole area's
// is taken: a typical patch, neither bare nor caught on a rare detail.
export function groundThumbnail(ground: LandGround, size: number): PixelBuffer {
  const span = SEARCH + size
  const slots = new Int32Array(span * span)
  const overall = new Map<number, number>()
  for (let y = 0; y < span; y++)
    for (let x = 0; x < span; x++) {
      const slot = flatGroundSlot(ground, x, y) ?? -1
      slots[y * span + x] = slot
      overall.set(slot, (overall.get(slot) ?? 0) + 1 / (span * span))
    }
  let best = { x: 0, y: 0, distance: Number.POSITIVE_INFINITY }
  for (let oy = 0; oy <= SEARCH; oy++)
    for (let ox = 0; ox <= SEARCH; ox++) {
      const share = new Map<number, number>()
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const slot = slots[(oy + y) * span + ox + x]
          share.set(slot, (share.get(slot) ?? 0) + 1 / (size * size))
        }
      let distance = 0
      for (const [slot, part] of overall) distance += Math.abs(part - (share.get(slot) ?? 0))
      if (distance < best.distance) best = { x: ox, y: oy, distance }
    }
  const water = poolWater[ground]
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const slot = slots[(best.y + y) * span + best.x + x]
      let rgba: Rgba
      if (slot >= 0) {
        const color = palette[slot]
        rgba = [color.r, color.g, color.b, 255]
      } else if (water) {
        const dash = x >= 2 && x < 2 + Math.ceil(size / 2)
        rgba =
          y === Math.floor(size / 3) && dash
            ? water.shine
            : y === Math.floor(size / 3) + 1 && dash && x > 2
              ? water.deep
              : water.base
      } else rgba = [0, 0, 0, 0]
      data.set(rgba, (y * size + x) * 4)
    }
  return { width: size, height: size, data }
}
