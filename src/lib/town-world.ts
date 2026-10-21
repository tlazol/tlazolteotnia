import type { TownPoint } from './town-navigation'

// The whole island is described here: coastline, relief, streets, blocks and the
// sidewalk circuits that residents follow. Rendering modules only read this data.

export type Rect = { left: number; right: number; top: number; bottom: number }
export type TownSegment = { start: TownPoint; end: TownPoint }
export type WalkSegment = TownSegment & { lane: number; cycleLane: number }

// Half widths. Residents are about 70 units tall and cars 70 units long.
export const carriageway = 64
export const sidewalk = 62
export const walkerLane = carriageway + sidewalk / 2
export const cyclistLane = 50
export const carLane = 24
// Feet stand on the raised paving rather than the asphalt.
export const pavementHeight = 3

export const avenues = [-2400, -1200, 0, 1200, 2400]
export const streets = [-1650, -550, 550, 1650]
export const quayStreet = 2300
export const quayEdge = 2470
export const quayEnd = 3200
export const railway = -2250
export const railEnds = [-4150, 4550] as const
export const waterLevel = -14
export const lighthouse = { x: 3400, z: 3620 }
export const breakwater = { x: 3400, start: quayEdge - 40, end: 3500 }

export function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash2(x: number, z: number) {
  let h = Math.imul(Math.floor(x) | 0, 374761393) + Math.imul(Math.floor(z) | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, z: number) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

// Fractal noise in [0, 1].
export function fbm(x: number, z: number, octaves = 4) {
  let sum = 0
  let amplitude = 0.5
  let total = 0
  for (let octave = 0; octave < octaves; octave++) {
    sum += valueNoise(x + octave * 17.3, z - octave * 9.1) * amplitude
    total += amplitude
    x *= 2.03
    z *= 2.03
    amplitude *= 0.5
  }
  return sum / total
}

function sdBox(x: number, z: number, halfX: number, halfZ: number) {
  const qx = Math.abs(x) - halfX
  const qz = Math.abs(z) - halfZ
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0)
}

function sdRoundBox(x: number, z: number, halfX: number, halfZ: number, radius: number) {
  return sdBox(x, z, halfX - radius, halfZ - radius) - radius
}

function sdSegment(x: number, z: number, a: TownPoint, b: TownPoint) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t)
}

// Streets, the station forecourt, the beach park and the quay stay level.
const townCore = { x: 300, z: 100, halfX: 3100, halfZ: 2550 }
const lake = { x: -4100, z: 700, radius: 560 }

function outsideTown(x: number, z: number) {
  return sdBox(x - townCore.x, z - townCore.z, townCore.halfX, townCore.halfZ)
}

// Approximate signed distance to the coast: negative on land, positive at sea.
export function islandDistance(x: number, z: number) {
  const roughness = smoothstep(0, 1600, outsideTown(x, z))
  let distance =
    sdRoundBox(x, z + 350, 5700, 4000, 2600) + (fbm(x / 1700, z / 1700) - 0.5) * 760 * roughness
  distance = Math.min(distance, outsideTown(x, z))
  const harborShore = Math.max(smoothstep(3500, 4300, x), smoothstep(2700, 3400, z))
  const harbor =
    sdBox(x - 3100, z - (quayEdge + 3000), 3200, 3000) +
    (fbm(x / 600, z / 600) - 0.5) * 360 * harborShore
  distance = Math.max(distance, -harbor)
  distance = Math.min(
    distance,
    sdSegment(
      x,
      z,
      { x: breakwater.x, z: breakwater.start },
      { x: breakwater.x, z: breakwater.end }
    ) - 60,
    Math.hypot(x - lighthouse.x, z - lighthouse.z) - 170
  )
  const pond =
    Math.hypot((x - lake.x) * 0.9, z - lake.z) - lake.radius - (fbm(x / 500, z / 500) - 0.5) * 160
  return Math.max(distance, -pond)
}

// A vertical quay wall replaces the sloping beach along the harbor.
function quayWeight(x: number, z: number) {
  return (
    smoothstep(-150, 0, x) *
    (1 - smoothstep(quayEnd + 40, quayEnd + 260, x)) *
    smoothstep(quayEdge - 400, quayEdge - 200, z) *
    (1 - smoothstep(quayEdge + 120, quayEdge + 300, z))
  )
}

const peaks = [
  { x: -3000, z: -3300, height: 1150, radius: 1600 },
  { x: -800, z: -3700, height: 950, radius: 1400 },
  { x: 1600, z: -3600, height: 820, radius: 1300 },
  { x: 3900, z: -3300, height: 720, radius: 1200 },
  { x: -4700, z: -1200, height: 640, radius: 1100 },
  { x: 5300, z: -2700, height: 420, radius: 800 },
  { x: -4900, z: 1900, height: 240, radius: 900 }
]
export const summit = { x: -800, z: -3700 }

function railCorridor(x: number, z: number) {
  return (
    (1 - smoothstep(180, 1500, Math.abs(z - railway))) *
    (1 - smoothstep(4350, 4550, Math.abs(x - (railEnds[0] + railEnds[1]) / 2)))
  )
}

export function hillHeight(x: number, z: number) {
  let height = 0
  for (const peak of peaks) {
    const dx = (x - peak.x) / peak.radius
    const dz = (z - peak.z) / peak.radius
    height += peak.height * Math.exp(-(dx * dx + dz * dz))
  }
  return height * (0.75 + 0.5 * fbm(x / 900, z / 900, 3))
}

function shorelineInland(x: number, z: number) {
  const shore = 320 - 290 * quayWeight(x, z)
  return { shore, inland: -60 + 0.64 * (shore + 60) }
}

export function terrainHeight(x: number, z: number) {
  const inland = -islandDistance(x, z)
  const { shore } = shorelineInland(x, z)
  const beach = -48 + 48 * smoothstep(-60, shore, inland)
  const relief =
    hillHeight(x, z) *
    smoothstep(0, 1500, outsideTown(x, z)) *
    smoothstep(150, 1300, inland) *
    (1 - railCorridor(x, z))
  return beach + relief
}

export const terrainGrid = { x: -6560, z: -5120, step: 80, columns: 165, rows: 120 }
const terrainHeights = new Float32Array((terrainGrid.columns + 1) * (terrainGrid.rows + 1)).fill(
  NaN
)

export function terrainVertexHeight(column: number, row: number) {
  const index = row * (terrainGrid.columns + 1) + column
  if (Number.isNaN(terrainHeights[index]))
    terrainHeights[index] = terrainHeight(
      terrainGrid.x + column * terrainGrid.step,
      terrainGrid.z + row * terrainGrid.step
    )
  return terrainHeights[index]
}

// Interpolate the same alternating triangles used by the rendered terrain.
export function terrainSurfaceHeight(x: number, z: number) {
  const gx = (x - terrainGrid.x) / terrainGrid.step
  const gz = (z - terrainGrid.z) / terrainGrid.step
  const column = Math.floor(gx)
  const row = Math.floor(gz)
  if (column < 0 || row < 0 || column >= terrainGrid.columns || row >= terrainGrid.rows) return -48
  const u = gx - column
  const v = gz - row
  const a = terrainVertexHeight(column, row)
  const b = terrainVertexHeight(column + 1, row)
  const c = terrainVertexHeight(column, row + 1)
  const d = terrainVertexHeight(column + 1, row + 1)
  if ((column + row) % 2)
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)
  return u <= v ? a + (d - c) * u + (c - a) * v : a + (b - a) * u + (d - b) * v
}

// Distance from the visible waterline, used by the sea shader and the beach planting.
export function waterDistance(x: number, z: number) {
  return islandDistance(x, z) + shorelineInland(x, z).inland
}

export function inSand(x: number, z: number) {
  const distance = waterDistance(x, z)
  // The lake keeps a narrow shingle rim; the sea gets broad beaches.
  const lakeShore = Math.hypot((x - lake.x) * 0.9, z - lake.z) - lake.radius
  const beachWidth = lakeShore < 500 ? 90 : 520
  if (distance <= -beachWidth || quayWeight(x, z) >= 0.5) return false
  return terrainHeight(x, z) < 40
}

export function containsTownGround(point: TownPoint) {
  return waterDistance(point.x, point.z) < 0 && terrainSurfaceHeight(point.x, point.z) > waterLevel
}

function rect(left: number, right: number, top: number, bottom: number): Rect {
  return { left, right, top, bottom }
}

function road(ax: number, az: number, bx: number, bz: number): TownSegment {
  return { start: { x: ax, z: az }, end: { x: bx, z: bz } }
}

// Every road is split at its junctions, so each one is a single straight block face.
export const townRoads: TownSegment[] = [
  ...streets.flatMap((z) => avenues.slice(1).map((x, index) => road(avenues[index], z, x, z))),
  ...avenues.flatMap((x) => streets.slice(1).map((z, index) => road(x, streets[index], x, z))),
  road(0, streets[3], 0, quayStreet),
  road(1200, streets[3], 1200, quayStreet),
  road(2400, streets[3], 2400, quayStreet),
  road(0, quayStreet, 1200, quayStreet),
  road(1200, quayStreet, 2400, quayStreet),
  road(2400, quayStreet, quayEnd, quayStreet)
]

export type BlockKind =
  | 'residential'
  | 'library'
  | 'school'
  | 'hospital'
  | 'park'
  | 'downtown'
  | 'plaza'
  | 'avenue'
  | 'church'
  | 'market'
  | 'civic'
  | 'harbor'
export type TownBlock = Rect & { kind: BlockKind; seed: number }

const blockKinds: BlockKind[][] = [
  ['residential', 'library', 'school', 'hospital'],
  ['park', 'downtown', 'plaza', 'avenue'],
  ['church', 'market', 'civic', 'residential']
]

// Each block includes its sidewalk ring; lots start inside it.
export const townBlocks: TownBlock[] = [
  ...blockKinds.flatMap((row, rowIndex) =>
    row.map((kind, column) => ({
      ...rect(
        avenues[column] + carriageway,
        avenues[column + 1] - carriageway,
        streets[rowIndex] + carriageway,
        streets[rowIndex + 1] - carriageway
      ),
      kind,
      seed: rowIndex * 7 + column * 13 + 1
    }))
  ),
  ...[
    [0, 1200],
    [1200, 2400],
    [2400, quayEnd - 64]
  ].map(([left, right], index) => ({
    ...rect(
      left + carriageway,
      right - carriageway,
      streets[3] + carriageway,
      quayStreet - carriageway
    ),
    kind: 'harbor' as const,
    seed: 41 + index
  }))
]

// Pavement outside the blocks: the town's outer edge, the quay and the beach park entrance.
export const townPavements: Rect[] = [
  rect(
    avenues[0] - carriageway - sidewalk,
    avenues[4] + carriageway + sidewalk,
    streets[0] - carriageway - sidewalk,
    streets[0] - carriageway
  ),
  rect(
    avenues[0] - carriageway - sidewalk,
    -carriageway,
    streets[3] + carriageway,
    streets[3] + carriageway + sidewalk
  ),
  rect(
    avenues[0] - carriageway - sidewalk,
    avenues[0] - carriageway,
    streets[0] - carriageway,
    streets[3] + carriageway + sidewalk
  ),
  rect(
    avenues[4] + carriageway,
    avenues[4] + carriageway + sidewalk,
    streets[0] - carriageway - sidewalk,
    streets[3] - carriageway
  ),
  rect(-carriageway - sidewalk, -carriageway, streets[3] + carriageway, quayStreet + carriageway),
  rect(-carriageway - sidewalk, quayEnd + carriageway + 60, quayStreet + carriageway, quayEdge),
  rect(
    quayEnd - 128,
    quayEnd + carriageway + 60,
    quayStreet - carriageway - sidewalk,
    quayStreet - carriageway
  ),
  rect(
    quayEnd + carriageway,
    quayEnd + carriageway + 60,
    quayStreet - carriageway,
    quayStreet + carriageway
  )
]

export const station = { x: 600, front: -1880, depth: 200, width: 760 }
export const platform = rect(160, 1100, railway + 70, station.front - station.depth)

// Sandy promenades and garden paths that residents stroll along outside the streets.
export const boardwalk = { z: 2900, left: -3300, right: -450 }
export const park = townBlocks[4]
export const parkPond = {
  x: park.left + 380,
  z: (park.top + park.bottom) / 2 + 40,
  radiusX: 230,
  radiusZ: 170
}

function splitWalk(start: number, end: number, z: number, parts: number, lane: number) {
  return Array.from({ length: parts }, (_, index) => ({
    start: { x: start + ((end - start) * index) / parts, z },
    end: { x: start + ((end - start) * (index + 1)) / parts, z },
    lane,
    cycleLane: lane
  }))
}

// Sidewalk circuits cross the road at the zebra crossings near each junction.
const crossingInset = 140
export const walkSegments: WalkSegment[] = [
  ...townRoads.map(({ start, end }) => {
    const length = Math.hypot(end.x - start.x, end.z - start.z)
    const ux = (end.x - start.x) / length
    const uz = (end.z - start.z) / length
    return {
      start: { x: start.x + ux * crossingInset, z: start.z + uz * crossingInset },
      end: { x: end.x - ux * crossingInset, z: end.z - uz * crossingInset },
      lane: walkerLane,
      cycleLane: cyclistLane
    }
  }),
  ...splitWalk(boardwalk.left + 80, boardwalk.right - 80, boardwalk.z, 3, 30),
  {
    start: { x: park.left + 140, z: park.bottom - 170 },
    end: { x: park.right - 140, z: park.bottom - 170 },
    lane: 26,
    cycleLane: 26
  }
]

export const crossings = townRoads.flatMap(({ start, end }) => {
  const length = Math.hypot(end.x - start.x, end.z - start.z)
  const ux = (end.x - start.x) / length
  const uz = (end.z - start.z) / length
  return [
    { x: start.x + ux * (crossingInset + 30), z: start.z + uz * (crossingInset + 30), ux, uz },
    { x: end.x - ux * (crossingInset + 30), z: end.z - uz * (crossingInset + 30), ux, uz }
  ]
})

// Coarse coastline samples for camera limits, marched outwards from the island center.
export function coastOutline(samples = 72) {
  return Array.from({ length: samples }, (_, index) => {
    const angle = (index / samples) * Math.PI * 2
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)
    let radius = 1000
    while (radius < 9000 && waterDistance(dx * radius, -350 + dz * radius) < 0) radius += 60
    return { x: dx * radius, z: -350 + dz * radius }
  })
}

export const townPeaks = peaks.map((peak) => ({
  x: peak.x,
  z: peak.z,
  height: terrainHeight(peak.x, peak.z)
}))

// Coast distance texture: 0 on land, rising to 1 at 1200 units out to sea.
export const coastTextureBounds = { x: -8500, z: -8500, size: 17000 }
export function coastDistanceField(size = 384) {
  const data = new Uint8Array(size * size)
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const x = coastTextureBounds.x + ((column + 0.5) / size) * coastTextureBounds.size
      const z = coastTextureBounds.z + ((row + 0.5) / size) * coastTextureBounds.size
      const distance = waterDistance(x, z)
      data[row * size + column] = Math.round(Math.max(0, Math.min(1, distance / 1200)) * 255)
    }
  }
  return data
}
