import {
  DECK,
  GRASS,
  type Ground,
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
  deep: '#245e77',
  swell: '#2c6980',
  ocean: '#307c91',
  mid: '#4496a2',
  shallow: '#6aafb0',
  lagoon: '#9ac8be',
  pale: '#c5d9c5',
  reef: '#1f8f9e',
  foam: '#e9eee0',
  sand: '#f5e8c0',
  sandLight: '#fff8e1',
  sandDark: '#e5d19e',
  sandWet: '#d8bf8a',
  face: '#c8a86b',
  faceDark: '#a6854e',
  grass: '#769451',
  grassLight: '#8da660',
  grassPale: '#afbc79',
  grassDark: '#657f48',
  grassEdge: '#506d3d',
  grassDeep: '#3b5431',
  path: '#dcbf8f',
  pathLight: '#ecd6aa',
  pathDark: '#c4a172',
  pathEdge: '#aa8558',
  deck: '#ad8a61',
  deckLight: '#cbb08a',
  deckDark: '#8b6f4d',
  deckEdge: '#665139',
  post: '#5c3a25',
  outline: '#2b2236'
} as const

const c = Object.fromEntries(
  Object.entries(islandPalette).map(([name, value]) => [name, hex(value)])
) as Record<keyof typeof islandPalette, Rgba>
const transparent: Rgba = [0, 0, 0, 0]
const lipShadow: Rgba = [10, 60, 110, 96]
const shell = {
  pink: hex('#f7a9a0'),
  white: hex('#ffffff'),
  star: hex('#f08a4b'),
  dark: hex('#c9b27c')
}

// ---- Terrain --------------------------------------------------------------

const smooth = (t: number) => t * t * (3 - 2 * t)

// Which ground an art pixel shows. Tiles are blended between their centers and
// broken up with noise, so coasts and ground borders curve across tiles and
// always join up with their neighbors. Decks are the exception: boards keep to
// their tiles, and the shore neither erodes toward a deck nor grows around it.
export function terrainClass(world: IslandWorld, px: number, py: number) {
  const own = groundAt(world, Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE))
  if (own === DECK) return DECK
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
  const solid = (g: Ground) => +(g !== WATER && (own !== WATER || g !== DECK))
  const land = mix(solid(g00), solid(g10), solid(g01), solid(g11))
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

const PAD = 7

// Paints the terrain for art pixels [x0, x0 + width) × [y0, y0 + height) into
// `buffer` at (bx, by). Sea pixels stay transparent for the water shader,
// except the shore face below southern coasts and the stilts below decks.
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
  // How many pixels above (x, y) the nearest deck board is, up to PAD.
  const deckAbove = (x: number, y: number) => {
    for (let d = 1; d <= PAD; d++) {
      const kind = at(x, y - d)
      if (kind === DECK) return d
      if (kind !== WATER) return 0
    }
    return 0
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x0 + x
      const py = y0 + y
      const kind = at(x, y)
      let color: Rgba = transparent
      if (kind === WATER) {
        const under = deckAbove(x, y)
        if (under) {
          const post = (((px % 16) + 16) % 16) % 11 < 2
          if (under <= 2) color = under === 1 ? c.deckEdge : c.post
          else if (post) color = under === PAD ? lipShadow : c.post
          else if (under <= 5) color = lipShadow
        } else if (at(x, y - 1) !== WATER) color = c.face
        else if (at(x, y - 2) !== WATER) color = c.faceDark
        else if (at(x, y - 3) !== WATER || at(x, y - 4) !== WATER) color = lipShadow
      } else if (kind === SAND) {
        const below = at(x, y + 1)
        const wet = (d: number) =>
          at(x - d, y) === WATER || at(x + d, y) === WATER || at(x, y - d) === WATER
        if (below === WATER) color = c.sandLight
        else if (wet(1) || wet(2)) color = c.sandWet
        else if (wet(3) && (px + py) % 2 === 0) color = c.sandWet
        else if (at(x, y - 1) === GRASS || at(x, y - 2) === GRASS) color = c.sandDark
        else if (at(x, y - 1) === DECK) color = c.sandDark
        else color = sandPixel(px, py)
      } else if (kind === GRASS) {
        if (at(x, y + 1) !== GRASS) color = c.grassDeep
        else if (at(x, y + 2) !== GRASS) color = c.grassEdge
        else if (at(x - 1, y) !== GRASS || at(x + 1, y) !== GRASS) color = c.grassEdge
        else if (at(x, y - 1) !== GRASS) color = c.grassPale
        else color = grassPixel(px, py)
      } else if (kind === DECK) {
        const row = Math.floor(py / 5)
        const boardX = (((px + (row % 2 ? 9 : 0)) % 22) + 22) % 22
        const boardY = ((py % 5) + 5) % 5
        const grain = Math.sin(px * 0.32 + valueNoise(px / 12, row, 75) * 5 + boardY * 1.8)
        if (at(x, y + 1) !== DECK || at(x - 1, y) !== DECK || at(x + 1, y) !== DECK)
          color = c.deckEdge
        else if (at(x, y - 1) !== DECK) color = c.deckLight
        else if ((at(x - 2, y) !== DECK || at(x + 2, y) !== DECK) && ((py % 16) + 16) % 16 < 3)
          color = c.post
        else if (boardY === 4 || boardX === 0) color = c.deckEdge
        else if ((boardX === 2 || boardX === 20) && boardY === 1) color = c.post
        else if (boardY === 0) color = c.deckLight
        else if (grain > 0.9) color = c.deckDark
        else if (grain < -0.8 || hash2(Math.floor(px / 22), row, 73) < 0.18) color = c.deckLight
        else color = c.deck
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

// Beach texture: wind ripples in two tones, with the odd shell or starfish.
function sandPixel(px: number, py: number): Rgba {
  const cx = Math.floor(px / 26)
  const cy = Math.floor(py / 22)
  const roll = hash2(cx, cy, 45)
  if (roll < 0.34) {
    const lx = px - (cx * 26 + 3 + Math.floor(hash2(cx, cy, 46) * 18))
    const ly = py - (cy * 22 + 3 + Math.floor(hash2(cx, cy, 47) * 14))
    if (roll < 0.1) {
      // Starfish.
      if ((lx === 0 && Math.abs(ly) <= 2) || (ly === 0 && Math.abs(lx) <= 2)) return shell.star
      if (Math.abs(lx) === 1 && ly === 1) return shell.star
      if (ly === 3 && Math.abs(lx) <= 1) return shell.dark
    } else if (roll < 0.22) {
      // Shell.
      if (ly === 0 && (lx === 0 || lx === 1)) return shell.white
      if (ly === 1 && lx >= -1 && lx <= 2) return shell.pink
      if (ly === 2 && lx >= -1 && lx <= 2) return shell.dark
    } else if (ly === 0 && (lx === 0 || lx === 1 || lx === 4)) return c.sandDark
  }
  const ripple = Math.sin(py * 0.52 + valueNoise(px / 24, py / 14, 43) * 7)
  const dune = valueNoise(px / 38, py / 23, 44)
  const speck = hash2(px, py, 41)
  if (speck < 0.02) return c.sandDark
  if (speck > 0.985) return c.sandLight
  const relief = ripple * 3 + (dune - 0.5) * 15 + (speck - 0.5) * 6
  return [c.sand[0] + relief, c.sand[1] + relief, c.sand[2] + relief, 255]
}

// Meadow: layered blades, dry tips and low moss between irregular tufts.
function grassPixel(px: number, py: number): Rgba {
  const cx = Math.floor(px / 8)
  const cy = Math.floor(py / 7)
  const ox = cx * 8 + 2 + Math.floor(hash2(cx, cy, 34) * 3)
  const oy = cy * 7 + 2 + Math.floor(hash2(cx, cy, 35) * 3)
  const lx = px - ox
  const ly = py - oy
  const tuft = hash2(cx, cy, 33)
  if (tuft < 0.44 && valueNoise(px / 30, py / 25, 32) > 0.3) {
    const shape = Math.floor(hash2(cx, cy, 36) * 3)
    if (shape === 0) {
      // One tall blade with a dry tip beside it.
      if ((lx === -1 && ly === -2) || (lx === 2 && ly === -1))
        return tuft < 0.14 ? c.pathLight : c.grassLight
      if ((lx === 0 && ly >= -2 && ly <= 0) || (lx === 1 && ly === 0)) return c.grassDark
      if (lx === 0 && ly === -3) return c.grassPale
      if (ly === 1 && lx >= -1 && lx <= 2) return c.grassEdge
    } else if (shape === 1) {
      // Three blades fanning out.
      if (Math.abs(lx) === 2 && ly === -2) return c.grassPale
      if (Math.abs(lx) === 1 && ly === -1) return c.grassLight
      if (lx === 0 && ly >= -3 && ly <= 0) return ly === -3 ? c.grassLight : c.grassDark
      if (ly === 0 && Math.abs(lx) === 1) return c.grassDark
      if (ly === 1 && Math.abs(lx) <= 2) return c.grassEdge
    } else {
      // Low clover, now and then in bloom.
      if (ly === -1 && (lx === 0 || lx === 2))
        return tuft < 0.1 && lx === 0 ? shell.white : c.grassPale
      if (ly === 0 && lx >= -1 && lx <= 2) return lx % 2 ? c.grassLight : c.grassPale
      if (ly === 1 && lx >= -1 && lx <= 3) return c.grassEdge
    }
  }
  const tone = valueNoise(px / 21, py / 17, 37) * 0.7 + valueNoise(px / 5, py / 4, 38) * 0.3
  const grain = hash2(px, py, 39)
  if (grain < 0.025) return c.grassDark
  if (grain > 0.98) return c.grassLight
  if (tone > 0.62) return c.grassLight
  if (tone < 0.36) return c.grassDark
  return c.grass
}

// Distance from each 2×2 pixel cell to the nearest land, for the sea's depth
// colors and the surf.
export const SHORE_CELL = 2
export const SHORE_RANGE = 48 // cells

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

const FAR = 1e9

// One pass of the exact squared-distance transform (Felzenszwalb & Huttenlocher).
function transformLine(
  f: Float32Array,
  n: number,
  out: Float32Array,
  hull: Int32Array,
  bounds: Float32Array
) {
  let k = 0
  hull[0] = 0
  bounds[0] = -FAR
  bounds[1] = FAR
  for (let q = 1; q < n; q++) {
    let s = 0
    while (k >= 0) {
      const p = hull[k]
      s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p)
      if (s > bounds[k]) break
      k--
    }
    k++
    hull[k] = q
    bounds[k] = s
    bounds[k + 1] = FAR
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (bounds[k + 1] < q) k++
    const p = hull[k]
    out[q] = (q - p) * (q - p) + f[p]
  }
}

// Resamples land inside a cell rectangle (cell centers), then recomputes every
// distance: the transform is linear in the field's size, so a whole pass is
// cheaper than working out how far an edit reaches.
export function updateShoreField(
  world: IslandWorld,
  field: ShoreField,
  cx0 = 0,
  cy0 = 0,
  cx1 = field.width,
  cy1 = field.height
) {
  const { width, height } = field
  for (let y = Math.max(0, cy0); y < Math.min(height, cy1); y++)
    for (let x = Math.max(0, cx0); x < Math.min(width, cx1); x++) {
      const kind = terrainClass(world, x * SHORE_CELL + 1, y * SHORE_CELL + 1)
      field.land[y * width + x] = kind === WATER || kind === DECK ? 0 : 1
    }
  const size = Math.max(width, height)
  const f = new Float32Array(size)
  const out = new Float32Array(size)
  const hull = new Int32Array(size)
  const bounds = new Float32Array(size + 1)
  const squared = new Float32Array(width * height)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = field.land[y * width + x] ? 0 : FAR
    transformLine(f, height, out, hull, bounds)
    for (let y = 0; y < height; y++) squared[y * width + x] = out[y]
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = squared[y * width + x]
    transformLine(f, width, out, hull, bounds)
    for (let x = 0; x < width; x++)
      field.distance[y * width + x] = Math.round(
        (Math.min(SHORE_RANGE, Math.sqrt(out[x])) / SHORE_RANGE) * 255
      )
  }
}
