// Pictures for the editing palette, drawn the way the island itself is drawn:
// decorations from the same voxel mesh, lit by the same sun and seen from the
// same corner, grounds from their lit texels, so what the palette shows is
// what lands on the island.

import { groundTextures, hex, islandPalette, type PixelBuffer, type Rgba } from './island-art'
import { type GlassShade, glassFacets } from './island-lamp-glass'
import { decorModel } from './island-models'
import { palette, slotOnRamp, surfaceEmission } from './island-palette'
import { decorVoxelStep, voxelSurface } from './island-voxels'
import { type DecorKind, HOTSPRING, type LandGround, SHALLOWS, SWAMP } from './island-world'

type Vec3 = readonly [number, number, number]
const unit = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

// The island's default view, from the south-east corner at its pitch: one art
// pixel per world unit, y growing down the screen. Depth grows toward the eye.
const PITCH_SIN = 0.6
const PITCH_COS = 0.8
const project = (x: number, y: number, z: number) => ({
  x: (x - y) * Math.SQRT1_2,
  y: PITCH_SIN * (x + y) * Math.SQRT1_2 - PITCH_COS * z,
  depth: PITCH_COS * (x + y) * Math.SQRT1_2 + PITCH_SIN * z
})

// The island's lights: an ambient fill and a sun from the south-west, high up,
// on a Lambert surface, as three.js shades the decorations.
const AMBIENT = 1.85
const SUN = 1.65
const TO_SUN = unit(-390, 280, 740)
// Two axes across the sunbeam, for the shadow map.
const SUN_U = unit(TO_SUN[1], -TO_SUN[0], 0)
const SUN_V: Vec3 = [
  TO_SUN[1] * SUN_U[2] - TO_SUN[2] * SUN_U[1],
  TO_SUN[2] * SUN_U[0] - TO_SUN[0] * SUN_U[2],
  TO_SUN[0] * SUN_U[1] - TO_SUN[1] * SUN_U[0]
]
const dot = (a: Vec3, x: number, y: number, z: number) => a[0] * x + a[1] * y + a[2] * z
const SHADOW_TEXEL = 0.5

type Corner = { x: number; y: number; depth: number }

// Calls `fill` for every pixel centre inside the triangle, with its weights.
function rasterize(
  a: Corner,
  b: Corner,
  c: Corner,
  width: number,
  height: number,
  fill: (index: number, wa: number, wb: number, wc: number) => void
) {
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  if (Math.abs(area) < 1e-9) return
  const left = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)))
  const top = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)))
  const right = Math.min(width, Math.ceil(Math.max(a.x, b.x, c.x)))
  const bottom = Math.min(height, Math.ceil(Math.max(a.y, b.y, c.y)))
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const wa = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area
      const wb = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area
      const wc = 1 - wa - wb
      if (wa < 0 || wb < 0 || wc < 0) continue
      fill(y * width + x, wa, wb, wc)
    }
}

// A decoration's look as it stands on the island, cropped to its outline.
export function decorThumbnail(kind: DecorKind, look: number): PixelBuffer {
  const model = decorModel(kind, look)
  const surface = voxelSurface(model, decorVoxelStep(kind), { glow: true })
  const { position, normal, slots, indices } = surface
  const glow = surface.glow ?? new Uint8Array(slots.length)
  const vertexCount = position.length / 3
  if (!indices.length) return { width: 1, height: 1, data: new Uint8ClampedArray(4) }

  // Screen and sunbeam coordinates of every vertex, and the bounds of both.
  const screen: Corner[] = []
  const beam: Corner[] = []
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  let u0 = Infinity,
    v0 = Infinity,
    u1 = -Infinity,
    v1 = -Infinity
  for (let i = 0; i < vertexCount; i++) {
    const x = position[i * 3],
      y = position[i * 3 + 1],
      z = position[i * 3 + 2]
    const p = project(x, y, z)
    screen.push(p)
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
    const s = { x: dot(SUN_U, x, y, z), y: dot(SUN_V, x, y, z), depth: dot(TO_SUN, x, y, z) }
    beam.push(s)
    u0 = Math.min(u0, s.x)
    v0 = Math.min(v0, s.y)
    u1 = Math.max(u1, s.x)
    v1 = Math.max(v1, s.y)
  }
  for (const shade of model.shades ?? [])
    for (const { corners } of glassFacets(shade))
      for (const [x, y, z] of corners) {
        const p = project(x, y, z)
        x0 = Math.min(x0, p.x)
        y0 = Math.min(y0, p.y)
        x1 = Math.max(x1, p.x)
        y1 = Math.max(y1, p.y)
      }
  x0 = Math.floor(x0)
  y0 = Math.floor(y0)
  const width = Math.ceil(x1) - x0
  const height = Math.ceil(y1) - y0
  for (const p of screen) {
    p.x -= x0
    p.y -= y0
  }

  // What the sun sees: the nearest surface to it along each beam.
  const shadowWidth = Math.ceil((u1 - u0) / SHADOW_TEXEL) + 1
  const shadowHeight = Math.ceil((v1 - v0) / SHADOW_TEXEL) + 1
  const shadow = new Float32Array(shadowWidth * shadowHeight).fill(-Infinity)
  const texel = beam.map((s) => ({
    x: (s.x - u0) / SHADOW_TEXEL,
    y: (s.y - v0) / SHADOW_TEXEL,
    depth: s.depth
  }))
  for (let t = 0; t < indices.length; t += 3) {
    const a = texel[indices[t]],
      b = texel[indices[t + 1]],
      c = texel[indices[t + 2]]
    rasterize(a, b, c, shadowWidth, shadowHeight, (index, wa, wb, wc) => {
      shadow[index] = Math.max(shadow[index], wa * a.depth + wb * b.depth + wc * c.depth)
    })
  }
  const step = Math.max(...[0, 1, 2].map((k) => Math.abs(position[3 + k] - position[k])))
  const sunlit = (x: number, y: number, z: number) => {
    const u = Math.floor((dot(SUN_U, x, y, z) - u0) / SHADOW_TEXEL)
    const v = Math.floor((dot(SUN_V, x, y, z) - v0) / SHADOW_TEXEL)
    if (u < 0 || v < 0 || u >= shadowWidth || v >= shadowHeight) return true
    return shadow[v * shadowWidth + u] <= dot(TO_SUN, x, y, z) + step * 0.35
  }

  const data = new Uint8ClampedArray(width * height * 4)
  const depth = new Float32Array(width * height).fill(-Infinity)
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t],
      ib = indices[t + 1],
      ic = indices[t + 2]
    const nx = normal[ia * 3],
      ny = normal[ia * 3 + 1],
      nz = normal[ia * 3 + 2]
    // Faces turned from the eye are hidden behind the ones turned to it.
    if (project(nx, ny, nz).depth <= 0) continue
    const slot = slots[ia]
    const color = palette[slot]
    const facing = Math.max(0, dot(TO_SUN, nx, ny, nz))
    const emission = glow[ia] ? 1 : surfaceEmission(slot)
    const a = screen[ia],
      b = screen[ib],
      c = screen[ic]
    rasterize(a, b, c, width, height, (index, wa, wb, wc) => {
      const d = wa * a.depth + wb * b.depth + wc * c.depth
      if (d <= depth[index]) return
      depth[index] = d
      let light = AMBIENT
      if (facing > 0) {
        // Lift the point off its face so it does not shade itself.
        const at = (k: number) =>
          wa * position[ia * 3 + k] + wb * position[ib * 3 + k] + wc * position[ic * 3 + k]
        const lift = step * 0.25
        if (sunlit(at(0) + nx * lift, at(1) + ny * lift, at(2) + nz * lift)) light += SUN * facing
      }
      const shade = (1 - emission) * (light / Math.PI) + emission
      const out = index * 4
      data[out] = color.r * shade
      data[out + 1] = color.g * shade
      data[out + 2] = color.b * shade
      data[out + 3] = 255
    })
  }
  const image = { width, height, data }
  for (const shade of model.shades ?? []) drawGlass(image, depth, x0, y0, shade)
  return trim(image)
}

// Crops away the empty margin a sliver thinner than a pixel can leave.
function trim(image: PixelBuffer): PixelBuffer {
  const { width, height, data } = image
  let left = width,
    top = height,
    right = -1,
    bottom = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3]) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
  if (right < 0) return { width: 1, height: 1, data: new Uint8ClampedArray(4) }
  const w = right - left + 1
  const h = bottom - top + 1
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    out.set(
      data.subarray(((top + y) * width + left) * 4, ((top + y) * width + left + w) * 4),
      y * w * 4
    )
  return { width: w, height: h, data: out }
}

// Composite each pane over what is drawn behind it, in the island's projection.
// Opaque hardware in front of a pane keeps its color.
function drawGlass(
  image: PixelBuffer,
  depth: Float32Array,
  x0: number,
  y0: number,
  shade: GlassShade
) {
  for (const { corners, rgb, opacity } of glassFacets(shade)) {
    const points = corners.map(([x, y, z]) => {
      const p = project(x, y, z)
      return { x: p.x - x0, y: p.y - y0, depth: p.depth }
    })
    for (const [a, b, c] of [
      [points[0], points[1], points[2]],
      [points[0], points[2], points[3]]
    ])
      rasterize(a, b, c, image.width, image.height, (index, wa, wb, wc) => {
        if (wa * a.depth + wb * b.depth + wc * c.depth < depth[index]) return
        const at = index * 4
        const behind = (image.data[at + 3] / 255) * (1 - opacity)
        const alpha = opacity + behind
        for (let k = 0; k < 3; k++)
          image.data[at + k] = (255 * rgb[k] * opacity + image.data[at + k] * behind) / alpha
        image.data[at + 3] = 255 * alpha
      })
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
