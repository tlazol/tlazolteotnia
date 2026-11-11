import {
  COBBLE,
  DECK,
  GRASS,
  type Ground,
  groundAt,
  hash2,
  type IslandWorld,
  PATH,
  SAND,
  SOIL,
  SWAMP,
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
  // Trails and cobbles are laid over the ground and run into each other.
  const path = share(PATH)
  const cobble = share(COBBLE)
  if (
    path + cobble >
    0.5 + (valueNoise(px / 5, py / 5, 13) - 0.5) * 0.35 + (hash2(px, py, 17) - 0.5) * 0.08
  )
    return cobble - path > (valueNoise(px / 6, py / 6, 81) - 0.5) * 0.5 ? COBBLE : PATH
  const grass = share(GRASS)
  // Grass gives way to a strip of beach where land meets the sea.
  const grassNoise =
    (valueNoise(px / 7, py / 7, 19) - 0.5) * 0.4 + (hash2(px >> 1, py >> 1, 29) - 0.5) * 0.1
  if (grass - (1 - land) * 0.9 > 0.5 + grassNoise) return GRASS
  // Bare ground: whichever of sand, soil and swamp has the most of this spot,
  // counted among themselves so each runs right up to grass, trails and sea.
  const soil = share(SOIL)
  const swamp = share(SWAMP)
  if (!soil && !swamp) return SAND
  const sand = share(SAND)
  const bare = soil + swamp + sand
  // Kept under half so ground with a spot all to itself always shows there.
  const lean =
    (valueNoise(px / 6, py / 6, 83) - 0.5) * 0.8 + (hash2(px >> 1, py >> 1, 85) - 0.5) * 0.1
  const soilScore = soil / bare + lean
  const swampScore = swamp / bare - lean * 0.5
  if (soil && soilScore > sand / bare && soilScore >= swampScore) return SOIL
  return swamp && swampScore > sand / bare ? SWAMP : SAND
}

const PAD = 7

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
      } else if (kind === SOIL) {
        if (at(x, y + 1) !== SOIL) color = c.soilEdge
        else if (at(x - 1, y) !== SOIL || at(x + 1, y) !== SOIL) color = c.soilDark
        else if (at(x, y - 1) !== SOIL) color = c.soilLight
        else color = soilPixel(px, py)
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
      } else if (kind === SWAMP) {
        // Clear water lying below its banks: the bank's shadow along the top,
        // pale shallows lapping the rest of the rim.
        const bank = (d: number) =>
          at(x - d, y) !== SWAMP || at(x + d, y) !== SWAMP || at(x, y + d) !== SWAMP
        if (at(x, y - 1) !== SWAMP) color = c.lakeBank
        else if (at(x, y - 2) !== SWAMP || at(x, y - 3) !== SWAMP) color = c.lakeDeep
        else if (bank(1)) color = c.lakeShine
        else if (bank(2) || (bank(3) && (px + py) % 2 === 0)) color = c.lakeShallow
        else {
          color = swampPixel(px, py)
          // The shader takes over only in cells the shore field knows as lake.
          const cell = (v: number) => Math.floor(v / SHORE_CELL) * SHORE_CELL + 1
          if (color === transparent && at(x + cell(px) - px, y + cell(py) - py) !== SWAMP)
            color = c.lake
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

// Bare earth: soft mottling, with clods and the odd pebble.
function soilPixel(px: number, py: number): Rgba {
  const cx = Math.floor(px / 11)
  const cy = Math.floor(py / 9)
  const roll = hash2(cx, cy, 91)
  if (roll < 0.4) {
    const lx = px - (cx * 11 + 2 + Math.floor(hash2(cx, cy, 92) * 6))
    const ly = py - (cy * 9 + 2 + Math.floor(hash2(cx, cy, 93) * 4))
    if (roll < 0.08) {
      // Pebble.
      if (ly === 0 && (lx === 0 || lx === 1)) return c.cobbleLight
      if (ly === 1 && lx >= 0 && lx <= 1) return c.cobbleDark
      if (ly === 2 && lx >= 0 && lx <= 2) return c.soilEdge
    } else {
      // Clod: a lit top over a short shadow.
      if (ly === 0 && lx >= 0 && lx <= 2) return c.soilLight
      if (ly === 1 && lx >= -1 && lx <= 2) return c.soilDark
    }
  }
  const tone = valueNoise(px / 14, py / 10, 94) * 0.7 + valueNoise(px / 4, py / 3, 95) * 0.3
  const grain = hash2(px, py, 96)
  if (grain < 0.03) return c.soilDark
  if (grain > 0.975) return c.soilLight
  if (tone > 0.64) return c.soilLight
  if (tone < 0.36) return c.soilDark
  return c.soil
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
// colors and the surf, and which cells are lake, for its own water.
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
      field.lake[y * width + x] = kind === SWAMP ? 255 : 0
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
