import {
  blit,
  createBuffer,
  hex,
  islandPalette,
  outline,
  type PixelBuffer,
  type Rgba,
  setPixel
} from './island-art'
import { paintResidentSheet, RESIDENT_FRAME, type ResidentDesign } from './island-residents'
import { hash2 } from './island-world'

// Art for the loading screen: the same sea and the same residents as the
// island, painted once so the animation itself can run on CSS transforms while
// the renderer keeps the main thread busy.

// Both sea layers repeat every SEA_TILE art pixels in each direction.
export const SEA_TILE = 320
export const BOAT_FRAME = { width: 46, height: 29 } as const
export const BOAT_FRAMES = 2

const c = {
  ocean: hex(islandPalette.ocean),
  mid: hex(islandPalette.mid),
  shallow: hex(islandPalette.shallow),
  lagoon: hex(islandPalette.lagoon),
  reef: hex(islandPalette.reef),
  foam: hex(islandPalette.foam),
  deck: hex(islandPalette.deck),
  deckLight: hex(islandPalette.deckLight),
  deckDark: hex(islandPalette.deckDark),
  deckEdge: hex(islandPalette.deckEdge),
  post: hex(islandPalette.post),
  outline: hex(islandPalette.outline)
}

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const dither = (x: number, y: number) => bayer[(y & 3) * 4 + (x & 3)] / 16 - 0.5

// Value noise sampled every `cell` art pixels that wraps at the tile's edge, so
// the tile has no seam. `cell` must divide SEA_TILE.
function tileNoise(px: number, py: number, cellX: number, cellY: number, seed: number) {
  const x = px / cellX
  const y = py / cellY
  const wrapX = SEA_TILE / cellX
  const wrapY = SEA_TILE / cellY
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const at = (ix: number, iy: number) =>
    hash2(((ix % wrapX) + wrapX) % wrapX, ((iy % wrapY) + wrapY) % wrapY, seed)
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
  return top + (bottom - top) * sy
}

const mix = (a: Rgba, b: Rgba, t: number): Rgba => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
  255
]

// Turquoise water in the island's own depth bands, with reef showing through.
function paintSea() {
  const sea = createBuffer(SEA_TILE, SEA_TILE)
  for (let y = 0; y < SEA_TILE; y++) {
    for (let x = 0; x < SEA_TILE; x++) {
      const depth =
        tileNoise(x, y, 80, 40, 11) * 0.72 +
        tileNoise(x, y, 16, 10, 23) * 0.28 +
        dither(x, y) * 0.07
      let color = c.mid
      if (depth < 0.33) color = c.ocean
      else if (depth > 0.78) color = c.lagoon
      else if (depth > 0.58) color = c.shallow
      const reef = tileNoise(x, y, 32, 32, 37) * 0.72 + tileNoise(x, y, 8, 8, 41) * 0.28
      if (depth > 0.4 && reef + dither(x, y) * 0.05 > 0.64)
        color = mix(color, c.reef, reef > 0.71 ? 0.45 : 0.25)
      setPixel(sea, x, y, color)
    }
  }
  return sea
}

// Light rippling over the water, wave dashes and glints of sun: a clear layer
// that drifts faster than the sea below it.
function paintShimmer() {
  const shimmer = createBuffer(SEA_TILE, SEA_TILE)
  const foam = (alpha: number): Rgba => [c.foam[0], c.foam[1], c.foam[2], Math.round(alpha * 255)]
  for (let y = 0; y < SEA_TILE; y++) {
    for (let x = 0; x < SEA_TILE; x++) {
      const net = Math.abs(tileNoise(x, y, 16, 16, 53) - tileNoise(x + 4, y + 7, 10, 10, 67))
      if (net < 0.026) setPixel(shimmer, x, y, foam(0.3))

      const cellX = Math.floor(x / 32)
      const cellY = Math.floor(y / 16)
      const h = hash2(cellX, cellY, 71)
      if (h > 0.66) {
        const localX = x - cellX * 32
        const localY = y - cellY * 16
        const start = 3 + Math.floor(h * 9)
        const length = 3 + Math.floor(hash2(cellX, cellY, 79) * 4)
        if (localY === 5 && localX >= start && localX < start + length)
          setPixel(shimmer, x, y, foam(0.62))
        if (localY === 6 && (localX === start - 1 || localX === start + length))
          setPixel(shimmer, x, y, foam(0.34))
      }
    }
  }
  for (let gy = 0; gy < SEA_TILE / 40; gy++) {
    for (let gx = 0; gx < SEA_TILE / 40; gx++) {
      if (hash2(gx, gy, 83) < 0.72) continue
      const x = gx * 40 + 3 + Math.floor(hash2(gx, gy, 89) * 32)
      const y = gy * 40 + 3 + Math.floor(hash2(gx, gy, 97) * 32)
      const white: Rgba = [255, 255, 255, 255]
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ])
        setPixel(shimmer, x + dx, y + dy, white)
    }
  }
  return shimmer
}

function rect(buffer: PixelBuffer, x: number, y: number, w: number, h: number, color: Rgba) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setPixel(buffer, x + i, y + j, color)
}

// A rowing boat seen from the side, bow to the right.
function paintHull() {
  const hull = createBuffer(BOAT_FRAME.width, BOAT_FRAME.height)
  rect(hull, 3, 14, 3, 1, c.deckLight) // stern post
  rect(hull, 39, 13, 3, 1, c.deckLight) // raised bow
  rect(hull, 40, 14, 3, 1, c.deckLight)
  rect(hull, 3, 15, 39, 1, c.deckLight) // gunwale
  rect(hull, 4, 16, 37, 1, c.deckDark)
  rect(hull, 4, 17, 36, 2, c.deck)
  rect(hull, 5, 19, 34, 1, c.deckDark) // plank seam
  rect(hull, 6, 20, 32, 1, c.deck)
  rect(hull, 8, 21, 28, 1, c.deckEdge)
  for (let x = 9; x < 38; x += 7) setPixel(hull, x, 17, c.deckLight)
  outline(hull, c.outline)
  return hull
}

function line(buffer: PixelBuffer, ax: number, ay: number, bx: number, by: number, color: Rgba) {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
  for (let i = 0; i <= steps; i++)
    setPixel(
      buffer,
      Math.round(ax + ((bx - ax) * i) / steps),
      Math.round(ay + ((by - ay) * i) / steps),
      color
    )
}

// Two frames of a resident rowing: the oar reaches forward, then pulls back.
function paintBoat(design: ResidentDesign) {
  const { width, height } = BOAT_FRAME
  const strip = createBuffer(width * BOAT_FRAMES, height)
  const sheet = paintResidentSheet(design)
  const hull = paintHull()
  const shadow: Rgba = [10, 60, 110, 110]
  const spray: Rgba = [255, 255, 255, 255]
  for (let frame = 0; frame < BOAT_FRAMES; frame++) {
    // The boat rides two rows below the rider, so the shoulders clear the gunwale.
    const cell = createBuffer(width, height - 2)
    rect(cell, 7, 23, 32, 1, shadow)
    rect(cell, 10, 24, 26, 1, shadow)

    // The side-facing row of the sheet: sitting still, then leaning into the pull.
    const rider = createBuffer(RESIDENT_FRAME.width, RESIDENT_FRAME.height)
    blit(rider, sheet, -frame * RESIDENT_FRAME.width, -2 * RESIDENT_FRAME.height)
    blit(strip, rider, frame * width + 14, 0)
    blit(cell, hull, 0, 0)

    const blade = frame === 0 ? 32 : 18
    line(cell, 24, 14, blade, 22, c.outline)
    line(cell, 24, 13, blade, 21, c.post)
    rect(cell, blade - 1, 21, 3, 3, c.outline)
    rect(cell, blade, 21, 1, 2, c.deckLight)

    // Foam along the waterline, a wake astern and spray at the bow.
    for (let x = 6; x < 39; x++)
      if ((x + frame * 2) % 4 < 2 && Math.abs(x - blade) > 1) setPixel(cell, x, 22, c.foam)
    rect(cell, frame === 0 ? 1 : 0, 21, 3, 1, c.foam)
    rect(cell, frame === 0 ? 0 : 2, 23, 2, 1, c.foam)
    setPixel(cell, 43, frame === 0 ? 19 : 20, spray)
    setPixel(cell, 44, frame === 0 ? 21 : 19, spray)
    rect(cell, 40, 22, frame === 0 ? 3 : 4, 1, c.foam)
    if (frame === 1) rect(cell, blade - 3, 24, 2, 1, c.foam)

    blit(strip, cell, frame * width, 2)
  }
  return strip
}

export function paintLoadingArt(design: ResidentDesign) {
  return { sea: paintSea(), shimmer: paintShimmer(), boat: paintBoat(design) }
}
