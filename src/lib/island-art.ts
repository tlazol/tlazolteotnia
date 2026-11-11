import {
  BLACKSAND,
  BRICK,
  CLAY,
  CLOVER,
  COBBLE,
  DECK,
  DRYGRASS,
  GRASS,
  GRAVEL,
  GROUND_COUNT,
  type Ground,
  groundAt,
  HOTSPRING,
  hash2,
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
  valueNoise,
  WATER,
  WHITESAND
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
  deep: '#0f6aa8',
  swell: '#1578b6',
  ocean: '#168cc2',
  mid: '#22add0',
  shallow: '#45cdd6',
  lagoon: '#84e6d6',
  pale: '#c4f4de',
  reef: '#0e9db8',
  foam: '#f4fcf3',
  sand: '#fbe7ae',
  sandLight: '#fff7d6',
  sandDark: '#efd08c',
  sandWet: '#e2bb76',
  face: '#d6a45a',
  faceDark: '#b17d3c',
  grass: '#5cad43',
  grassLight: '#7bc650',
  grassPale: '#aadc6a',
  grassDark: '#48973e',
  grassEdge: '#357e38',
  grassDeep: '#25602d',
  path: '#e8c080',
  pathLight: '#f7da9f',
  pathDark: '#d09e5e',
  pathEdge: '#b17d44',
  soil: '#a3714a',
  soilLight: '#b98a5e',
  soilDark: '#87583a',
  soilEdge: '#684029',
  cobble: '#a9a69e',
  cobbleLight: '#c9c4b5',
  cobbleDark: '#87847d',
  cobbleGap: '#8d7653',
  cobbleSand: '#dcc594',
  cobbleSandDark: '#c0a273',
  lake: '#3d9bdc',
  lakeDeep: '#2a7fc8',
  lakeShallow: '#72c4ee',
  lakeShine: '#d8f4fb',
  lakeBank: '#7a5a3a',
  pad: '#8ccb55',
  padDark: '#4f9641',
  padBloom: '#f7bccb',
  shoal: '#6fd3d8',
  shoalDeep: '#4dbfd0',
  shoalShallow: '#a6ebdc',
  shoalShine: '#f0fdf4',
  spring: '#a3dcd6',
  springDeep: '#7fc5c8',
  springShallow: '#cbf0e6',
  springShine: '#ffffff',
  springBank: '#8b8478',
  deck: '#bd8950',
  deckLight: '#deb078',
  deckDark: '#986838',
  deckEdge: '#6f4827',
  post: '#5e3620',
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

// Grounds meet their neighbors by family: paving lies over everything, greens
// grow into one another, and bare ground and fresh water share what is left.
const PAVED = 1
const GREEN = 2
const BARE = 3
const FAMILY = new Uint8Array(GROUND_COUNT)
for (const ground of [PATH, COBBLE, BRICK]) FAMILY[ground] = PAVED
for (const ground of [GRASS, MOSS, DRYGRASS, CLOVER, STEPPING]) FAMILY[ground] = GREEN
for (const ground of [
  SAND,
  SOIL,
  SWAMP,
  WHITESAND,
  BLACKSAND,
  CLAY,
  MUD,
  GRAVEL,
  ROCK,
  LAVA,
  SHALLOWS,
  HOTSPRING
])
  FAMILY[ground] = BARE

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
  const share = (g: Ground) => mix(+(g00 === g), +(g10 === g), +(g01 === g), +(g11 === g))
  // How much of this spot belongs to grounds of one family.
  const cover = (family: number) =>
    mix(
      +(FAMILY[g00] === family),
      +(FAMILY[g10] === family),
      +(FAMILY[g01] === family),
      +(FAMILY[g11] === family)
    )
  // The ground of a family with the best score here, among the four around.
  const leading = (family: number, score: (g: Ground, part: number) => number) => {
    let winner: Ground = g00
    let top = Number.NEGATIVE_INFINITY
    const consider = (g: Ground) => {
      if (FAMILY[g] !== family || (g === winner && top > Number.NEGATIVE_INFINITY)) return
      const value = score(g, share(g))
      if (value > top) {
        top = value
        winner = g
      }
    }
    consider(g00)
    consider(g10)
    consider(g01)
    consider(g11)
    return winner
  }
  // A ground's own noise, so its border with a neighbor wanders.
  const sway = (g: Ground, reach: number) => (valueNoise(px / 6, py / 6, 120 + g) - 0.5) * reach
  // Trails and paving are laid over the ground and run into each other.
  if (
    cover(PAVED) >
    0.5 + (valueNoise(px / 5, py / 5, 13) - 0.5) * 0.35 + (hash2(px, py, 17) - 0.5) * 0.08
  )
    return leading(PAVED, (g, part) =>
      g === PATH
        ? part
        : g === COBBLE
          ? part - (valueNoise(px / 6, py / 6, 81) - 0.5) * 0.5
          : part + sway(g, 0.3)
    )
  // Greens give way to a strip of beach where land meets the sea.
  const grassNoise =
    (valueNoise(px / 7, py / 7, 19) - 0.5) * 0.4 + (hash2(px >> 1, py >> 1, 29) - 0.5) * 0.1
  if (cover(GREEN) - (1 - land) * 0.9 > 0.5 + grassNoise)
    return leading(GREEN, (g, part) => (g === GRASS ? part : part + sway(g, 0.5)))
  // Bare ground: whichever kind has the most of this spot, counted among
  // themselves so each runs right up to grass, trails and sea.
  const bare = cover(BARE)
  if (!bare) return SAND
  // Kept under half so ground with a spot all to itself always shows there.
  const lean =
    (valueNoise(px / 6, py / 6, 83) - 0.5) * 0.8 + (hash2(px >> 1, py >> 1, 85) - 0.5) * 0.1
  return leading(BARE, (g, part) =>
    g === SAND
      ? part / bare
      : g === SOIL
        ? part / bare + lean
        : g === SWAMP
          ? part / bare - lean * 0.5
          : part / bare + sway(g, 0.7)
  )
}

const PAD = 7

// What the shore field's `lake` holds for each kind of fresh water; a lake is 255.
export const POOL_MASK = { shallows: 170, spring: 85 } as const

// Paints the terrain for art pixels [x0, x0 + width) × [y0, y0 + height) into
// `buffer` at (bx, by). Sea pixels stay transparent for the water shader,
// except the shore face below southern coasts and the stilts below decks; so
// does the open water of a lake, wherever the shore field marks it as one.
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
      const sand = sands[kind]
      const green = greens[kind]
      const solid = solids[kind]
      const pool = pools[kind]
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
      } else if (sand) {
        const below = at(x, y + 1)
        const wet = (d: number) =>
          at(x - d, y) === WATER || at(x + d, y) === WATER || at(x, y - d) === WATER
        if (below === WATER) color = sand.light
        else if (wet(1) || wet(2)) color = sand.wet
        else if (wet(3) && (px + py) % 2 === 0) color = sand.wet
        else if (isGreen(at(x, y - 1)) || isGreen(at(x, y - 2))) color = sand.dark
        else if (at(x, y - 1) === DECK) color = sand.dark
        else color = sand.pixel(px, py)
      } else if (green) {
        // Greens shade their rim only where the green ends, not against each other.
        if (!isGreen(at(x, y + 1))) color = green.deep
        else if (!isGreen(at(x, y + 2))) color = green.edge
        else if (!isGreen(at(x - 1, y)) || !isGreen(at(x + 1, y))) color = green.edge
        else if (!isGreen(at(x, y - 1))) color = green.pale
        else color = green.pixel(px, py)
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
      } else if (solid) {
        if (at(x, y + 1) !== kind) color = solid.edge
        else if (at(x - 1, y) !== kind || at(x + 1, y) !== kind) color = solid.dark
        else if (at(x, y - 1) !== kind) color = solid.light
        else color = solid.pixel(px, py)
      } else if (kind === COBBLE) {
        // The paving frays at its edges, where sand has crept in over the stones.
        const frayed = (d: number) =>
          at(x, y + d) !== COBBLE ||
          at(x, y - d) !== COBBLE ||
          at(x - d, y) !== COBBLE ||
          at(x + d, y) !== COBBLE
        if (frayed(1)) color = c.cobbleGap
        else if (hash2(px >> 1, py >> 1, 107) < (frayed(2) ? 0.15 : frayed(3) ? 0.04 : 0))
          color = hash2(px, py, 108) < 0.25 ? c.cobbleSandDark : c.cobbleSand
        else color = cobblePixel(px, py)
      } else if (pool) {
        // Clear water lying below its banks: the bank's shadow along the top,
        // pale shallows lapping the rest of the rim.
        const bank = (d: number) =>
          at(x - d, y) !== kind || at(x + d, y) !== kind || at(x, y + d) !== kind
        if (at(x, y - 1) !== kind) color = pool.bank
        else if (at(x, y - 2) !== kind || at(x, y - 3) !== kind) color = pool.deep
        else if (bank(1)) color = pool.shine
        else if (bank(2) || (bank(3) && (px + py) % 2 === 0)) color = pool.shallow
        else {
          color = pool.pixel(px, py)
          // The shader takes over only in cells the shore field knows as this water.
          const cell = (v: number) => Math.floor(v / SHORE_CELL) * SHORE_CELL + 1
          if (color === transparent && at(x + cell(px) - px, y + cell(py) - py) !== kind)
            color = pool.base
        }
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

type SandTones = { base: Rgba; light: Rgba; dark: Rgba }

// Beach texture: wind ripples in two tones, with the odd shell or starfish.
function sandPixel(px: number, py: number, t: SandTones): Rgba {
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
    } else if (ly === 0 && (lx === 0 || lx === 1 || lx === 4)) return t.dark
  }
  const ripple = Math.sin(py * 0.52 + valueNoise(px / 24, py / 14, 43) * 7)
  const dune = valueNoise(px / 38, py / 23, 44)
  const speck = hash2(px, py, 41)
  if (speck < 0.02) return t.dark
  if (speck > 0.985) return t.light
  const relief = ripple * 3 + (dune - 0.5) * 15 + (speck - 0.5) * 6
  return [t.base[0] + relief, t.base[1] + relief, t.base[2] + relief, 255]
}

type SolidTones = { base: Rgba; light: Rgba; dark: Rgba; edge: Rgba }

// Bare earth: soft mottling, with clods and the odd pebble.
function soilPixel(px: number, py: number, t: SolidTones, seed = 0): Rgba {
  const cx = Math.floor(px / 11)
  const cy = Math.floor(py / 9)
  const roll = hash2(cx, cy, 91 + seed)
  if (roll < 0.4) {
    const lx = px - (cx * 11 + 2 + Math.floor(hash2(cx, cy, 92 + seed) * 6))
    const ly = py - (cy * 9 + 2 + Math.floor(hash2(cx, cy, 93 + seed) * 4))
    if (roll < 0.08) {
      // Pebble.
      if (ly === 0 && (lx === 0 || lx === 1)) return c.cobbleLight
      if (ly === 1 && lx >= 0 && lx <= 1) return c.cobbleDark
      if (ly === 2 && lx >= 0 && lx <= 2) return t.edge
    } else {
      // Clod: a lit top over a short shadow.
      if (ly === 0 && lx >= 0 && lx <= 2) return t.light
      if (ly === 1 && lx >= -1 && lx <= 2) return t.dark
    }
  }
  const tone =
    valueNoise(px / 14, py / 10, 94 + seed) * 0.7 + valueNoise(px / 4, py / 3, 95 + seed) * 0.3
  const grain = hash2(px, py, 96 + seed)
  if (grain < 0.03) return t.dark
  if (grain > 0.975) return t.light
  if (tone > 0.64) return t.light
  if (tone < 0.36) return t.dark
  return t.base
}

// Old cobbles: courses of rounded stones of uneven width, with a little sand
// caught in the joints and in the odd gap where a stone has gone missing.
function cobblePixel(px: number, py: number): Rgba {
  const grit = hash2(px, py, 104)
  const sand = grit < 0.2 ? c.cobbleSandDark : c.cobbleSand
  const drift = valueNoise(px / 10, py / 8, 105) * 0.65 + valueNoise(px / 3, py / 3, 106) * 0.35
  if (drift > 0.86 || (drift > 0.83 && (px + py) % 2 === 0)) return sand
  const row = Math.floor(py / 6)
  const ly = ((py % 6) + 6) % 6
  // Stones are 6 to 9 wide; a course is cut from a strip that repeats every 30.
  const shift = Math.floor(hash2(row, 0, 101) * 30)
  const strip = Math.floor((px + shift) / 30)
  let lx = (((px + shift) % 30) + 30) % 30
  const widths = [
    [7, 8, 6, 9],
    [9, 6, 8, 7],
    [6, 9, 7, 8]
  ][Math.floor(hash2(row, 1, 102) * 3)]
  let stone = 0
  while (lx >= widths[stone]) lx -= widths[stone++]
  const width = widths[stone]
  const joint = grit < 0.1 ? c.cobbleSandDark : c.cobbleGap
  if (lx === 0 || ly === 5) return joint
  const shade = hash2(strip * 4 + stone, row, 103)
  // A missing stone leaves a hollow of sand, shaded along its upper lip.
  if (shade < 0.02) return ly === 0 || lx === 1 ? c.cobbleGap : sand
  // Clipped corners round each stone off; worn ones have lost more.
  const worn = shade > 0.7 ? 1 : 0
  const fromSide = Math.min(lx - 1, width - 1 - lx)
  const fromEnd = Math.min(ly, 4 - ly)
  if (fromSide + fromEnd <= worn) return joint
  // Cracked right across.
  if (shade > 0.86 && lx === Math.floor(width / 2) + (ly > 2 ? 1 : 0)) return c.cobbleGap
  // Sand caught against the foot of the stone and in its pits.
  if (ly === 4) return grit < 0.07 ? c.cobbleSandDark : c.cobbleDark
  if (grit > 0.985) return c.cobbleSand
  if (ly === 0 || (lx === 1 && ly < 4)) return shade < 0.3 ? c.cobble : c.cobbleLight
  if (lx === width - 1 || grit > 0.88) return c.cobbleDark
  return shade < 0.3 ? c.cobbleDark : shade > 0.78 ? c.cobbleLight : c.cobble
}

// What stands in a lake: the odd lily pad floating on it and reeds growing out
// of it.
// The water between them is left transparent for the water shader.
function swampPixel(px: number, py: number): Rgba {
  const cx = Math.floor(px / 19)
  const cy = Math.floor(py / 15)
  const roll = hash2(cx, cy, 114)
  if (roll < 0.2) {
    const lx = px - (cx * 19 + 4 + Math.floor(hash2(cx, cy, 115) * 10))
    const ly = py - (cy * 15 + 5 + Math.floor(hash2(cx, cy, 116) * 6))
    if (roll < 0.12) {
      // Lily pad, a notch cut from one side, now and then in flower.
      if (ly === -1 && Math.abs(lx) <= 1) return lx === 0 && roll < 0.04 ? c.padBloom : c.pad
      if (ly === 0 && lx >= -2 && lx <= 1) return c.pad
      if (ly === 1 && Math.abs(lx) <= 1) return c.padDark
      if (ly === 2 && lx >= -2 && lx <= 2) return c.lakeDeep
    } else {
      // Reeds, each ringed by a ripple where it breaks the surface.
      if (lx === 0 && ly >= -4 && ly <= 0) return ly === -4 ? c.soilDark : c.padDark
      if (lx === 2 && ly >= -2 && ly <= 0) return c.padDark
      if (ly === 1 && lx >= -1 && lx <= 3) return c.lakeShine
      if (ly === 2 && lx >= -2 && lx <= 4) return c.lakeDeep
    }
  }
  return transparent
}

type GreenTones = {
  base: Rgba
  light: Rgba
  pale: Rgba
  dark: Rgba
  edge: Rgba
  deep: Rgba
  // The tip of a dried blade.
  dry: Rgba
}

// Meadow: layered blades, dry tips and low moss between irregular tufts.
function grassPixel(px: number, py: number, t: GreenTones, seed = 0): Rgba {
  const cx = Math.floor(px / 8)
  const cy = Math.floor(py / 7)
  const ox = cx * 8 + 2 + Math.floor(hash2(cx, cy, 34 + seed) * 3)
  const oy = cy * 7 + 2 + Math.floor(hash2(cx, cy, 35 + seed) * 3)
  const lx = px - ox
  const ly = py - oy
  const tuft = hash2(cx, cy, 33 + seed)
  if (tuft < 0.44 && valueNoise(px / 30, py / 25, 32 + seed) > 0.3) {
    const shape = Math.floor(hash2(cx, cy, 36 + seed) * 3)
    if (shape === 0) {
      // One tall blade with a dry tip beside it.
      if ((lx === -1 && ly === -2) || (lx === 2 && ly === -1)) return tuft < 0.14 ? t.dry : t.light
      if ((lx === 0 && ly >= -2 && ly <= 0) || (lx === 1 && ly === 0)) return t.dark
      if (lx === 0 && ly === -3) return t.pale
      if (ly === 1 && lx >= -1 && lx <= 2) return t.edge
    } else if (shape === 1) {
      // Three blades fanning out.
      if (Math.abs(lx) === 2 && ly === -2) return t.pale
      if (Math.abs(lx) === 1 && ly === -1) return t.light
      if (lx === 0 && ly >= -3 && ly <= 0) return ly === -3 ? t.light : t.dark
      if (ly === 0 && Math.abs(lx) === 1) return t.dark
      if (ly === 1 && Math.abs(lx) <= 2) return t.edge
    } else {
      // Low clover, now and then in bloom.
      if (ly === -1 && (lx === 0 || lx === 2)) return tuft < 0.1 && lx === 0 ? shell.white : t.pale
      if (ly === 0 && lx >= -1 && lx <= 2) return lx % 2 ? t.light : t.pale
      if (ly === 1 && lx >= -1 && lx <= 3) return t.edge
    }
  }
  const tone =
    valueNoise(px / 21, py / 17, 37 + seed) * 0.7 + valueNoise(px / 5, py / 4, 38 + seed) * 0.3
  const grain = hash2(px, py, 39 + seed)
  if (grain < 0.025) return t.dark
  if (grain > 0.98) return t.light
  if (tone > 0.62) return t.light
  if (tone < 0.36) return t.dark
  return t.base
}

// Moss: low cushions, each lit on its crown, over a soft dark mat.
function mossPixel(px: number, py: number): Rgba {
  const t = mossTones
  const cx = Math.floor(px / 7)
  const cy = Math.floor(py / 6)
  if (hash2(cx, cy, 131) < 0.32) {
    const lx = px - (cx * 7 + 2 + Math.floor(hash2(cx, cy, 132) * 3))
    const ly = py - (cy * 6 + 1 + Math.floor(hash2(cx, cy, 133) * 3))
    if (ly === 0 && lx >= 0 && lx <= 2) return t.pale
    if (ly === 1 && lx >= -1 && lx <= 3) return t.light
    if (ly === 2 && lx >= -1 && lx <= 3) return t.edge
  }
  const tone = valueNoise(px / 12, py / 9, 134) * 0.6 + valueNoise(px / 3, py / 3, 135) * 0.4
  const grain = hash2(px, py, 136)
  if (grain < 0.04) return t.edge
  if (grain > 0.975) return t.pale
  if (tone > 0.6) return t.light
  if (tone < 0.42) return t.dark
  return t.base
}

// Clover: a carpet of three-leaved sprigs, here and there a white bloom.
function cloverPixel(px: number, py: number): Rgba {
  const t = cloverTones
  const cx = Math.floor(px / 5)
  const cy = Math.floor(py / 5)
  const roll = hash2(cx, cy, 141)
  const lx = px - (cx * 5 + 1 + Math.floor(hash2(cx, cy, 142) * 2))
  const ly = py - (cy * 5 + 1 + Math.floor(hash2(cx, cy, 143) * 2))
  if (roll < 0.09) {
    if ((ly === 0 || ly === 1) && (lx === 0 || lx === 1)) return ly ? cloverBloomShade : shell.white
    if (ly === 2 && lx === 0) return t.dark
  } else if (roll < 0.8) {
    if ((ly === 0 && lx === 1) || (ly === 1 && (lx === 0 || lx === 2)))
      return roll < 0.4 ? t.pale : t.light
    if (ly === 1 && lx === 1) return t.dark
    if (ly === 2 && lx >= 0 && lx <= 2) return t.edge
  }
  const tone = valueNoise(px / 15, py / 12, 144)
  if (hash2(px, py, 145) < 0.03) return t.edge
  return tone < 0.4 ? t.dark : t.base
}

// Stepping stones: one worn slab to a tile, the meadow growing round it.
function steppingPixel(px: number, py: number): Rgba {
  const tx = Math.floor(px / TILE_SIZE)
  const ty = Math.floor(py / TILE_SIZE)
  const cx = tx * TILE_SIZE + 8 + (hash2(tx, ty, 201) - 0.5) * 2
  const cy = ty * TILE_SIZE + 8 + (hash2(tx, ty, 202) - 0.5) * 2
  const rx = 5 + hash2(tx, ty, 203) * 1.2
  const ry = 3.6 + hash2(tx, ty, 204) * 0.8
  const reach = (x: number, y: number) =>
    ((x + 0.5 - cx) / rx) ** 2 +
    ((y + 0.5 - cy) / ry) ** 2 +
    (valueNoise(x / 2.5, y / 2.5, 205) - 0.5) * 0.3
  if (reach(px, py) > 1) return reach(px, py - 1) > 1 ? grassPixel(px, py, grassTones) : c.grassEdge
  if (reach(px, py + 1) > 1) return c.cobbleDark
  if (reach(px, py - 1) > 1) return c.cobbleLight
  const grain = hash2(px, py, 206)
  if (grain < 0.06) return c.cobbleDark
  return grain > 0.9 || hash2(tx, ty, 207) < 0.3 ? c.cobbleLight : c.cobble
}

// Mud: ruts of wet earth with standing puddles that catch the sky.
function mudPixel(px: number, py: number): Rgba {
  const t = mudTones
  const puddle = (y: number) => valueNoise(px / 11, y / 8, 151) > 0.68
  if (puddle(py)) {
    if (!puddle(py - 1)) return t.edge
    return !puddle(py - 2) || hash2(px >> 1, py, 153) < 0.06 ? mudShine : mudPuddle
  }
  const rut = Math.sin(py * 0.7 + valueNoise(px / 16, py / 9, 152) * 6)
  const grain = hash2(px, py, 154)
  if (grain < 0.03) return t.edge
  if (rut > 0.82 || grain > 0.975) return t.light
  if (rut < -0.8) return t.dark
  return valueNoise(px / 9, py / 7, 155) < 0.4 ? t.dark : t.base
}

// Gravel: small stones of mixed color packed in uneven rows.
function gravelPixel(px: number, py: number): Rgba {
  const t = gravelTones
  const row = Math.floor(py / 3)
  const shift = (row % 2) * 2 + Math.floor(hash2(row, 0, 161) * 2)
  const stone = Math.floor((px + shift) / 4)
  const lx = px + shift - stone * 4
  const ly = py - row * 3
  const shade = hash2(stone, row, 162)
  if (lx === 3 || (ly === 2 && shade < 0.55)) return gravelGap
  if (shade > 0.9) return ly === 0 ? gravelWarm : gravelWarmDark
  if (ly === 0) return shade < 0.3 ? t.base : t.light
  if (ly === 2) return t.dark
  return shade < 0.3 ? t.dark : shade > 0.7 ? t.light : t.base
}

// Bare rock: tilted plates divided by cracks, each crack lit along its lower lip.
function rockPixel(px: number, py: number): Rgba {
  const t = rockTones
  const level = (y: number) => valueNoise(px / 13, y / 10, 171) * 4
  const cracked = (y: number) => Math.abs((level(y) % 1) - 0.5) < 0.035
  if (cracked(py)) return rockCrack
  if (cracked(py - 1)) return t.light
  const grain = hash2(px, py, 173)
  if (grain < 0.012) return rockLichen
  const shade =
    (Math.floor(level(py) + 0.5) % 2 ? 0.14 : -0.06) +
    (valueNoise(px / 5, py / 4, 172) - 0.5) * 0.7 +
    (grain - 0.5) * 0.25
  return shade > 0.2 ? t.light : shade < -0.2 ? t.dark : t.base
}

// Cooled lava: ropes of black rock, the deepest cracks still glowing.
function lavaPixel(px: number, py: number): Rgba {
  const t = lavaTones
  const crack = Math.abs(((valueNoise(px / 11, py / 9, 181) * 5) % 1) - 0.5)
  if (crack < 0.04) {
    if (valueNoise(px / 28, py / 22, 182) < 0.55) return lavaCrack
    return crack < 0.014 ? lavaBright : lavaGlow
  }
  const rope = Math.sin(py * 0.8 + valueNoise(px / 9, py / 7, 183) * 7)
  const grain = hash2(px, py, 184)
  if (grain < 0.04) return lavaCrack
  if (rope > 0.75) return t.light
  if (rope < -0.8 || grain > 0.93) return t.dark
  return t.base
}

// Brick paving: courses laid half a brick apart, fired to uneven reds.
function brickPixel(px: number, py: number): Rgba {
  const t = brickTones
  const row = Math.floor(py / 4)
  const ly = py - row * 4
  const shift = row % 2 ? 4 : 0
  const brick = Math.floor((px + shift) / 8)
  const lx = px + shift - brick * 8
  const grain = hash2(px, py, 191)
  if (lx === 0 || ly === 3) return grain < 0.15 ? brickMortarDark : brickMortar
  const shade = hash2(brick, row, 192)
  if (ly === 0) return shade < 0.3 ? t.base : t.light
  if (lx === 7 || grain > 0.92) return t.dark
  return shade < 0.25 ? t.dark : shade > 0.8 ? t.light : t.base
}

// ---- Ground looks -----------------------------------------------------------

const tones = <Name extends string>(values: Record<Name, string>) =>
  Object.fromEntries(
    Object.entries<string>(values).map(([name, value]) => [name, hex(value)])
  ) as Record<Name, Rgba>

const grassTones: GreenTones = {
  base: c.grass,
  light: c.grassLight,
  pale: c.grassPale,
  dark: c.grassDark,
  edge: c.grassEdge,
  deep: c.grassDeep,
  dry: c.pathLight
}
const mossTones: GreenTones = tones({
  base: '#4f8f4d',
  light: '#66a659',
  pale: '#8cc070',
  dark: '#3f7a45',
  edge: '#2f653b',
  deep: '#214b30',
  dry: '#8cc070'
})
const dryGrassTones: GreenTones = tones({
  base: '#c8b356',
  light: '#dccb72',
  pale: '#efe29b',
  dark: '#ad9746',
  edge: '#8d7838',
  deep: '#6b592b',
  dry: '#f6efc8'
})
const cloverTones: GreenTones = tones({
  base: '#5fb548',
  light: '#7fd05a',
  pale: '#b4e77c',
  dark: '#4a9c40',
  edge: '#34803a',
  deep: '#25602d',
  dry: '#b4e77c'
})
const cloverBloomShade = hex('#f1d3df')

const soilTones: SolidTones = {
  base: c.soil,
  light: c.soilLight,
  dark: c.soilDark,
  edge: c.soilEdge
}
const clayTones: SolidTones = tones({
  base: '#bf6239',
  light: '#d67f52',
  dark: '#a04c2c',
  edge: '#783420'
})
const mudTones: SolidTones = tones({
  base: '#6d5846',
  light: '#836c57',
  dark: '#584536',
  edge: '#3e2f25'
})
const mudPuddle = hex('#5b666b')
const mudShine = hex('#a3b6ba')
const gravelTones: SolidTones = tones({
  base: '#b3ab9a',
  light: '#d1cab9',
  dark: '#918a7b',
  edge: '#59534a'
})
const gravelGap = hex('#6d665b')
const gravelWarm = hex('#d0ac88')
const gravelWarmDark = hex('#a98463')
const rockTones: SolidTones = tones({
  base: '#8e9387',
  light: '#a9ae9f',
  dark: '#72776a',
  edge: '#44483f'
})
const rockCrack = hex('#53584f')
const rockLichen = hex('#bcc58d')
const lavaTones: SolidTones = tones({
  base: '#3c3638',
  light: '#564d4f',
  dark: '#2b2628',
  edge: '#121011'
})
const lavaCrack = hex('#181415')
const lavaGlow = hex('#ff7a2e')
const lavaBright = hex('#ffd166')
const brickTones: SolidTones = tones({
  base: '#b8573f',
  light: '#cf7159',
  dark: '#964231',
  edge: '#6c2e21'
})
const brickMortar = hex('#d9c5a3')
const brickMortarDark = hex('#b89f7c')

type Pixel = (px: number, py: number) => Rgba
const isGreen = (kind: number) => FAMILY[kind] === GREEN

// How each ground is painted, indexed by ground. Sands lighten toward the
// water, greens and solid grounds shade their rims, pools lie below a bank.
const sands: Array<{ light: Rgba; wet: Rgba; dark: Rgba; pixel: Pixel } | undefined> = []
const beach: SandTones = { base: c.sand, light: c.sandLight, dark: c.sandDark }
const whiteBeach: SandTones = tones({ base: '#fbf5e4', light: '#ffffff', dark: '#e8dcc0' })
const blackBeach: SandTones = tones({ base: '#504e58', light: '#6c6a76', dark: '#3d3b45' })
sands[SAND] = { ...beach, wet: c.sandWet, pixel: (px, py) => sandPixel(px, py, beach) }
sands[WHITESAND] = {
  ...whiteBeach,
  wet: hex('#d6c7a4'),
  pixel: (px, py) => sandPixel(px, py, whiteBeach)
}
sands[BLACKSAND] = {
  ...blackBeach,
  wet: hex('#2f2d37'),
  pixel: (px, py) => sandPixel(px, py, blackBeach)
}

const greens: Array<(GreenTones & { pixel: Pixel }) | undefined> = []
greens[GRASS] = { ...grassTones, pixel: (px, py) => grassPixel(px, py, grassTones) }
greens[MOSS] = { ...mossTones, pixel: mossPixel }
greens[DRYGRASS] = { ...dryGrassTones, pixel: (px, py) => grassPixel(px, py, dryGrassTones, 300) }
greens[CLOVER] = { ...cloverTones, pixel: cloverPixel }
greens[STEPPING] = { ...grassTones, pixel: steppingPixel }

const solids: Array<(SolidTones & { pixel: Pixel }) | undefined> = []
solids[SOIL] = { ...soilTones, pixel: (px, py) => soilPixel(px, py, soilTones) }
solids[CLAY] = { ...clayTones, pixel: (px, py) => soilPixel(px, py, clayTones, 300) }
solids[MUD] = { ...mudTones, pixel: mudPixel }
solids[GRAVEL] = { ...gravelTones, pixel: gravelPixel }
solids[ROCK] = { ...rockTones, pixel: rockPixel }
solids[LAVA] = { ...lavaTones, pixel: lavaPixel }
solids[BRICK] = { ...brickTones, pixel: brickPixel }

// Pools leave their open water transparent for the water shader, which tells
// them apart by `mask` in the shore field.
const clear: Pixel = () => transparent
const pools: Array<
  | { bank: Rgba; deep: Rgba; shine: Rgba; shallow: Rgba; base: Rgba; pixel: Pixel; mask: number }
  | undefined
> = []
pools[SWAMP] = {
  bank: c.lakeBank,
  deep: c.lakeDeep,
  shine: c.lakeShine,
  shallow: c.lakeShallow,
  base: c.lake,
  pixel: swampPixel,
  mask: 255
}
pools[SHALLOWS] = {
  bank: c.sandWet,
  deep: c.shoalDeep,
  shine: c.shoalShine,
  shallow: c.shoalShallow,
  base: c.shoal,
  pixel: clear,
  mask: POOL_MASK.shallows
}
pools[HOTSPRING] = {
  bank: c.springBank,
  deep: c.springDeep,
  shine: c.springShine,
  shallow: c.springShallow,
  base: c.spring,
  pixel: clear,
  mask: POOL_MASK.spring
}

// Distance from each 2×2 pixel cell to the nearest land, for the sea's depth
// colors and the surf, and which cells are fresh water, and of which kind.
export const SHORE_CELL = 2
export const SHORE_RANGE = 48 // cells

export function createShoreField(world: IslandWorld) {
  const width = (world.columns * TILE_SIZE) / SHORE_CELL
  const height = (world.rows * TILE_SIZE) / SHORE_CELL
  return {
    width,
    height,
    land: new Uint8Array(width * height),
    lake: new Uint8Array(width * height),
    distance: new Uint8Array(width * height),
    // The same distances carried on past the map's edge, as far as they reach,
    // so the sea's colors run out into the open water instead of stopping there.
    sea: new Uint8Array((width + 2 * SHORE_RANGE) * (height + 2 * SHORE_RANGE))
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
      field.lake[y * width + x] = pools[kind]?.mask ?? 0
    }
  const pad = SHORE_RANGE
  const wide = width + 2 * pad
  const tall = height + 2 * pad
  const size = Math.max(wide, tall)
  const f = new Float32Array(size)
  const out = new Float32Array(size)
  const hull = new Int32Array(size)
  const bounds = new Float32Array(size + 1)
  const squared = new Float32Array(wide * tall)
  for (let x = 0; x < wide; x++) {
    const inside = x >= pad && x < pad + width
    for (let y = 0; y < tall; y++)
      f[y] =
        inside && y >= pad && y < pad + height && field.land[(y - pad) * width + x - pad] ? 0 : FAR
    transformLine(f, tall, out, hull, bounds)
    for (let y = 0; y < tall; y++) squared[y * wide + x] = out[y]
  }
  for (let y = 0; y < tall; y++) {
    for (let x = 0; x < wide; x++) f[x] = squared[y * wide + x]
    transformLine(f, wide, out, hull, bounds)
    for (let x = 0; x < wide; x++)
      field.sea[y * wide + x] = Math.round(
        (Math.min(SHORE_RANGE, Math.sqrt(out[x])) / SHORE_RANGE) * 255
      )
  }
  for (let y = 0; y < height; y++)
    field.distance.set(
      field.sea.subarray((y + pad) * wide + pad, (y + pad) * wide + pad + width),
      y * width
    )
}
