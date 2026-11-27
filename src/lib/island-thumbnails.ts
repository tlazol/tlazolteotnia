// Pictures for the editing palette, drawn the way the island itself is drawn:
// decorations ray-marched from their models, grounds from their lit texels, so what
// the palette shows is what lands on the island.

import { groundTextures, hex, islandPalette, type PixelBuffer, type Rgba } from './island-art'
import { raymarchDecor } from './island-decor-raymarch'
import { type GlassShade, glassFacets } from './island-lamp-glass'
import { decorModel } from './island-models'
import { palette, slotOnRamp } from './island-palette'
import { type DecorKind, HOTSPRING, type LandGround, SHALLOWS, SWAMP } from './island-world'

// A decoration's look as it stands on the island, cropped to its outline.
export function decorThumbnail(kind: DecorKind, look: number): PixelBuffer {
  const model = decorModel(kind, look)
  const t = raymarchDecor(model)
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
  for (const shade of model.shades ?? []) {
    for (const { corners } of glassFacets(shade)) {
      for (const [x, y, z] of corners) {
        x0 = Math.min(x0, Math.floor(x))
        x1 = Math.max(x1, Math.ceil(x))
        y0 = Math.min(y0, Math.floor(y - z))
        y1 = Math.max(y1, Math.ceil(y - z))
      }
    }
  }
  if (t.count === 0) return { width: 1, height: 1, data: new Uint8ClampedArray(4) }
  const width = x1 - x0 + 1
  const height = y1 - y0 + 1
  const data = new Uint8ClampedArray(width * height * 4)
  const depth = model.shades && new Float32Array(width * height).fill(-Infinity)
  // Each pixel holds one point, the surface or the rim beside it.
  for (let i = 0; i < t.count; i++) {
    const color = palette[t.slot[i]]
    const at = ((t.y[i] - y0) * width + (t.x[i] - x0)) * 4
    data[at] = color.r
    data[at + 1] = color.g
    data[at + 2] = color.b
    data[at + 3] = 255
    if (depth) depth[at / 4] = t.depth[i]
  }
  const image = { width, height, data }
  if (depth && model.shades)
    for (const shade of model.shades) drawGlass(image, depth, x0, y0, shade)
  return image
}

// Composite the front pane over the bulb in the ray-marcher's x, y-z projection.
// Opaque hardware in front of a pane keeps its ray-marched color.
function drawGlass(
  image: PixelBuffer,
  depth: Float32Array,
  x0: number,
  y0: number,
  shade: GlassShade
) {
  for (const { corners, rgb, opacity } of glassFacets(shade)) {
    const points = corners.map(([x, y, z]) => ({ x: x - x0, y: y - z - y0, depth: y + z }))
    const a = points[0],
      b = points[1],
      c = points[2]
    const abx = b.x - a.x,
      aby = b.y - a.y,
      acx = c.x - a.x,
      acy = c.y - a.y
    const area = abx * acy - aby * acx
    if (area <= 0.00001) continue
    const left = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x))))
    const top = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))))
    const right = Math.min(image.width, Math.ceil(Math.max(...points.map((p) => p.x))))
    const bottom = Math.min(image.height, Math.ceil(Math.max(...points.map((p) => p.y))))
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++) {
        const px = x + 0.5,
          py = y + 0.5
        if (
          points.some((p, i) => {
            const q = points[(i + 1) % 4]
            return (q.x - p.x) * (py - p.y) - (q.y - p.y) * (px - p.x) < 0
          })
        )
          continue
        const u = ((px - a.x) * acy - (py - a.y) * acx) / area
        const v = (abx * (py - a.y) - aby * (px - a.x)) / area
        const index = y * image.width + x
        if (a.depth + u * (b.depth - a.depth) + v * (c.depth - a.depth) < depth[index]) continue
        const at = index * 4
        const behind = (image.data[at + 3] / 255) * (1 - opacity)
        const alpha = opacity + behind
        for (let k = 0; k < 3; k++)
          image.data[at + k] = (255 * rgb[k] * opacity + image.data[at + k] * behind) / alpha
        image.data[at + 3] = 255 * alpha
      }
  }
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
  const { pixel, ramp } = groundTextures[ground]
  const span = SEARCH + size
  const slots = new Int32Array(span * span)
  const overall = new Map<number, number>()
  for (let y = 0; y < span; y++)
    for (let x = 0; x < span; x++) {
      const [r, g, b, alpha] = pixel(x, y)
      const slot = alpha ? slotOnRamp(r, g, b, ramp) : -1
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
