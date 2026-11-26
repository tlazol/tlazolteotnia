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
import { decorModel, GLOW_CODE, type Model, modelDistance, nearestPart } from './island-models'
import {
  bayer,
  leafToneSlot,
  lightSteps,
  type Outline,
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
  createIsland,
  DECK,
  type DecorKind,
  DRYGRASS,
  decorInfo,
  decorKindOf,
  decorLookAt,
  decorSizeAt,
  decorToneAt,
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

// Sun reaching a point of a model through the model itself. Soft shadow is
// min(5h / t), unchanged when everything grows alike, so a grown model's
// shadow is marched on the model it grew from in far fewer steps.
function modelShadow(m: Model, x: number, y: number, z: number, far: number) {
  const grown = m.grown
  if (!grown) return softShadow((x, y, z) => modelDistance(m, x, y, z), x, y, z, far)
  const { from, scale, middle } = grown
  return softShadow(
    (x, y, z) => modelDistance(from, x, y, z),
    x / scale,
    middle + (y - middle) / scale,
    z / scale,
    far / scale
  )
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

// modelDistance over some of a model's parts.
function partsDistance(parts: Model['parts'], x: number, y: number, z: number) {
  let best = Number.POSITIVE_INFINITY
  for (const part of parts) {
    const ox = Math.max(part.lo[0] - x, 0, x - part.hi[0])
    const oy = Math.max(part.lo[1] - y, 0, y - part.hi[1])
    const oz = Math.max(part.lo[2] - z, 0, z - part.hi[2])
    if (ox * ox + oy * oy + oz * oz >= best * best && best > 0) continue
    const d = part.d(x, y, z)
    if (d < best) best = d
  }
  return best
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
  const outlines: Outline[] = []
  const distance = (x: number, y: number, z: number) => modelDistance(m, x, y, z)
  const ground = (x: number, y: number, z: number) => Math.min(distance(x, y, z), z)
  const top = Math.max(1, m.hi[2])
  // A ray only meets the parts whose bounds it passes through, so it marches
  // just those, over just the stretch where it is inside one: most rays miss,
  // and a part it cannot reach must not shorten its steps. A hair of slack
  // keeps the surface a ray grazes.
  const slack = 0.05
  const column: Model['parts'] = []
  const along: Model['parts'] = []
  for (let sx = x0; sx < x1; sx++) {
    const X = sx + 0.5
    column.length = 0
    for (const part of m.parts)
      if (X >= part.lo[0] - slack && X <= part.hi[0] + slack) column.push(part)
    for (let sy = y0; sy < y1; sy++) {
      const S = sy + 0.5
      along.length = 0
      let zTop = Number.NEGATIVE_INFINITY
      let zBottom = Number.POSITIVE_INFINITY
      for (const part of column) {
        // On this ray y = S + z: inside the part's bounds for these z.
        const high = Math.min(part.hi[2], part.hi[1] - S) + slack
        const low = Math.max(part.lo[2], part.lo[1] - S) - slack
        if (high < low) continue
        along.push(part)
        zTop = Math.max(zTop, high)
        zBottom = Math.min(zBottom, low)
      }
      zTop = Math.min(zTop, m.hi[2], m.hi[1] - S)
      zBottom = Math.max(zBottom, m.lo[2], m.lo[1] - S, -0.5)
      if (zTop < zBottom) continue
      let z = zTop
      let found = false
      for (let i = 0; i < 200; i++) {
        const d = partsDistance(along, X, S + z, z)
        if (d < 0.04) {
          found = true
          break
        }
        z -= Math.max(d * 0.7, 0.1) / SQRT2
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
        const lit = modelShadow(
          m,
          X + nx * 0.4,
          Y + ny * 0.4,
          z + nz * 0.4,
          (m.hi[2] + 1 - z) / SUN[2]
        )
        const light = shade(nx, ny, nz, ao, lit)
        // Drawn as a sign: lit or in shade, nothing between.
        slot = stepSlot(slot, material.flat ? (light < 0.72 ? -1 : 0) : lightSteps(light, sx, sy))
      }
      hit[(sy - y0 + 1) * width + (sx - x0 + 1)] = xs.length
      xs.push(sx)
      ys.push(sy)
      depths.push(Y + z)
      slots.push(slot)
      if (material.glow === 'flame') {
        // A flame's tip licks from side to side; its foot stays put.
        const rise = (z - part.lo[2]) / Math.max(1, part.hi[2] - part.lo[2])
        sways.push(1.6 * Math.min(1, Math.max(0, rise)) ** 1.5)
      } else sways.push(m.sway * Math.min(1, Math.max(0, z / top)) ** 2)
      glows.push(material.glow ? GLOW_CODE[material.glow] : 0)
      outlines.push(material.outline ?? 'soft')
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
        if (index >= 0 && outlines[index] !== 'none' && (best < 0 || depths[index] > depths[best]))
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
    template.slot[i] = rimSlot(slots[source], outlines[source])
    template.sway[i] = sways[source]
    // A drawn flame's line moves with it.
    if (glows[source] === GLOW_CODE.flame) template.glow[i] = GLOW_CODE.flame
  }
  return template
}

// How much sun reaches a level plane through a decoration, sampled once per
// pixel around its foot. The ground under a decoration is all but level, so
// the island reads its shadow from here instead of marching through the model
// again for every point it shades.
// Shadows are soft: a sample every other pixel, blended between, is plenty.
const SHADOW_STEP = 2

export type ShadowMap = {
  x0: number
  y0: number
  width: number
  height: number
  light: Float32Array
}

export function bakeShadow(m: Model): ShadowMap {
  const reach = Math.max(0, m.hi[2])
  const x0 = Math.floor(m.lo[0]) - 2
  const y0 = Math.floor(m.lo[1]) - 2
  const width = Math.ceil((m.hi[0] + (-SUN[0] / SUN[2]) * reach + 3 - x0) / SHADOW_STEP) + 1
  const height = Math.ceil((m.hi[1] + (-SUN[1] / SUN[2]) * reach + 3 - y0) / SHADOW_STEP) + 1
  const light = new Float32Array(width * height)
  const far = (reach + 1) / SUN[2]
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++)
      light[j * width + i] = modelShadow(m, x0 + i * SHADOW_STEP, y0 + j * SHADOW_STEP, 0.3, far)
  return { x0, y0, width, height, light }
}

// Sun through a decoration at a point given from its foot: the point is slid
// along the sun's ray onto the plane the map was made on.
function shadowLight(map: ShadowMap, x: number, y: number, z: number) {
  const t = z / SUN[2]
  const u = (x - SUN[0] * t - map.x0) / SHADOW_STEP
  const v = (y - SUN[1] * t - map.y0) / SHADOW_STEP
  const i = Math.floor(u)
  const j = Math.floor(v)
  if (i < 0 || j < 0 || i >= map.width - 1 || j >= map.height - 1) return 1
  const fu = u - i
  const fv = v - j
  const at = j * map.width + i
  const a = map.light[at]
  const b = map.light[at + 1]
  const c = map.light[at + map.width]
  const d = map.light[at + map.width + 1]
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv
}

// ---- Models by key ------------------------------------------------------------------

// A decoration's template and shadow depend only on its model, never on the
// island around it, so they can be baked anywhere (another worker, an earlier
// visit) and handed over by this key.
export type BakedModel = { key: string; template: Template; shadow: ShadowMap }

export function modelKey(kind: DecorKind, look: number, size: number) {
  return `${kind}:${look}:${size}`
}

function modelAt(decor: Uint8Array, columns: number, tile: number) {
  const code = decor[tile]
  const kind = decorKindOf(code)
  if (!kind) return null
  const tx = tile % columns
  const ty = Math.floor(tile / columns)
  const look = decorLookAt(code, tx, ty) ?? 0
  const size = decorSizeAt(code, tx, ty)
  return { key: modelKey(kind, look, size), model: () => decorModel(kind, look, size) }
}

export function bakeModel(key: string): BakedModel {
  const [kind, look, size] = key.split(':')
  if (!Object.hasOwn(decorInfo, kind)) throw new Error(`Unknown decoration model ${key}`)
  const model = decorModel(kind as DecorKind, Number(look), Number(size))
  return { key, template: bakeTemplate(model), shadow: bakeShadow(model) }
}

// The buffers a baked model owns, for handing it to another thread.
export function modelBuffers({ template, shadow }: BakedModel): ArrayBuffer[] {
  return [
    template.x.buffer,
    template.y.buffer,
    template.depth.buffer,
    template.slot.buffer,
    template.sway.buffer,
    template.glow.buffer,
    shadow.light.buffer
  ] as ArrayBuffer[]
}

// The island's decoration models, those standing in earlier chunks first.
export function modelKeysByPriority(
  columns: number,
  decor: Uint8Array,
  chunkColumns: number,
  chunkOrder: number[]
) {
  const rank = new Map(chunkOrder.map((index, i) => [index, i]))
  const ranked: Array<[number, string]> = []
  for (let tile = 0; tile < decor.length; tile++) {
    const found = modelAt(decor, columns, tile)
    if (!found) continue
    // Where placeInstance stands it.
    const x = (tile % columns) * TILE_SIZE + TILE_SIZE / 2
    const y = Math.floor(tile / columns) * TILE_SIZE + TILE_SIZE - 2
    const chunk = Math.floor(y / BAKE_CHUNK) * chunkColumns + Math.floor(x / BAKE_CHUNK)
    ranked.push([rank.get(chunk) ?? chunkOrder.length, found.key])
  }
  ranked.sort((a, b) => a[0] - b[0])
  return [...new Set(ranked.map(([, key]) => key))]
}

// ---- The baker --------------------------------------------------------------------

type Instance = {
  tile: number
  key: string
  model: Model
  template: () => Template
  shadow: () => ShadowMap
  x: number
  y: number
  z: number
  // Leaf tone, applied as the template is stamped down (decorToneAt).
  tone: number
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
  private templates = new Map<string, Template>()
  private shadows = new Map<string, ShadowMap>()
  private started = false

  constructor(columns: number, rows: number) {
    this.columns = columns
    this.rows = rows
    this.width = columns * TILE_SIZE
    this.height = rows * TILE_SIZE
    this.chunkColumns = Math.ceil(this.width / BAKE_CHUNK)
    this.chunkRows = Math.ceil(this.height / BAKE_CHUNK)
    const size = this.width * this.height
    this.world = createIsland(columns, rows)
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
    // Points depend on heights nearby, and on decorations whose shadows fall
    // to the south-east of them. A tall tree that comes, goes or moves up or
    // down reaches further, over all it shades.
    let ex0 = hx0 - 48
    let ey0 = hy0 - 48
    let ex1 = hx1 + 80
    let ey1 = hy1 + 80
    const reach = (instance: Instance | undefined) => {
      if (!instance) return
      const tall = instance.hi[2] - instance.z
      ex0 = Math.min(ex0, instance.lo[0] - 8)
      ey0 = Math.min(ey0, instance.lo[1] - 8)
      ex1 = Math.max(ex1, instance.hi[0] + (-SUN[0] / SUN[2]) * tall + 8)
      ey1 = Math.max(ey1, instance.hi[1] + (-SUN[1] / SUN[2]) * tall + 8)
    }
    for (let y = Math.max(0, minY - 2); y <= Math.min(this.rows - 1, maxY + 2); y++)
      for (let x = Math.max(0, minX - 2); x <= Math.min(this.columns - 1, maxX + 2); x++) {
        const tile = y * this.columns + x
        reach(this.instances.get(tile))
        this.placeInstance(tile)
        reach(this.instances.get(tile))
      }
    const chunks: number[] = []
    const cx0 = Math.max(0, Math.floor(ex0 / BAKE_CHUNK))
    const cy0 = Math.max(0, Math.floor(ey0 / BAKE_CHUNK))
    const cx1 = Math.min(this.chunkColumns - 1, Math.floor(ex1 / BAKE_CHUNK))
    const cy1 = Math.min(this.chunkRows - 1, Math.floor(ey1 / BAKE_CHUNK))
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
    const a = this.heightPixelAt(ix, iy)
    // Terrain samples often land exactly on a pixel center or column.
    // Avoid fetching and interpolating heights that have zero weight.
    if (fx === 0) {
      if (fy === 0) return a
      return a + (this.heightPixelAt(ix, iy + 1) - a) * fy
    }
    const b = this.heightPixelAt(ix + 1, iy)
    const c = this.heightPixelAt(ix, iy + 1)
    const d = this.heightPixelAt(ix + 1, iy + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }

  private heightPixelAt(x: number, y: number) {
    return x < 0 || y < 0 || x >= this.width || y >= this.height
      ? 0
      : this.heights[y * this.width + x]
  }

  private placeInstance(tile: number) {
    this.instances.delete(tile)
    const found = modelAt(this.world.decor, this.columns, tile)
    const kind = decorKindOf(this.world.decor[tile])
    if (!found || !kind) return
    const tx = tile % this.columns
    const ty = Math.floor(tile / this.columns)
    const { key } = found
    const model = found.model()
    const water = decorInfo[kind].on === 'water'
    const x = tx * TILE_SIZE + TILE_SIZE / 2
    const y = ty * TILE_SIZE + TILE_SIZE - 2
    const z = water
      ? 0
      : Math.round(Math.max(this.heightAt(x + 0.5, y - 3.5), this.heightAt(x + 0.5, y + 0.5)))
    this.instances.set(tile, {
      tile,
      key,
      model,
      template: () => this.template(key, model),
      shadow: () => this.shadow(key, model),
      x,
      y,
      z,
      tone: decorToneAt(this.world.decor[tile], tx, ty),
      lo: [x + model.lo[0], y + model.lo[1], z + model.lo[2]],
      hi: [x + model.hi[0], y + model.hi[1], z + model.hi[2]],
      water
    })
  }

  private template(key: string, model: Model) {
    let found = this.templates.get(key)
    if (!found) {
      found = bakeTemplate(model)
      this.templates.set(key, found)
    }
    return found
  }

  private shadow(key: string, model: Model) {
    let found = this.shadows.get(key)
    if (!found) {
      found = bakeShadow(model)
      this.shadows.set(key, found)
    }
    return found
  }

  // Takes a model baked elsewhere; one already here stays.
  addModel({ key, template, shadow }: BakedModel) {
    if (!this.templates.has(key)) this.templates.set(key, template)
    if (!this.shadows.has(key)) this.shadows.set(key, shadow)
  }

  hasModel(key: string) {
    return this.templates.has(key) && this.shadows.has(key)
  }

  // Every model baked or taken so far.
  models(): BakedModel[] {
    const models: BakedModel[] = []
    for (const [key, template] of this.templates) {
      const shadow = this.shadows.get(key)
      if (shadow) models.push({ key, template, shadow })
    }
    return models
  }

  // The models a chunk's bake reads: those standing in it, and those near
  // enough to shade its ground (bakeTerrain looks a tile further south).
  chunkModels(index: number) {
    const cx = index % this.chunkColumns
    const cy = Math.floor(index / this.chunkColumns)
    const X0 = cx * BAKE_CHUNK
    const Y0 = cy * BAKE_CHUNK
    const X1 = Math.min(this.width, X0 + BAKE_CHUNK)
    const Y1 = Math.min(this.height, Y0 + BAKE_CHUNK)
    const keys = new Set<string>()
    for (const instance of this.neighbors(X0, Y0, X1, Y1 + TILE_SIZE)) keys.add(instance.key)
    for (const instance of this.instances.values())
      if (instance.x >= X0 && instance.x < X1 && instance.y >= Y0 && instance.y < Y1)
        keys.add(instance.key)
    return keys
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
    // A chunk can contain many trees, but each pixel is affected only by
    // decorations near its tile. Reuse these small candidate lists per tile.
    const tileNeighbors = new Map<number, Instance[]>()
    const neighborsAt = (x: number, y: number) => {
      const tx = Math.floor(x / TILE_SIZE)
      const ty = Math.floor(y / TILE_SIZE)
      const key = ty * this.columns + tx
      let near = tileNeighbors.get(key)
      if (!near) {
        near = this.neighbors(
          tx * TILE_SIZE,
          ty * TILE_SIZE,
          (tx + 1) * TILE_SIZE,
          (ty + 1) * TILE_SIZE
        )
        tileNeighbors.set(key, near)
      }
      return near
    }
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
    const shading: Instance[] = []
    const crowding: Instance[] = []
    let texelX = 0
    let texelY = 0
    const texelNeighbor = (dx: number, dy: number) => this.classAt(texelX + dx, texelY + dy)
    const crowdedGround = (px: number, py: number, pz: number) => {
      let d = above(px, py, pz)
      for (const instance of crowding) {
        if (boxDistance(px, py, pz, instance.lo, instance.hi) >= d) continue
        d = Math.min(
          d,
          modelDistance(instance.model, px - instance.x, py - instance.y, pz - instance.z)
        )
      }
      return d
    }
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
        texelX = sx
        texelY = ty
        const texel = groundTexel(kind, sx, face ? sy : ty, texelNeighbor, false)
        if (texel[3] === 0) continue
        // Decorations close enough to shade this point.
        shading.length = 0
        crowding.length = 0
        const neighbors = neighborsAt(wx, wy)
        for (const instance of neighbors) {
          if (rayHitsBox(wx, wy, z, instance.lo, instance.hi)) shading.push(instance)
          if (boxDistance(wx, wy, z, instance.lo, instance.hi) < 6) crowding.push(instance)
        }
        const e = 0.5
        let nx = this.heightAt(wx - e, wy) - this.heightAt(wx + e, wy)
        let ny = this.heightAt(wx, wy - e) - this.heightAt(wx, wy + e)
        let nz = 2 * e
        const l = Math.hypot(nx, ny, nz)
        nx /= l
        ny /= l
        nz /= l
        const ao = occlusion(crowdedGround, wx, wy, z, nx, ny, nz)
        // The ground's own ledges, then whatever decorations stand in the sun.
        let lit = softShadow(terrain, wx + nx * 0.3, wy + ny * 0.3, z + nz * 0.3, (9 - z) / SUN[2])
        for (const instance of shading) {
          if (lit <= 0) break
          lit = Math.min(
            lit,
            shadowLight(instance.shadow(), wx - instance.x, wy - instance.y, z - instance.z)
          )
        }
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
        const c = palette[leafToneSlot(t.slot[i], instance.tone)]
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

// Bake the visible area first, including the caller's margin for tall scenery.
export function prioritizeChunks(
  chunks: number[],
  columns: number,
  viewport?: { left: number; top: number; right: number; bottom: number }
) {
  if (!viewport) return { chunks, visibleCount: chunks.length }
  const visible: number[] = []
  const rest: number[] = []
  for (const index of chunks) {
    const x = (index % columns) * BAKE_CHUNK
    const y = Math.floor(index / columns) * BAKE_CHUNK
    const intersects =
      x < viewport.right &&
      x + BAKE_CHUNK > viewport.left &&
      y < viewport.bottom &&
      y + BAKE_CHUNK > viewport.top
    ;(intersects ? visible : rest).push(index)
  }
  return { chunks: [...visible, ...rest], visibleCount: visible.length }
}

// Recheck the current viewport: it may have changed since the worker started.
export function isViewportBaked(
  available: { has(index: number): boolean },
  columns: number,
  rows: number,
  viewport?: { left: number; top: number; right: number; bottom: number }
) {
  if (!viewport) return false
  const x0 = Math.max(0, Math.floor(viewport.left / BAKE_CHUNK))
  const y0 = Math.max(0, Math.floor(viewport.top / BAKE_CHUNK))
  const x1 = Math.min(columns, Math.ceil(viewport.right / BAKE_CHUNK))
  const y1 = Math.min(rows, Math.ceil(viewport.bottom / BAKE_CHUNK))
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) if (!available.has(y * columns + x)) return false
  return true
}
