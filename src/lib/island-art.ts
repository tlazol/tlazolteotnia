import {
  GRASS,
  groundAt,
  hash2,
  type IslandWorld,
  PATH,
  SAND,
  TILE_SIZE,
  valueNoise,
  WATER
} from './island-world'

// ---- Shared pixel helpers -------------------------------------------------

export type PixelBuffer = { width: number; height: number; data: Uint8ClampedArray }
export type Rgba = readonly [number, number, number, number]

export function createBuffer(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

export function hex(value: string, alpha = 255): Rgba {
  const n = Number.parseInt(value.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha]
}

export function setPixel(buffer: PixelBuffer, x: number, y: number, color: Rgba) {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return
  const i = (y * buffer.width + x) * 4
  buffer.data[i] = color[0]
  buffer.data[i + 1] = color[1]
  buffer.data[i + 2] = color[2]
  buffer.data[i + 3] = color[3]
}

export function alphaAt(buffer: PixelBuffer, x: number, y: number) {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return 0
  return buffer.data[(y * buffer.width + x) * 4 + 3]
}

// One dark outline around every opaque shape keeps sprites in a single style.
export function outline(buffer: PixelBuffer, color: Rgba) {
  const marks: number[] = []
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      if (alphaAt(buffer, x, y)) continue
      if (
        alphaAt(buffer, x - 1, y) ||
        alphaAt(buffer, x + 1, y) ||
        alphaAt(buffer, x, y - 1) ||
        alphaAt(buffer, x, y + 1)
      )
        marks.push(x, y)
    }
  }
  for (let i = 0; i < marks.length; i += 2) setPixel(buffer, marks[i], marks[i + 1], color)
}

export function blit(
  target: PixelBuffer,
  source: PixelBuffer,
  ox: number,
  oy: number,
  flip = false
) {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + (flip ? source.width - 1 - x : x)) * 4
      if (!source.data[i + 3]) continue
      setPixel(target, ox + x, oy + y, [
        source.data[i],
        source.data[i + 1],
        source.data[i + 2],
        source.data[i + 3]
      ])
    }
  }
}

// ---- Palette --------------------------------------------------------------

export const islandPalette = {
  deep: '#3b6db0',
  mid: '#4489c9',
  shallow: '#55b3d4',
  lagoon: '#79d3d2',
  foam: '#eafcff',
  wave: '#8fd0ee',
  sand: '#ead08f',
  sandLight: '#f6e6b4',
  sandDark: '#d4b373',
  sandWet: '#dcbb79',
  face: '#c99d5e',
  faceDark: '#a37945',
  grass: '#69bb4c',
  grassLight: '#82cd5a',
  grassPale: '#9bdb72',
  grassDark: '#57a845',
  grassEdge: '#3f8a3d',
  grassDeep: '#2f6f37',
  path: '#d2a978',
  pathLight: '#e2c193',
  pathDark: '#b48659',
  pathEdge: '#9a6f48',
  outline: '#2b2236'
} as const

const c = Object.fromEntries(
  Object.entries(islandPalette).map(([name, value]) => [name, hex(value)])
) as Record<keyof typeof islandPalette, Rgba>
const transparent: Rgba = [0, 0, 0, 0]
const lipShadow: Rgba = [24, 58, 92, 90]

// ---- Terrain --------------------------------------------------------------

const smooth = (t: number) => t * t * (3 - 2 * t)

// Which ground an art pixel shows. Tiles are blended between their centers and
// broken up with noise, so coasts and ground borders curve across tiles and
// always join up with their neighbors.
export function terrainClass(world: IslandWorld, px: number, py: number) {
  const u = (px + 0.5) / TILE_SIZE - 0.5
  const v = (py + 0.5) / TILE_SIZE - 0.5
  const x0 = Math.floor(u)
  const y0 = Math.floor(v)
  const fx = smooth(u - x0)
  const fy = smooth(v - y0)
  const g00 = groundAt(world, x0, y0)
  const g10 = groundAt(world, x0 + 1, y0)
  const g01 = groundAt(world, x0, y0 + 1)
  const g11 = groundAt(world, x0 + 1, y0 + 1)
  const mix = (a: number, b: number, c2: number, d: number) =>
    a + (b - a) * fx + (c2 - a) * fy + (a - b - c2 + d) * fx * fy
  const land = mix(+(g00 !== WATER), +(g10 !== WATER), +(g01 !== WATER), +(g11 !== WATER))
  if (land === 0) return WATER
  const noise =
    (valueNoise(px / 9, py / 9, 3) - 0.5) * 0.55 + (hash2(px >> 1, py >> 1, 9) - 0.5) * 0.1
  if (land <= 0.5 + noise) return WATER
  const path = mix(+(g00 === PATH), +(g10 === PATH), +(g01 === PATH), +(g11 === PATH))
  if (path > 0.5 + (valueNoise(px / 5, py / 5, 13) - 0.5) * 0.35 + (hash2(px, py, 17) - 0.5) * 0.08)
    return PATH
  const grass = mix(+(g00 === GRASS), +(g10 === GRASS), +(g01 === GRASS), +(g11 === GRASS))
  // Grass gives way to a strip of beach where land meets the sea.
  const grassNoise =
    (valueNoise(px / 7, py / 7, 19) - 0.5) * 0.4 + (hash2(px >> 1, py >> 1, 29) - 0.5) * 0.1
  if (grass - (1 - land) * 0.9 > 0.5 + grassNoise) return GRASS
  return SAND
}

const PAD = 4

// Paints the terrain for art pixels [x0, x0 + width) × [y0, y0 + height) into
// `buffer` at (bx, by). Sea pixels stay transparent for the water shader,
// except the shore face and its shadow below southern coasts.
export function paintTerrain(
  world: IslandWorld,
  buffer: PixelBuffer,
  x0: number,
  y0: number,
  width: number,
  height: number,
  bx = 0,
  by = 0
) {
  const cw = width + PAD * 2
  const ch = height + PAD * 2
  const classes = new Uint8Array(cw * ch)
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++)
      classes[y * cw + x] = terrainClass(world, x0 + x - PAD, y0 + y - PAD)
  const at = (x: number, y: number) => classes[(y + PAD) * cw + x + PAD]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x0 + x
      const py = y0 + y
      const kind = at(x, y)
      let color: Rgba = transparent
      if (kind === WATER) {
        if (at(x, y - 1) !== WATER) color = c.face
        else if (at(x, y - 2) !== WATER) color = c.faceDark
        else if (at(x, y - 3) !== WATER) color = lipShadow
      } else if (kind === SAND) {
        const below = at(x, y + 1)
        const nearWater = at(x - 1, y) === WATER || at(x + 1, y) === WATER || at(x, y - 1) === WATER
        const nearWater2 =
          at(x - 2, y) === WATER || at(x + 2, y) === WATER || at(x, y - 2) === WATER
        const speck = hash2(px, py, 41)
        if (below === WATER) color = c.sandLight
        else if (nearWater) color = c.sandWet
        else if (at(x, y - 1) === GRASS || at(x, y - 2) === GRASS) color = c.sandDark
        else if (nearWater2 && (px + py) % 2 === 0) color = c.sandWet
        else if (speck < 0.045) color = c.sandDark
        else if (speck < 0.09) color = c.sandLight
        else color = c.sand
      } else if (kind === GRASS) {
        if (at(x, y + 1) !== GRASS) color = c.grassDeep
        else if (at(x, y + 2) !== GRASS) color = c.grassEdge
        else if (at(x - 1, y) !== GRASS || at(x + 1, y) !== GRASS) color = c.grassEdge
        else if (at(x, y - 1) !== GRASS) color = c.grassPale
        else color = grassPixel(px, py)
      } else {
        const speck = hash2(px, py, 51)
        if (at(x, y + 1) !== PATH || at(x - 1, y) !== PATH || at(x + 1, y) !== PATH)
          color = c.pathEdge
        else if (at(x, y - 1) !== PATH) color = c.pathDark
        else if (speck < 0.03) color = c.pathLight
        else if (hash2(px, py - 1, 51) < 0.03) color = c.pathDark
        else {
          const tone = valueNoise(px / 8, py / 8, 61) + ((px + py) % 2 ? 0.02 : -0.02)
          color = tone > 0.72 ? c.pathLight : tone < 0.26 ? c.pathDark : c.path
        }
      }
      setPixel(buffer, bx + x, by + y, color)
    }
  }
}

// Meadow texture: soft light and dark patches with scattered tufts.
function grassPixel(px: number, py: number): Rgba {
  const cx = Math.floor(px / 7)
  const cy = Math.floor(py / 6)
  if (hash2(cx, cy, 33) < 0.3) {
    const ox = cx * 7 + 1 + Math.floor(hash2(cx, cy, 34) * 4)
    const oy = cy * 6 + 1 + Math.floor(hash2(cx, cy, 35) * 3)
    const lx = px - ox
    const ly = py - oy
    const light = hash2(cx, cy, 36) < 0.2
    if ((ly === 0 && (lx === 0 || lx === 2)) || (ly === 1 && lx === 1))
      return light ? c.grassPale : c.grassDark
  }
  const tone = valueNoise(px / 10, py / 10, 37) + ((px + py) % 2 ? 0.035 : -0.035)
  if (tone > 0.66) return c.grassLight
  if (tone < 0.3) return c.grassDark
  return c.grass
}

// Distance from each 4×4 pixel cell to the nearest land, for shallows and foam.
export const SHORE_CELL = 4
export const SHORE_RANGE = 14 // cells

export function createShoreField(world: IslandWorld) {
  const width = (world.columns * TILE_SIZE) / SHORE_CELL
  const height = (world.rows * TILE_SIZE) / SHORE_CELL
  return {
    width,
    height,
    land: new Uint8Array(width * height),
    distance: new Uint8Array(width * height)
  }
}
export type ShoreField = ReturnType<typeof createShoreField>

// Recomputes the field inside a cell rectangle; land is sampled at cell centers.
export function updateShoreField(
  world: IslandWorld,
  field: ShoreField,
  cx0 = 0,
  cy0 = 0,
  cx1 = field.width,
  cy1 = field.height
) {
  const lx0 = Math.max(0, cx0 - SHORE_RANGE)
  const ly0 = Math.max(0, cy0 - SHORE_RANGE)
  const lx1 = Math.min(field.width, cx1 + SHORE_RANGE)
  const ly1 = Math.min(field.height, cy1 + SHORE_RANGE)
  for (let y = ly0; y < ly1; y++)
    for (let x = lx0; x < lx1; x++)
      field.land[y * field.width + x] =
        terrainClass(world, x * SHORE_CELL + 2, y * SHORE_CELL + 2) === WATER ? 0 : 1
  const r2 = SHORE_RANGE * SHORE_RANGE
  for (let y = Math.max(0, cy0); y < Math.min(field.height, cy1); y++) {
    for (let x = Math.max(0, cx0); x < Math.min(field.width, cx1); x++) {
      let best = r2
      for (let dy = -SHORE_RANGE; dy <= SHORE_RANGE && best; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= field.height || dy * dy >= best) continue
        for (let dx = -SHORE_RANGE; dx <= SHORE_RANGE; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= field.width) continue
          const d = dx * dx + dy * dy
          if (d < best && field.land[yy * field.width + xx]) best = d
        }
      }
      field.distance[y * field.width + x] = Math.round((Math.sqrt(best) / SHORE_RANGE) * 255)
    }
  }
}

// ---- Decorations ----------------------------------------------------------

// Trees and rocks stand taller than residents (a resident is 20×28): the trunk
// or base fills one tile and blocks walking, while canopies spread over the
// tiles behind it so residents can walk round the back.
export type ShadowSize = 'small' | 'medium' | 'large' | 'huge'
export type SpriteFrame = { buffer: PixelBuffer; shadow: ShadowSize }

function disc(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  paint: (x: number, y: number) => Rgba | null
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      if (dx * dx + dy * dy > 1) continue
      const color = paint(x, y)
      if (color) setPixel(buffer, x, y, color)
    }
  }
}

type Lump = { x: number; y: number; rx: number; ry: number }

// Paints overlapping lumps (leaf clumps, boulders) lit from the upper left.
// Each pixel takes the lump bulging nearest the viewer, so clumps read as
// separate rounded masses with darker undersides.
function lumps(
  buffer: PixelBuffer,
  shapes: Lump[],
  shades: readonly Rgba[],
  seed: number,
  options: { grain?: number; base?: number; fade?: number } = {}
) {
  const { grain = 0.12, base = 0, fade = 0.3 } = options
  const light = [-0.55, -0.72, 0.42]
  const length = Math.hypot(light[0], light[1], light[2])
  const top = Math.min(...shapes.map((s) => s.y - s.ry))
  const bottom = Math.max(...shapes.map((s) => s.y + s.ry))
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      let best = -Infinity
      let normal: [number, number, number] = [0, 0, 1]
      for (const s of shapes) {
        const dx = (x + 0.5 - s.x) / s.rx
        const dy = (y + 0.5 - s.y) / s.ry
        const d2 = dx * dx + dy * dy
        if (d2 > 1) continue
        const nz = Math.sqrt(1 - d2)
        const depth = s.y + nz * Math.min(s.rx, s.ry) * 0.7
        if (depth > best) {
          best = depth
          normal = [dx, dy, nz]
        }
      }
      if (best === -Infinity) continue
      let lit = (normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]) / length + base
      lit -= ((y - top) / Math.max(1, bottom - top)) * fade
      lit += (hash2(x >> 1, y, seed) - 0.5) * grain + ((x + y) % 2 ? 0.04 : -0.04)
      const index = lit > 0.78 ? 0 : lit > 0.48 ? 1 : lit > 0.16 ? 2 : 3
      setPixel(buffer, x, y, shades[Math.min(index, shades.length - 1)])
    }
  }
}

const shadesOf = (...values: string[]) => values.map((value) => hex(value))
const leafOutline = hex('#1d3a2a')

const treeLooks = [
  {
    leaves: shadesOf('#a6e06c', '#6cba50', '#478f45', '#2c6338'),
    shapes: [
      { x: 28, y: 24, rx: 17, ry: 15 },
      { x: 14, y: 33, rx: 12, ry: 10 },
      { x: 42, y: 33, rx: 12, ry: 10 },
      { x: 20, y: 15, rx: 11, ry: 9 },
      { x: 37, y: 14, rx: 10, ry: 9 },
      { x: 28, y: 42, rx: 15, ry: 8 },
      { x: 8, y: 25, rx: 7, ry: 7 },
      { x: 48, y: 25, rx: 7, ry: 7 }
    ]
  },
  {
    leaves: shadesOf('#9fdb69', '#62b04e', '#3f8744', '#285b36'),
    shapes: [
      { x: 28, y: 22, rx: 18, ry: 16 },
      { x: 13, y: 32, rx: 11, ry: 10 },
      { x: 43, y: 31, rx: 12, ry: 10 },
      { x: 27, y: 9, rx: 11, ry: 8 },
      { x: 28, y: 41, rx: 16, ry: 8 }
    ]
  },
  {
    leaves: shadesOf('#bde27a', '#82c25a', '#55974a', '#36693d'),
    shapes: [
      { x: 28, y: 18, rx: 14, ry: 15 },
      { x: 17, y: 30, rx: 12, ry: 11 },
      { x: 40, y: 30, rx: 12, ry: 11 },
      { x: 28, y: 39, rx: 14, ry: 9 },
      { x: 28, y: 6, rx: 8, ry: 6 }
    ]
  }
]

// Broadleaf trees, about two and a half residents tall.
function paintTree(variant: number): SpriteFrame {
  const buffer = createBuffer(56, 76)
  const look = treeLooks[variant]
  const bark = shadesOf('#a8754a', '#875a39', '#66412a', '#4a2e1f')
  // Trunk with a flared root and a fork that disappears into the canopy.
  for (let y = 36; y <= 74; y++) {
    const flare = y > 68 ? Math.round((y - 68) * 0.8) : 0
    const left = 24 - flare - (y < 46 ? 1 : 0)
    const right = 31 + flare + (y < 46 ? 1 : 0)
    for (let x = left; x <= right; x++) {
      const u = (x - left) / Math.max(1, right - left)
      const groove = hash2(x, y >> 2, 401) < 0.18 && u > 0.2 && u < 0.8
      const shade = u < 0.22 ? 0 : u < 0.6 ? 1 : u < 0.85 ? 2 : 3
      setPixel(buffer, x, y, bark[Math.min(3, shade + (groove ? 1 : 0))])
    }
  }
  for (const [sx, dir] of [
    [25, -1],
    [30, 1]
  ]) {
    for (let i = 0; i < 9; i++) {
      const x = sx + dir * Math.round(i * 0.8)
      setPixel(buffer, x, 40 - i, bark[dir < 0 ? 0 : 2])
      setPixel(buffer, x + dir, 40 - i, bark[dir < 0 ? 1 : 3])
    }
  }
  const canopy = createBuffer(56, 76)
  lumps(canopy, look.shapes, look.leaves, 470 + variant)
  blit(buffer, canopy, 0, 0)
  if (variant === 1) {
    // Fruit tree: apples on the sunny side of the clumps.
    for (const [x, y] of [
      [15, 22],
      [24, 13],
      [36, 19],
      [43, 30],
      [30, 33],
      [12, 34],
      [21, 41],
      [37, 41]
    ]) {
      if (!alphaAt(buffer, x, y)) continue
      setPixel(buffer, x, y, hex('#e0503f'))
      setPixel(buffer, x + 1, y, hex('#b83a36'))
      setPixel(buffer, x, y + 1, hex('#b83a36'))
      setPixel(buffer, x + 1, y + 1, hex('#8e2b2e'))
      setPixel(buffer, x, y - 1, hex('#ff9a7a'))
    }
  }
  outline(buffer, leafOutline)
  return { buffer, shadow: 'huge' }
}

// Palms lean out over the sand, about three residents tall.
function paintPalm(variant: number): SpriteFrame {
  const buffer = createBuffer(68, 90)
  const lean = variant === 1 ? -1 : 1
  const base = { x: 34, y: 87 }
  const crown = { x: 34 + lean * 11, y: 30 }
  const bark = shadesOf('#d6a86c', '#b98a55', '#946739', '#6f4a2a')
  // Trunk: a gentle curve, ringed every few pixels, tapering toward the crown.
  for (let y = crown.y; y <= base.y; y++) {
    const t = (base.y - y) / (base.y - crown.y)
    const cx = base.x + (crown.x - base.x) * t * t
    const half = 3 - t * 1.2
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const u = (x + 0.5 - (cx - half)) / (half * 2)
      if (u < 0 || u > 1) continue
      const ring = (y + Math.round(cx)) % 5 === 0
      const shade = u < 0.3 ? 0 : u < 0.68 ? 1 : 2
      setPixel(buffer, x, y, bark[Math.min(3, shade + (ring ? 1 : 0))])
    }
  }
  const leaf = shadesOf('#a8e46e', '#6ec556', '#46a04a', '#2d7440')
  // Fronds fan out from the crown and droop; leaflets hang from each spine.
  const fronds: Array<[number, number, number]> = [
    [-178, 28, 0.55],
    [-150, 25, 0.35],
    [-118, 20, 0.2],
    [-80, 18, 0.18],
    [-45, 24, 0.32],
    [-8, 28, 0.55],
    [150, 22, 0.75],
    [118, 18, 0.7],
    [62, 18, 0.7],
    [30, 22, 0.75]
  ]
  fronds.sort((a, b) => Math.sin((b[0] * Math.PI) / 180) - Math.sin((a[0] * Math.PI) / 180))
  for (const [degrees, length, droop] of fronds) {
    const angle = ((degrees + lean * 4) * Math.PI) / 180
    const back = Math.sin(angle) > 0.3
    const steps = length * 2
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const d = length * t
      const x = crown.x + Math.cos(angle) * d
      const y = crown.y + Math.sin(angle) * d * 0.55 + droop * d * t * 0.9
      // Tangent, and the leaflets' direction: back along the frond and downward.
      const tx = Math.cos(angle)
      const ty = Math.sin(angle) * 0.55 + droop * t * 1.8
      const tl = Math.hypot(tx, ty)
      const leaflet = Math.round(
        (Math.sin(Math.PI * Math.min(1, t * 1.15)) * 6 + 1) * (1 - t * 0.35)
      )
      for (const side of [-1, 1]) {
        let nx = (-ty / tl) * side
        let ny = (tx / tl) * side
        // Leaflets on the upper side are short; both sides sweep down.
        const upper = ny < 0
        const len = upper ? Math.round(leaflet * 0.6) : leaflet
        nx = nx * 0.75 - (tx / tl) * 0.45
        ny = ny * 0.75 - (ty / tl) * 0.45 + 0.35
        for (let k = 1; k <= len; k++) {
          const shade = back ? 3 : upper ? 1 : k > len * 0.6 ? 3 : 2
          setPixel(buffer, Math.round(x + nx * k), Math.round(y + ny * k), leaf[shade])
        }
      }
      setPixel(buffer, Math.round(x), Math.round(y), leaf[back ? 2 : t < 0.15 ? 2 : 0])
      setPixel(buffer, Math.round(x), Math.round(y) + 1, leaf[back ? 3 : 1])
    }
  }
  // Coconuts tucked under the crown.
  for (const [dx, dy] of [
    [-2, 3],
    [2, 3],
    [0, 5]
  ]) {
    disc(buffer, crown.x + dx, crown.y + dy, 2.3, 2.3, (x, y) =>
      hex(x + y < crown.x + dx + crown.y + dy ? '#9a6a3c' : '#6b4426')
    )
  }
  outline(buffer, leafOutline)
  return { buffer, shadow: 'large' }
}

const bushLooks = [
  shadesOf('#a2dc6c', '#63b551', '#428f47', '#2b6638'),
  shadesOf('#9bd667', '#5aa94e', '#3b8545', '#275d35')
]

// Bushes come up to a resident's chest.
function paintBush(variant: number): SpriteFrame {
  const buffer = createBuffer(34, 24)
  lumps(
    buffer,
    [
      { x: 9, y: 15, rx: 8, ry: 7 },
      { x: 25, y: 15, rx: 8, ry: 7 },
      { x: 17, y: 10, rx: 9.5, ry: 8 },
      { x: 17, y: 18, rx: 11, ry: 5 }
    ],
    bushLooks[variant],
    520 + variant,
    { fade: 0.25 }
  )
  const dots: Array<[number, number]> = [
    [8, 11],
    [15, 6],
    [21, 9],
    [26, 13],
    [12, 16],
    [19, 15],
    [28, 18],
    [6, 18]
  ]
  for (const [x, y] of dots) {
    if (!alphaAt(buffer, x, y)) continue
    if (variant === 1) {
      setPixel(buffer, x, y, hex('#d9415a'))
      setPixel(buffer, x + 1, y, hex('#a82f48'))
      setPixel(buffer, x, y - 1, hex('#ff9fae'))
    } else {
      setPixel(buffer, x, y, hex('#fff6e0'))
      setPixel(buffer, x - 1, y, hex('#fff6e0'))
      setPixel(buffer, x + 1, y, hex('#fff6e0'))
      setPixel(buffer, x, y - 1, hex('#fff6e0'))
      setPixel(buffer, x, y + 1, hex('#f1d76a'))
    }
  }
  outline(buffer, leafOutline)
  return { buffer, shadow: 'medium' }
}

const stone = shadesOf('#e2dfe9', '#b9b4c8', '#8f89a6', '#676183')

// Boulders about as tall as a resident's shoulder.
function paintRock(variant: number): SpriteFrame {
  const buffer = createBuffer(36, 28)
  if (variant === 1) {
    lumps(
      buffer,
      [
        { x: 14, y: 14, rx: 12, ry: 11 },
        { x: 26, y: 20, rx: 8.5, ry: 6.5 },
        { x: 8, y: 21, rx: 6, ry: 5 }
      ],
      stone,
      610,
      { grain: 0.1, fade: 0.2 }
    )
    // A cap of moss on the big stone.
    for (let x = 6; x <= 20; x++) {
      let top = 0
      while (top < buffer.height && !alphaAt(buffer, x, top)) top++
      const depth = 1 + Math.round(Math.sin(((x - 6) / 14) * Math.PI) * 2.5 + hash2(x, 0, 611))
      for (let y = 0; y < depth; y++) {
        const color = y === 0 ? '#a6dc6e' : y < depth - 1 ? '#6fb553' : '#4c8f45'
        setPixel(buffer, x, top + y, hex(color))
      }
    }
  } else {
    lumps(
      buffer,
      [
        { x: 17, y: 15, rx: 15, ry: 11 },
        { x: 11, y: 11, rx: 8, ry: 7 },
        { x: 25, y: 19, rx: 9, ry: 6 }
      ],
      stone,
      612,
      { grain: 0.1, fade: 0.2 }
    )
    // A crack running down the face.
    for (const [x, y] of [
      [19, 9],
      [19, 10],
      [20, 11],
      [20, 12],
      [21, 13],
      [20, 14]
    ]) {
      setPixel(buffer, x, y, stone[3])
      setPixel(buffer, x - 1, y, stone[1])
    }
  }
  // Rest the stones flat on the ground.
  for (let y = 26; y < buffer.height; y++)
    for (let x = 0; x < buffer.width; x++) setPixel(buffer, x, y, [0, 0, 0, 0])
  outline(buffer, hex('#3a3450'))
  return { buffer, shadow: 'medium' }
}

const flowerColors = [
  ['#f48fb4', '#d8577f'],
  ['#ffe07a', '#e3a93b'],
  ['#b9a2ff', '#7d64d6'],
  ['#fffaf0', '#d9cbb8']
] as const

function paintFlowers(variant: number): SpriteFrame {
  const buffer = createBuffer(16, 14)
  const stem = hex('#3f8a3d')
  const leaf = hex('#5aac46')
  const spots: Array<[number, number, number]> = [
    [4, 5, 0],
    [10, 3, 1],
    [12, 9, 0],
    [6, 10, 1],
    [8, 7, 2]
  ]
  for (const [x, y, k] of spots) {
    const [petal, petalDark] = flowerColors[(variant + k) % flowerColors.length].map((v) => hex(v))
    setPixel(buffer, x, y + 2, stem)
    setPixel(buffer, x - 1, y + 3, leaf)
    setPixel(buffer, x + 1, y + 3, leaf)
    setPixel(buffer, x, y - 1, petal)
    setPixel(buffer, x - 1, y, petal)
    setPixel(buffer, x + 1, y, petalDark)
    setPixel(buffer, x, y + 1, petalDark)
    setPixel(buffer, x, y, hex('#ffd34d'))
  }
  return { buffer, shadow: 'small' }
}

export const decorVariants = {
  tree: [0, 1, 2].map(paintTree),
  palm: [0, 1].map(paintPalm),
  bush: [0, 1].map(paintBush),
  rock: [0, 1].map(paintRock),
  flowers: [0, 1, 2].map(paintFlowers)
} satisfies Record<string, SpriteFrame[]>

export function decorVariantIndex(kind: keyof typeof decorVariants, x: number, y: number) {
  const roll = hash2(x, y, 211)
  // Fruit trees and berry bushes are the occasional treat.
  if (kind === 'tree') return roll < 0.2 ? 1 : roll < 0.6 ? 0 : 2
  if (kind === 'bush') return roll < 0.22 ? 1 : 0
  return Math.floor(roll * decorVariants[kind].length)
}

export const shadowSizes = {
  small: [12, 4],
  medium: [28, 7],
  large: [34, 9],
  huge: [46, 12]
} as const satisfies Record<ShadowSize, readonly [number, number]>

export function paintShadow(size: ShadowSize) {
  const [width, height] = shadowSizes[size]
  const buffer = createBuffer(width, height)
  disc(buffer, width / 2, height / 2, width / 2, height / 2, () => [20, 46, 66, 82])
  return buffer
}
