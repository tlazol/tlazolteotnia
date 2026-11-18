// Turns the island into points: the ground and every decoration are distance
// functions, their surfaces are sampled once per screen pixel, and each point
// is lit in advance (sun, soft shadow, ambient occlusion) and given its color
// from a ramp. The renderer then only has to draw the points.
//
// The view looks down at the island from the south: a point at (x, y, z), with
// z up, lands on screen at column x, row y - z + REFERENCE_HEIGHT, and the
// larger y + z is, the nearer it is. Ground at the reference height lands on
// screen exactly where the flat map put it, so tiles are picked as before.

import { groundTexel, isPoolGround, terrainClass } from './island-art'
import { decorModel, type Model, modelDistance, nearestPart } from './island-models'
import {
  bayer,
  lightSteps,
  palette,
  type RampName,
  rimSlot,
  slotOnRamp,
  stepSlot
} from './island-palette'
import {
  BLACKSAND,
  BRICK,
  CLAY,
  CLOVER,
  COBBLE,
  DECK,
  DRYGRASS,
  decorInfo,
  decorKindOf,
  decorLookAt,
  GRASS,
  GRAVEL,
  GROUND_COUNT,
  HOTSPRING,
  type IslandWorld,
  LAVA,
  MOSS,
  MUD,
  PATH,
  ROCK,
  SAND,
  SHALLOWS,
  SOIL,
  STEPPING,
  SWAMP,
  TILE_SIZE,
  WATER,
  WHITESAND
} from './island-world'

export const REFERENCE_HEIGHT = 4
export const BAKE_CHUNK = 128
// Depths are stored in quarter pixels.
export const DEPTH_UNIT = 4
const DECK_HEIGHT = 4
const BOARD = 1.2
const SQRT2 = Math.SQRT2

// Sunlight from the north-west, high in the sky.
const SUN = (() => {
  const x = -0.35
  const y = -0.5
  const z = 1
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l] as const
})()

// How high each ground stands. Water lies at 0; pools are sunk to it too.
const groundHeight = new Float32Array(GROUND_COUNT)
for (const [ground, height] of [
  [SAND, 2],
  [WHITESAND, 2],
  [BLACKSAND, 2],
  [MUD, 2.5],
  [GRAVEL, 2.5],
  [SOIL, 3],
  [CLAY, 3],
  [PATH, 3.5],
  [GRASS, 4],
  [MOSS, 4],
  [CLOVER, 4],
  [DRYGRASS, 4],
  [STEPPING, 4],
  [COBBLE, 4],
  [BRICK, 4.5],
  [LAVA, 6],
  [ROCK, 7]
] as const)
  groundHeight[ground] = height
for (const pool of [SWAMP, SHALLOWS, HOTSPRING]) groundHeight[pool] = 0

// The ramp each ground's colors are read on.
const groundRamp: RampName[] = []
for (const [ground, ramp] of [
  [SAND, 'sand'],
  [WHITESAND, 'whiteSand'],
  [BLACKSAND, 'blackSand'],
  [MUD, 'mud'],
  [GRAVEL, 'gravel'],
  [SOIL, 'soil'],
  [CLAY, 'clay'],
  [PATH, 'path'],
  [GRASS, 'grass'],
  [MOSS, 'moss'],
  [CLOVER, 'clover'],
  [DRYGRASS, 'dryGrass'],
  [STEPPING, 'grass'],
  [COBBLE, 'cobble'],
  [BRICK, 'brick'],
  [LAVA, 'lava'],
  [ROCK, 'rock'],
  [DECK, 'deck'],
  [SWAMP, 'pad'],
  [SHALLOWS, 'sand'],
  [HOTSPRING, 'springBank']
] as const)
  groundRamp[ground] = ramp

// The palette slot a ground's texel is drawn in, before light moves it.
function groundSlot(kind: number, texel: readonly number[]) {
  return slotOnRamp(texel[0], texel[1], texel[2], groundRamp[kind] ?? 'sand')
}

// The palette slot of open, flat ground of `kind` at (px, py) in full sun, as
// the island draws it away from any edge; null where a pool's open water is
// left to the water shader.
export function flatGroundSlot(kind: number, px: number, py: number) {
  const texel = groundTexel(kind, px, py, () => kind, false)
  if (texel[3] === 0) return null
  // Full sun on flat ground leaves the color where it is.
  return stepSlot(groundSlot(kind, texel), lightSteps(shade(0, 0, 1, 1, 1), px, py))
}

export type PointSet = {
  // Screen column, screen row and depth (in DEPTH_UNIT) of each point.
  position: Int16Array
  color: Uint8Array
}
export type DecorPointSet = PointSet & {
  // Sway in pixels, bob in pixels, glow (0 none, 1 fire, 2 firefly), phase.
  anim: Float32Array
}
export type BakedGlow = { tile: number; x: number; y: number; soft: boolean }
export type BakedChunk = {
  index: number
  terrain: PointSet
  decor: DecorPointSet
  glows: BakedGlow[]
}

// ---- Lighting ---------------------------------------------------------------

function shade(nx: number, ny: number, nz: number, ao: number, shadow: number) {
  const sun = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) / SUN[2]
  return ao * (0.38 + 0.07 * nz) + 0.55 * sun * shadow
}

// ---- Decoration templates -------------------------------------------------------

export type Template = {
  count: number
  x: Int16Array
  y: Int16Array
  depth: Float32Array
  slot: Uint16Array
  sway: Float32Array
  glow: Uint8Array
}

function softShadow(
  distance: (x: number, y: number, z: number) => number,
  px: number,
  py: number,
  pz: number,
  far: number
) {
  let result = 1
  let t = 0.6
  for (let i = 0; i < 48 && t < far; i++) {
    const h = distance(px + SUN[0] * t, py + SUN[1] * t, pz + SUN[2] * t)
    if (h < 0.02) return 0
    result = Math.min(result, (5 * h) / t)
    t += Math.max(0.35, Math.min(h, 5))
  }
  return Math.max(0, Math.min(1, result))
}

function occlusion(
  distance: (x: number, y: number, z: number) => number,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number
) {
  let occluded = 0
  let weight = 1
  for (let i = 1; i <= 4; i++) {
    const h = i * 1.4
    occluded += (h - distance(px + nx * h, py + ny * h, pz + nz * h)) * weight
    weight *= 0.6
  }
  return Math.max(0, Math.min(1, 1 - occluded * 0.16))
}

// Samples a model's surface once per screen pixel, lights each point and adds
// a dark rim around the silhouette, as the hand-drawn sprites had.
export function bakeTemplate(m: Model): Template {
  const x0 = Math.floor(m.lo[0])
  const x1 = Math.ceil(m.hi[0])
  const y0 = Math.floor(m.lo[1] - m.hi[2])
  const y1 = Math.ceil(m.hi[1] - Math.max(m.lo[2], -0.5))
  const width = x1 - x0 + 2
  const height = y1 - y0 + 2
  const hit = new Int32Array(width * height).fill(-1)
  const xs: number[] = []
  const ys: number[] = []
  const depths: number[] = []
  const slots: number[] = []
  const sways: number[] = []
  const glows: number[] = []
  const outlined: boolean[] = []
  const distance = (x: number, y: number, z: number) => modelDistance(m, x, y, z)
  const ground = (x: number, y: number, z: number) => Math.min(distance(x, y, z), z)
  const top = Math.max(1, m.hi[2])
  for (let sx = x0; sx < x1; sx++) {
    for (let sy = y0; sy < y1; sy++) {
      const X = sx + 0.5
      const S = sy + 0.5
      const zTop = Math.min(m.hi[2], m.hi[1] - S)
      const zBottom = Math.max(m.lo[2], m.lo[1] - S, -0.5)
      if (zTop < zBottom) continue
      let z = zTop
      let found = false
      for (let i = 0; i < 128; i++) {
        const d = distance(X, S + z, z)
        if (d < 0.04) {
          found = true
          break
        }
        z -= Math.max(d * 0.7, 0.04) / SQRT2
        if (z < zBottom) break
      }
      if (!found) continue
      const Y = S + z
      const part = nearestPart(m, X, Y, z)
      const material = part.paint(X, Y, z)
      let slot = material.slot
      if (!material.glow) {
        const e = 0.3
        let nx = distance(X + e, Y, z) - distance(X - e, Y, z)
        let ny = distance(X, Y + e, z) - distance(X, Y - e, z)
        let nz = distance(X, Y, z + e) - distance(X, Y, z - e)
        const l = Math.hypot(nx, ny, nz) || 1
        nx /= l
        ny /= l
        nz /= l
        const ao = occlusion(ground, X, Y, z, nx, ny, nz)
        const lit = softShadow(distance, X + nx * 0.4, Y + ny * 0.4, z + nz * 0.4, 70)
        slot = stepSlot(slot, lightSteps(shade(nx, ny, nz, ao, lit), sx, sy))
      }
      hit[(sy - y0 + 1) * width + (sx - x0 + 1)] = xs.length
      xs.push(sx)
      ys.push(sy)
      depths.push(Y + z)
      slots.push(slot)
      sways.push(m.sway * Math.min(1, Math.max(0, z / top)) ** 2)
      glows.push(material.glow === 'fire' ? 1 : material.glow === 'firefly' ? 2 : 0)
      outlined.push(material.outline !== false)
    }
  }
  // The rim: empty pixels beside a drawn one, a little behind it.
  const rim: number[] = []
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (hit[gy * width + gx] >= 0) continue
      let best = -1
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nx = gx + dx
        const ny = gy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const index = hit[ny * width + nx]
        if (index >= 0 && outlined[index] && (best < 0 || depths[index] > depths[best]))
          best = index
      }
      if (best >= 0) rim.push(gx + x0 - 1, gy + y0 - 1, best)
    }
  }
  const count = xs.length + rim.length / 3
  const template: Template = {
    count,
    x: new Int16Array(count),
    y: new Int16Array(count),
    depth: new Float32Array(count),
    slot: new Uint16Array(count),
    sway: new Float32Array(count),
    glow: new Uint8Array(count)
  }
  for (let i = 0; i < xs.length; i++) {
    template.x[i] = xs[i]
    template.y[i] = ys[i]
    template.depth[i] = depths[i]
    template.slot[i] = slots[i]
    template.sway[i] = sways[i]
    template.glow[i] = glows[i]
  }
  for (let r = 0; r < rim.length; r += 3) {
    const i = xs.length + r / 3
    const source = rim[r + 2]
    template.x[i] = rim[r]
    template.y[i] = rim[r + 1]
    template.depth[i] = depths[source] - 1
    template.slot[i] = rimSlot(slots[source])
    template.sway[i] = sways[source]
  }
  return template
}

// ---- The baker --------------------------------------------------------------------

type Instance = {
  tile: number
  model: Model
  template: () => Template
  x: number
  y: number
  z: number
  lo: [number, number, number]
  hi: [number, number, number]
  water: boolean
}

export class IslandBaker {
  readonly width: number
  readonly height: number
  readonly columns: number
  readonly rows: number
  readonly chunkColumns: number
  readonly chunkRows: number
  private world: IslandWorld
  private classes: Uint8Array
  private raw: Float32Array
  private eroded: Float32Array
  readonly heights: Float32Array
  private instances = new Map<number, Instance>()
  private templates = new Map<Model, Template>()
  private started = false

  constructor(columns: number, rows: number) {
    this.columns = columns
    this.rows = rows
    this.width = columns * TILE_SIZE
    this.height = rows * TILE_SIZE
    this.chunkColumns = Math.ceil(this.width / BAKE_CHUNK)
    this.chunkRows = Math.ceil(this.height / BAKE_CHUNK)
    const size = this.width * this.height
    this.world = {
      columns,
      rows,
      ground: new Uint8Array(columns * rows),
      decor: new Uint8Array(columns * rows)
    }
    this.classes = new Uint8Array(size)
    this.raw = new Float32Array(size)
    this.eroded = new Float32Array(size)
    this.heights = new Float32Array(size)
  }

  // Takes the island as it now is and returns the chunks that need baking again
  // and the pixel rectangle whose heights changed, or null if nothing did.
  update(ground: Uint8Array, decor: Uint8Array) {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (let i = 0; i < ground.length; i++) {
      if (this.started && ground[i] === this.world.ground[i] && decor[i] === this.world.decor[i])
        continue
      const x = i % this.columns
      const y = Math.floor(i / this.columns)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    this.world.ground.set(ground)
    this.world.decor.set(decor)
    if (minX > maxX) return null
    this.started = true
    // Ground classes blend across a tile either side, heights round off over
    // two more pixels.
    const px0 = Math.max(0, (minX - 1) * TILE_SIZE)
    const py0 = Math.max(0, (minY - 1) * TILE_SIZE)
    const px1 = Math.min(this.width, (maxX + 2) * TILE_SIZE)
    const py1 = Math.min(this.height, (maxY + 2) * TILE_SIZE)
    this.computeClasses(px0, py0, px1, py1)
    const hx0 = Math.max(0, px0 - 2)
    const hy0 = Math.max(0, py0 - 2)
    const hx1 = Math.min(this.width, px1 + 2)
    const hy1 = Math.min(this.height, py1 + 2)
    this.computeHeights(hx0, hy0, hx1, hy1)
    for (let y = Math.max(0, minY - 2); y <= Math.min(this.rows - 1, maxY + 2); y++)
      for (let x = Math.max(0, minX - 2); x <= Math.min(this.columns - 1, maxX + 2); x++)
        this.placeInstance(y * this.columns + x)
    // Points depend on heights nearby, and on decorations whose shadows fall
    // to the south-east of them.
    const chunks: number[] = []
    const cx0 = Math.max(0, Math.floor((hx0 - 48) / BAKE_CHUNK))
    const cy0 = Math.max(0, Math.floor((hy0 - 48) / BAKE_CHUNK))
    const cx1 = Math.min(this.chunkColumns - 1, Math.floor((hx1 + 80) / BAKE_CHUNK))
    const cy1 = Math.min(this.chunkRows - 1, Math.floor((hy1 + 80) / BAKE_CHUNK))
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) chunks.push(cy * this.chunkColumns + cx)
    return { chunks, rect: { x: hx0, y: hy0, width: hx1 - hx0, height: hy1 - hy0 } }
  }

  heightRect(rect: { x: number; y: number; width: number; height: number }) {
    const out = new Float32Array(rect.width * rect.height)
    for (let y = 0; y < rect.height; y++)
      out.set(
        this.heights.subarray(
          (rect.y + y) * this.width + rect.x,
          (rect.y + y) * this.width + rect.x + rect.width
        ),
        y * rect.width
      )
    return out
  }

  private computeClasses(x0: number, y0: number, x1: number, y1: number) {
    const { world } = this
    const groundAt = (tx: number, ty: number) =>
      tx < 0 || ty < 0 || tx >= this.columns || ty >= this.rows
        ? WATER
        : world.ground[ty * this.columns + tx]
    for (let ty = Math.floor(y0 / TILE_SIZE); ty < Math.ceil(y1 / TILE_SIZE); ty++) {
      for (let tx = Math.floor(x0 / TILE_SIZE); tx < Math.ceil(x1 / TILE_SIZE); tx++) {
        // A tile among eight of the same ground is that ground all over.
        const own = groundAt(tx, ty)
        let uniform = true
        for (let dy = -1; dy <= 1 && uniform; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (groundAt(tx + dx, ty + dy) !== own) {
              uniform = false
              break
            }
        const left = Math.max(x0, tx * TILE_SIZE)
        const right = Math.min(x1, (tx + 1) * TILE_SIZE)
        const top = Math.max(y0, ty * TILE_SIZE)
        const bottom = Math.min(y1, (ty + 1) * TILE_SIZE)
        for (let y = top; y < bottom; y++)
          for (let x = left; x < right; x++)
            this.classes[y * this.width + x] = uniform ? own : terrainClass(world, x, y)
      }
    }
  }

  private classAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return WATER
    return this.classes[y * this.width + x]
  }

  // The ground's top, its shoulders rounded off: an opening (erode, then
  // dilate by a ball) of the stepped heights. Decks stand apart on stilts.
  private computeHeights(x0: number, y0: number, x1: number, y1: number) {
    const { width, height } = this
    const rawAt = (x: number, y: number) =>
      x < 0 || y < 0 || x >= width || y >= height ? 0 : this.raw[y * width + x]
    for (let y = Math.max(0, y0 - 2); y < Math.min(height, y1 + 2); y++)
      for (let x = Math.max(0, x0 - 2); x < Math.min(width, x1 + 2); x++) {
        const kind = this.classes[y * width + x]
        this.raw[y * width + x] = kind === DECK ? 0 : groundHeight[kind]
      }
    for (let y = Math.max(0, y0 - 1); y < Math.min(height, y1 + 1); y++)
      for (let x = Math.max(0, x0 - 1); x < Math.min(width, x1 + 1); x++) {
        let low = rawAt(x, y)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) low = Math.min(low, rawAt(x + dx, y + dy))
        this.eroded[y * width + x] = low
      }
    const erodedAt = (x: number, y: number) =>
      x < 0 || y < 0 || x >= width || y >= height ? 0 : this.eroded[y * width + x]
    const side = 1.5 - Math.sqrt(1.5 * 1.5 - 1)
    const corner = 1.5 - Math.sqrt(1.5 * 1.5 - 2)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (this.classes[y * width + x] === DECK) {
          this.heights[y * width + x] = DECK_HEIGHT
          continue
        }
        let high = erodedAt(x, y)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue
            high = Math.max(high, erodedAt(x + dx, y + dy) - (dx && dy ? corner : side))
          }
        this.heights[y * width + x] = Math.min(rawAt(x, y), high)
      }
  }

  // Height of the ground at a continuous point (pixel centers at +0.5).
  heightAt(x: number, y: number) {
    const u = x - 0.5
    const v = y - 0.5
    const ix = Math.floor(u)
    const iy = Math.floor(v)
    const fx = u - ix
    const fy = v - iy
    const at = (px: number, py: number) =>
      px < 0 || py < 0 || px >= this.width || py >= this.height
        ? 0
        : this.heights[py * this.width + px]
    const a = at(ix, iy)
    const b = at(ix + 1, iy)
    const c = at(ix, iy + 1)
    const d = at(ix + 1, iy + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }

  private placeInstance(tile: number) {
    this.instances.delete(tile)
    const code = this.world.decor[tile]
    const kind = decorKindOf(code)
    if (!kind) return
    const tx = tile % this.columns
    const ty = Math.floor(tile / this.columns)
    const look = decorLookAt(code, tx, ty) ?? 0
    const model = decorModel(kind, look)
    const water = decorInfo[kind].on === 'water'
    const x = tx * TILE_SIZE + TILE_SIZE / 2
    const y = ty * TILE_SIZE + TILE_SIZE - 2
    const z = water
      ? 0
      : Math.round(Math.max(this.heightAt(x + 0.5, y - 3.5), this.heightAt(x + 0.5, y + 0.5)))
    this.instances.set(tile, {
      tile,
      model,
      template: () => this.template(model),
      x,
      y,
      z,
      lo: [x + model.lo[0], y + model.lo[1], z + model.lo[2]],
      hi: [x + model.hi[0], y + model.hi[1], z + model.hi[2]],
      water
    })
  }

  private template(model: Model) {
    let found = this.templates.get(model)
    if (!found) {
      found = bakeTemplate(model)
      this.templates.set(model, found)
    }
    return found
  }

  bakeChunk(index: number): BakedChunk {
    const cx = index % this.chunkColumns
    const cy = Math.floor(index / this.chunkColumns)
    const X0 = cx * BAKE_CHUNK
    const Y0 = cy * BAKE_CHUNK
    const X1 = Math.min(this.width, X0 + BAKE_CHUNK)
    const Y1 = Math.min(this.height, Y0 + BAKE_CHUNK)
    return {
      index,
      terrain: this.bakeTerrain(X0, Y0, X1, Y1),
      ...this.bakeDecor(X0, Y0, X1, Y1)
    }
  }

  // Decorations that could shade or crowd points in the rectangle.
  private neighbors(x0: number, y0: number, x1: number, y1: number) {
    const near: Instance[] = []
    for (const instance of this.instances.values()) {
      // Their shadows fall away from the sun, as far as they are tall.
      const reach = instance.hi[2] - instance.z
      const sx = (-SUN[0] / SUN[2]) * reach
      const sy = (-SUN[1] / SUN[2]) * reach
      if (instance.hi[0] + sx + 8 < x0 || instance.lo[0] - 8 > x1) continue
      if (instance.hi[1] + sy + 8 < y0 || instance.lo[1] - 8 > y1) continue
      near.push(instance)
    }
    return near
  }

  private bakeTerrain(X0: number, Y0: number, X1: number, Y1: number): PointSet {
    const width = X1 - X0
    const top = Y0 - 12
    const rows = Y1 - Y0 + 24
    const best = new Float32Array(width * rows).fill(Number.NEGATIVE_INFINITY)
    const sampleY = new Float32Array(width * rows)
    const sampleZ = new Float32Array(width * rows)
    const sampleKind = new Uint8Array(width * rows)
    const sampleRow = new Int32Array(width * rows)
    const neighbors = this.neighbors(X0, Y0, X1, Y1)
    for (let x = X0; x < X1; x++) {
      for (let y = Y0; y < Y1; y++) {
        const k0 = this.classAt(x, y)
        const k1 = this.classAt(x, y + 1)
        const h0 = this.heights[y * this.width + x]
        const h1 = y + 1 < this.height ? this.heights[(y + 1) * this.width + x] : 0
        const s0 = y + 0.5 - h0
        const s1 = y + 1.5 - h1
        const steps = Math.max(1, Math.ceil((s1 - s0) / 0.5))
        const post = (x % TILE_SIZE) % 11 < 2
        for (let i = 0; i < steps; i++) {
          const t = i / steps
          let z = h0 + (h1 - h0) * t
          const kind = t < 0.5 || h0 > h1 + 0.5 ? k0 : k1
          if (kind === WATER) continue
          // Boards are thin: below them only the posts reach the water.
          if (k0 === DECK && k1 !== DECK && t > 0 && z < h0 - BOARD && !post) continue
          if (k1 === DECK && k0 !== DECK && kind !== DECK) continue
          if (isPoolGround(kind)) {
            if (t > 0) continue
            // Lily pads and reeds float just above the water.
            z = 0.35
          }
          const wy = y + 0.5 + t
          const sy = Math.floor(wy - z + REFERENCE_HEIGHT)
          const row = sy - top
          if (row < 0 || row >= rows) continue
          const depth = wy + z
          const slot = row * width + (x - X0)
          if (depth <= best[slot]) continue
          best[slot] = depth
          sampleY[slot] = wy
          sampleZ[slot] = z
          sampleKind[slot] = kind
          sampleRow[slot] = t < 0.5 ? y : y + 1
        }
      }
    }
    // Light what survived.
    const positions: number[] = []
    const colors: number[] = []
    // Marching toward the sun takes careful steps over steep ledges; occlusion
    // wants the plain height above the ground.
    const terrain = (x: number, y: number, z: number) => (z - this.heightAt(x, y)) * 0.5
    const above = (x: number, y: number, z: number) => z - this.heightAt(x, y)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < width; col++) {
        const slot = row * width + col
        if (best[slot] === Number.NEGATIVE_INFINITY) continue
        const sx = X0 + col
        const sy = top + row
        const wx = sx + 0.5
        const wy = sampleY[slot]
        const z = sampleZ[slot]
        const kind = sampleKind[slot]
        const ty = sampleRow[slot]
        // Tops show the ground's own pattern; faces run it down the screen.
        const face = wy - 0.5 !== ty
        const texel = groundTexel(
          kind,
          sx,
          face ? sy : ty,
          (dx, dy) => this.classAt(sx + dx, ty + dy),
          false
        )
        if (texel[3] === 0) continue
        // Decorations close enough to shade this point.
        const shading: Instance[] = []
        const crowding: Instance[] = []
        for (const instance of neighbors) {
          if (rayHitsBox(wx, wy, z, instance.lo, instance.hi)) shading.push(instance)
          if (boxDistance(wx, wy, z, instance.lo, instance.hi) < 6) crowding.push(instance)
        }
        const scene =
          (list: Instance[], ground = terrain) =>
          (px: number, py: number, pz: number) => {
            let d = ground(px, py, pz)
            for (const instance of list) {
              if (boxDistance(px, py, pz, instance.lo, instance.hi) >= d) continue
              d = Math.min(
                d,
                modelDistance(instance.model, px - instance.x, py - instance.y, pz - instance.z)
              )
            }
            return d
          }
        const e = 0.5
        let nx = this.heightAt(wx - e, wy) - this.heightAt(wx + e, wy)
        let ny = this.heightAt(wx, wy - e) - this.heightAt(wx, wy + e)
        let nz = 2 * e
        const l = Math.hypot(nx, ny, nz)
        nx /= l
        ny /= l
        nz /= l
        const ao = occlusion(scene(crowding, above), wx, wy, z, nx, ny, nz)
        let far = (9 - z) / SUN[2]
        for (const instance of shading) far = Math.max(far, (instance.hi[2] + 1 - z) / SUN[2])
        const lit = softShadow(scene(shading), wx + nx * 0.3, wy + ny * 0.3, z + nz * 0.3, far)
        const base = groundSlot(kind, texel)
        const color = palette[stepSlot(base, lightSteps(shade(nx, ny, nz, ao, lit), sx, sy))]
        positions.push(sx, sy, Math.round((wy + z) * DEPTH_UNIT))
        colors.push(color.r, color.g, color.b)
      }
    }
    return { position: Int16Array.from(positions), color: Uint8Array.from(colors) }
  }

  private bakeDecor(X0: number, Y0: number, X1: number, Y1: number) {
    const placed: Instance[] = []
    for (const instance of this.instances.values())
      if (instance.x >= X0 && instance.x < X1 && instance.y >= Y0 && instance.y < Y1)
        placed.push(instance)
    let count = 0
    for (const instance of placed) count += instance.template().count
    const position = new Int16Array(count * 3)
    const color = new Uint8Array(count * 3)
    const anim = new Float32Array(count * 4)
    const glows: BakedGlow[] = []
    let at = 0
    for (const instance of placed) {
      const t = instance.template()
      const ox = instance.x
      const oy = instance.y - instance.z + REFERENCE_HEIGHT
      const phase = instance.x * 0.021 + instance.y * 0.013
      for (let i = 0; i < t.count; i++, at++) {
        position[at * 3] = ox + t.x[i]
        position[at * 3 + 1] = oy + t.y[i]
        position[at * 3 + 2] = Math.round((instance.y + instance.z + t.depth[i]) * DEPTH_UNIT)
        const c = palette[t.slot[i]]
        color[at * 3] = c.r
        color[at * 3 + 1] = c.g
        color[at * 3 + 2] = c.b
        anim[at * 4] = t.sway[i]
        anim[at * 4 + 1] = instance.model.bob
        anim[at * 4 + 2] = t.glow[i]
        anim[at * 4 + 3] = phase
      }
      const glow = instance.model.glow
      if (glow)
        glows.push({
          tile: instance.tile,
          x: instance.x,
          y: instance.y - instance.z - glow.height + REFERENCE_HEIGHT,
          soft: glow.soft === true
        })
    }
    return { decor: { position, color, anim }, glows }
  }
}

// Whether a ray from a point toward the sun passes through a box.
function rayHitsBox(
  px: number,
  py: number,
  pz: number,
  lo: readonly number[],
  hi: readonly number[]
) {
  let near = 0
  let far = Number.POSITIVE_INFINITY
  const origin = [px, py, pz]
  for (let axis = 0; axis < 3; axis++) {
    const d = SUN[axis]
    const o = origin[axis]
    if (Math.abs(d) < 1e-6) {
      if (o < lo[axis] || o > hi[axis]) return false
      continue
    }
    let t0 = (lo[axis] - o) / d
    let t1 = (hi[axis] - o) / d
    if (t0 > t1) [t0, t1] = [t1, t0]
    near = Math.max(near, t0)
    far = Math.min(far, t1)
    if (near > far) return false
  }
  return true
}

function boxDistance(
  px: number,
  py: number,
  pz: number,
  lo: readonly number[],
  hi: readonly number[]
) {
  const dx = Math.max(lo[0] - px, 0, px - hi[0])
  const dy = Math.max(lo[1] - py, 0, py - hi[1])
  const dz = Math.max(lo[2] - pz, 0, pz - hi[2])
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export { bayer }
