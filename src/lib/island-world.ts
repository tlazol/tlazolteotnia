// The island is a grid of ground tiles with at most one decoration per tile.
// Everything here is plain data so edits, saving and rendering stay separate.

export const ISLAND_COLUMNS = 80
export const ISLAND_ROWS = 60
export const TILE_SIZE = 16
// A ring of open sea around the map keeps every shoreline drawable.
export const EDIT_MARGIN = 2
export const ISLAND_SAVE_VERSION = 3
export const ISLAND_STORAGE_KEY = 'tlazolteotnia:island'

export const WATER = 0
export const SAND = 1
export const GRASS = 2
export const PATH = 3
// Wooden boards on stilts: laid over the sea they make piers and platforms.
export const DECK = 4
export const SOIL = 5
export const COBBLE = 6
// A lake, shallow enough to build and plant in, but as slow going as the sea.
export const SWAMP = 7
// Greens that grow into the meadow and into each other.
export const MOSS = 8
export const DRYGRASS = 9
export const CLOVER = 10
export const WHITESAND = 11
export const BLACKSAND = 12
export const CLAY = 13
// Soft going: residents take it only when there is no way round.
export const MUD = 14
export const GRAVEL = 15
export const ROCK = 16
export const LAVA = 17
export const BRICK = 18
// Flat stones set into the grass, one to a tile.
export const STEPPING = 19
// Water to wade and swim in, like the lake.
export const SHALLOWS = 20
export const HOTSPRING = 21
// New grounds go at the end: saves store a ground as this number.
export const GROUND_COUNT = 22
export type Ground =
  | typeof WATER
  | typeof SAND
  | typeof GRASS
  | typeof PATH
  | typeof DECK
  | typeof SOIL
  | typeof COBBLE
  | typeof SWAMP
  | typeof MOSS
  | typeof DRYGRASS
  | typeof CLOVER
  | typeof WHITESAND
  | typeof BLACKSAND
  | typeof CLAY
  | typeof MUD
  | typeof GRAVEL
  | typeof ROCK
  | typeof LAVA
  | typeof BRICK
  | typeof STEPPING
  | typeof SHALLOWS
  | typeof HOTSPRING
export type LandGround = Exclude<Ground, typeof WATER>
export const groundGroups: Array<{ name: string; grounds: LandGround[] }> = [
  { name: '草', grounds: [GRASS, MOSS, DRYGRASS, CLOVER] },
  { name: '砂と土', grounds: [SAND, WHITESAND, BLACKSAND, SOIL, CLAY, MUD, GRAVEL] },
  { name: '岩', grounds: [ROCK, LAVA] },
  { name: '道', grounds: [PATH, COBBLE, BRICK, STEPPING, DECK] },
  { name: '水', grounds: [SWAMP, SHALLOWS, HOTSPRING] }
]
export const landGrounds: LandGround[] = groundGroups.flatMap((group) => group.grounds)
export const groundNames: Record<Ground, string> = {
  [WATER]: '海',
  [SAND]: '砂浜',
  [GRASS]: '草地',
  [PATH]: '小道',
  [DECK]: '桟橋',
  [SOIL]: '土',
  [COBBLE]: '石畳',
  [SWAMP]: '湖',
  [MOSS]: '苔地',
  [DRYGRASS]: '乾いた草地',
  [CLOVER]: 'クローバー',
  [WHITESAND]: '白砂',
  [BLACKSAND]: '黒砂',
  [CLAY]: '赤土',
  [MUD]: '泥',
  [GRAVEL]: '砂利',
  [ROCK]: '岩場',
  [LAVA]: '溶岩石',
  [BRICK]: 'レンガ道',
  [STEPPING]: '飛び石',
  [SHALLOWS]: '浅瀬',
  [HOTSPRING]: '温泉'
}
// Fresh water lying on the land: residents swim in it as they do in the sea.
export function isWetGround(ground: Ground) {
  return ground === WATER || ground === SWAMP || ground === SHALLOWS || ground === HOTSPRING
}

// Decorations stand on land or float on the sea; flat ones can be walked over.
// New kinds go at the end: saves store a kind as its position in this list.
export const decorInfo = {
  tree: { name: '木', on: 'land', blocks: true },
  palm: { name: 'ヤシ', on: 'land', blocks: true },
  bush: { name: '茂み', on: 'land', blocks: true },
  rock: { name: '岩', on: 'land', blocks: true },
  flowers: { name: '花', on: 'land', blocks: false },
  driftwood: { name: '流木', on: 'land', blocks: true },
  torch: { name: 'たいまつ', on: 'land', blocks: true },
  searock: { name: '岩礁', on: 'water', blocks: true },
  bamboo: { name: '竹', on: 'land', blocks: true },
  banana: { name: 'バナナの木', on: 'land', blocks: true },
  deadtree: { name: '枯れ木', on: 'land', blocks: true },
  mangrove: { name: 'マングローブ', on: 'land', blocks: true },
  monstera: { name: 'モンステラ', on: 'land', blocks: true },
  cactus: { name: 'サボテン', on: 'land', blocks: true },
  crystal: { name: '水晶', on: 'land', blocks: true },
  mushroom: { name: 'キノコ', on: 'land', blocks: false },
  shell: { name: '貝殻', on: 'land', blocks: false },
  campfire: { name: '焚き火', on: 'land', blocks: true },
  lantern: { name: '石灯籠', on: 'land', blocks: true },
  fireflies: { name: 'ホタル', on: 'land', blocks: false },
  coral: { name: 'サンゴ', on: 'water', blocks: true },
  seaweed: { name: '海藻', on: 'water', blocks: true },
  flotsam: { name: '浮き流木', on: 'water', blocks: true },
  buoy: { name: 'ブイ', on: 'water', blocks: true }
} as const satisfies Record<string, { name: string; on: 'land' | 'water'; blocks: boolean }>
export type DecorKind = keyof typeof decorInfo
export const decorKinds = Object.keys(decorInfo) as DecorKind[]
export const decorNames = Object.fromEntries(
  decorKinds.map((kind) => [kind, decorInfo[kind].name])
) as Record<DecorKind, string>
export const decorGroups: Array<{ name: string; kinds: DecorKind[] }> = [
  {
    name: '自然',
    kinds: [
      'palm',
      'tree',
      'banana',
      'bamboo',
      'mangrove',
      'deadtree',
      'bush',
      'monstera',
      'cactus',
      'rock',
      'crystal',
      'flowers',
      'mushroom',
      'driftwood',
      'shell'
    ]
  },
  { name: 'あかり', kinds: ['torch', 'campfire', 'lantern', 'fireflies'] },
  { name: '海', kinds: ['searock', 'coral', 'seaweed', 'flotsam', 'buoy'] }
]
// Stored decoration codes: 0 is empty, otherwise the index in decorKinds plus one.
export function decorCode(kind: DecorKind) {
  return decorKinds.indexOf(kind) + 1
}
export function decorKindOf(code: number): DecorKind | null {
  return decorKinds[code - 1] ?? null
}
export function decorBlocksWalking(code: number) {
  const kind = decorKindOf(code)
  return kind !== null && decorInfo[kind].blocks
}
// Whether a decoration may sit on this kind of ground.
export function decorFits(kind: DecorKind, ground: Ground) {
  return (decorInfo[kind].on === 'water') === (ground === WATER)
}

export type IslandWorld = {
  columns: number
  rows: number
  ground: Uint8Array
  decor: Uint8Array
}

export function createIsland(columns = ISLAND_COLUMNS, rows = ISLAND_ROWS): IslandWorld {
  return {
    columns,
    rows,
    ground: new Uint8Array(columns * rows),
    decor: new Uint8Array(columns * rows)
  }
}

export function inBounds(world: IslandWorld, x: number, y: number) {
  return x >= 0 && y >= 0 && x < world.columns && y < world.rows
}
export function isEditableTile(world: IslandWorld, x: number, y: number) {
  return (
    x >= EDIT_MARGIN &&
    y >= EDIT_MARGIN &&
    x < world.columns - EDIT_MARGIN &&
    y < world.rows - EDIT_MARGIN
  )
}
export function groundAt(world: IslandWorld, x: number, y: number): Ground {
  return inBounds(world, x, y) ? (world.ground[y * world.columns + x] as Ground) : WATER
}
export function decorAt(world: IslandWorld, x: number, y: number) {
  return inBounds(world, x, y) ? world.decor[y * world.columns + x] : 0
}
export function isLand(world: IslandWorld, x: number, y: number) {
  return groundAt(world, x, y) !== WATER
}
export function isWalkable(world: IslandWorld, x: number, y: number) {
  return isLand(world, x, y) && !decorBlocksWalking(decorAt(world, x, y))
}

// Deterministic hash in [0, 1) for procedural layout and pixel texture.
export function hash2(x: number, y: number, seed = 0) {
  let h =
    Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

export function valueNoise(x: number, y: number, seed = 0) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

export const ISLAND_CENTER = { x: 40, y: 30 }

// The starting island: jungle to the west and north, and in the south-east a
// lagoon ringed by sandbars, with a pier running out over the water.
export function createDefaultIsland(): IslandWorld {
  const world = createIsland()
  const { columns, rows } = world
  const set = (x: number, y: number, ground: Ground) => {
    if (isEditableTile(world, x, y)) world.ground[y * columns + x] = ground
  }
  // grassy 0 leaves the blob all sand; 1 covers it in grass up to a beach rim.
  const blob = (cx: number, cy: number, rx: number, ry: number, seed: number, grassy = 1) => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const dx = (x + 0.5 - cx) / rx
        const dy = (y + 0.5 - cy) / ry
        const angle = Math.atan2(dy, dx)
        const edge =
          1 +
          0.13 * Math.sin(2 * angle + 0.7 + seed) +
          0.09 * Math.sin(3 * angle + 2.2 + seed * 2) +
          0.05 * Math.sin(5 * angle + 0.4 + seed * 3) +
          (valueNoise(x / 3, y / 3, 11 + seed) - 0.5) * 0.12
        const r = Math.hypot(dx, dy)
        if (r >= edge) continue
        const rim = 0.24 + valueNoise(x / 2, y / 2, 5) * 0.12 + (1 - grassy) * 9
        if (r < edge - rim) set(x, y, GRASS)
        else if (!isLand(world, x, y)) set(x, y, SAND)
      }
    }
  }
  const carve = (cx: number, cy: number, rx: number, ry: number, beach = 1.35) => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
        const wobble = 1 + (valueNoise(x / 2.5, y / 2.5, 71) - 0.5) * 0.3
        if (d < wobble) world.ground[y * columns + x] = WATER
        else if (d < wobble * beach && isLand(world, x, y)) world.ground[y * columns + x] = SAND
      }
    }
  }
  blob(37, 28, 16, 10.5, 0)
  // The castaway's cape to the west and a jungle headland to the north-east.
  blob(23.5, 33, 6, 3.8, 1, 0.55)
  blob(51, 21.5, 6.5, 4.6, 2)
  // Sandbars curl round the lagoon, leaving a gap to the open sea.
  blob(58, 31, 3.6, 4.6, 6, 0.5)
  blob(60.5, 38.5, 2.3, 5, 7, 0)
  blob(47, 45.5, 8.5, 2.1, 8, 0)
  blob(38.5, 41.5, 3.6, 3.4, 9, 0)
  carve(50.5, 38.5, 7.6, 4.6)
  // Islets: a lone palm, a rocky outcrop and a picnic spot.
  blob(17, 46.5, 2.3, 1.7, 4, 0)
  blob(65, 13.5, 2.8, 2.1, 3, 0.7)
  blob(69, 47, 2, 1.6, 5, 0)

  // Plaza and trails from it to the beaches.
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) set(40 + x, 30 + y, PATH)
  const path = (from: [number, number], to: [number, number], wobble: number) => {
    const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) * 2
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = from[0] + (to[0] - from[0]) * t
      const y = from[1] + (to[1] - from[1]) * t
      const bend = Math.sin(t * Math.PI * 2) * wobble
      const horizontal = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1])
      const px = Math.round(horizontal ? x : x + bend)
      const py = Math.round(horizontal ? y + bend : y)
      if (groundAt(world, px, py) === GRASS) set(px, py, PATH)
    }
  }
  path([39, 30], [27, 32], 1.2)
  path([41, 31], [47, 34], 0.6)
  path([41, 29], [50, 22], 0.8)
  path([40, 29], [37, 20], 0.6)

  // The pier: out from the lagoon's beach, with a platform on either side.
  const deck = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, DECK)
  }
  deck(50, 34, 50, 41)
  deck(45, 37, 47, 39)
  deck(48, 39, 49, 39)
  deck(53, 37, 55, 39)
  deck(51, 39, 52, 39)
  deck(49, 41, 51, 42)

  const put = (x: number, y: number, kind: DecorKind) => {
    if (isEditableTile(world, x, y) && decorFits(kind, groundAt(world, x, y)))
      world.decor[y * columns + x] = decorCode(kind)
  }
  // Set pieces first, so the greenery grows around them.
  const pieces: Array<[number, number, DecorKind]> = [
    // Washed up on the western cape.
    [19, 33, 'driftwood'],
    [25, 35, 'driftwood'],
    // Plaza.
    [38, 28, 'torch'],
    [42, 28, 'torch'],
    [38, 32, 'torch'],
    [42, 32, 'torch'],
    // The head of the pier.
    [49, 33, 'torch'],
    [51, 33, 'torch'],
    [17, 46, 'palm']
  ]
  // Nothing grows over a set piece: plants keep off it and the rows in front.
  const reserved = new Uint8Array(columns * rows)
  for (const [x, y, kind] of pieces) {
    put(x, y, kind)
    for (let dy = -1; dy <= 3; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (inBounds(world, x + dx, y + dy)) reserved[(y + dy) * columns + x + dx] = 1
  }

  // Decorations follow the ground: jungle inland, palms along the beaches,
  // rocks on the wild north coast and in the sea off it.
  const tall = [decorCode('tree'), decorCode('palm')]
  const crowded = (x: number, y: number, reach: number) => {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const code = decorAt(world, x + dx, y + dy)
        if ((dy < 0 || (dy === 0 && dx < 0)) && tall.includes(code)) return true
        if (code && !tall.includes(code) && Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return true
      }
    }
    return false
  }
  const near = (x: number, y: number, reach: number, test: (ground: Ground) => boolean) => {
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++)
        if (test(groundAt(world, x + dx, y + dy))) return true
    return false
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!isEditableTile(world, x, y) || decorAt(world, x, y)) continue
      const ground = groundAt(world, x, y)
      if (ground === PATH || ground === DECK) continue
      const roll = hash2(x, y, 101)
      let kind: DecorKind | null = null
      if (ground === WATER) {
        // Reef rocks keep to the north and west, away from the lagoon.
        const wild = y < 22 || x < 20
        if (
          wild &&
          roll < 0.07 &&
          near(x, y, 2, (g) => g !== WATER) &&
          !near(x, y, 1, (g) => g !== WATER)
        )
          kind = 'searock'
      } else {
        if (Math.abs(x - 40) <= 2 && Math.abs(y - 30) <= 2) continue
        const nearPath = near(x, y, 1, (g) => g === PATH || g === DECK)
        const jungle = valueNoise(x / 5, y / 4, 23) + (x < 35 || y < 25 ? 0.2 : 0)
        if (ground === GRASS) {
          if (jungle > 0.56 && !nearPath) kind = roll < 0.42 ? 'tree' : roll < 0.56 ? 'bush' : null
          else if (roll < 0.03 && !nearPath) kind = 'tree'
          else if (roll < 0.07) kind = 'bush'
          else if (roll < 0.17) kind = valueNoise(x / 3, y / 3, 41) > 0.45 ? 'flowers' : null
          else if (roll < 0.178) kind = 'rock'
        } else {
          const north = y < 24
          if (roll < 0.1 && !nearPath) kind = 'palm'
          else if (roll >= 0.1 && roll < (north ? 0.16 : 0.108)) kind = 'rock'
        }
        if (kind === 'tree' && crowded(x, y, jungle > 0.56 ? 1 : 2))
          kind = roll < 0.12 ? 'bush' : null
        if (kind === 'palm' && crowded(x, y, 3)) kind = null
        if (kind && kind !== 'tree' && kind !== 'palm' && crowded(x, y, 1)) kind = null
      }
      if (kind && !(reserved[y * columns + x] && kind !== 'flowers')) put(x, y, kind)
    }
  }
  return world
}

// ---- Saving ---------------------------------------------------------------

function encodeRuns(values: Uint8Array) {
  const runs: string[] = []
  let start = 0
  for (let i = 1; i <= values.length; i++) {
    if (i === values.length || values[i] !== values[start]) {
      runs.push(`${values[start].toString(36)}${i - start === 1 ? '' : `*${i - start}`}`)
      start = i
    }
  }
  return runs.join('.')
}

function decodeRuns(text: unknown, length: number, max: number) {
  if (typeof text !== 'string' || text.length > length * 8) return null
  const values = new Uint8Array(length)
  let offset = 0
  for (const run of text.split('.')) {
    const match = /^([0-9a-z])(?:\*(\d{1,5}))?$/.exec(run)
    if (!match) return null
    const value = Number.parseInt(match[1], 36)
    const count = match[2] ? Number(match[2]) : 1
    if (value > max || count < 1 || offset + count > length) return null
    values.fill(value, offset, offset + count)
    offset += count
  }
  return offset === length ? values : null
}

export type IslandSave = {
  version: typeof ISLAND_SAVE_VERSION
  columns: number
  rows: number
  ground: string
  decor: string
}

export function serializeIsland(world: IslandWorld): string {
  const save: IslandSave = {
    version: ISLAND_SAVE_VERSION,
    columns: world.columns,
    rows: world.rows,
    ground: encodeRuns(world.ground),
    decor: encodeRuns(world.decor)
  }
  return JSON.stringify(save)
}

// Version 2 saves had man-made decorations between the natural ones. Indexed by
// the old code: the kinds that remain map to their new code, the rest to none.
const VERSION_2_DECOR = [0, 1, 2, 3, 4, 5, 0, 0, 0, 6, 0, 0, 0, 7, 0, 0, 0, 8, 0, 0]

// Anything unexpected — other versions, other sizes, broken runs — is rejected
// so the caller falls back to the default island instead of a half-built one.
export function parseIsland(raw: string | null | undefined): IslandWorld | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const save = data as Partial<IslandSave>
  const outdated = (save.version as number) === 2
  if (
    (save.version !== ISLAND_SAVE_VERSION && !outdated) ||
    save.columns !== ISLAND_COLUMNS ||
    save.rows !== ISLAND_ROWS
  )
    return null
  const length = ISLAND_COLUMNS * ISLAND_ROWS
  const ground = decodeRuns(save.ground, length, GROUND_COUNT - 1)
  const decor = decodeRuns(
    save.decor,
    length,
    outdated ? VERSION_2_DECOR.length - 1 : decorKinds.length
  )
  if (!ground || !decor) return null
  if (outdated) for (let i = 0; i < length; i++) decor[i] = VERSION_2_DECOR[decor[i]]
  const world: IslandWorld = { columns: ISLAND_COLUMNS, rows: ISLAND_ROWS, ground, decor }
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.columns; x++) {
      const index = y * world.columns + x
      if (!isEditableTile(world, x, y)) world.ground[index] = WATER
      const kind = decorKindOf(world.decor[index])
      if (kind && !decorFits(kind, world.ground[index] as Ground)) world.decor[index] = 0
    }
  }
  return world
}

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

export function loadIsland(storage: ReadStorage | null): { world: IslandWorld; restored: boolean } {
  let raw: string | null = null
  try {
    raw = storage?.getItem(ISLAND_STORAGE_KEY) ?? null
  } catch {
    raw = null
  }
  const world = parseIsland(raw)
  return world ? { world, restored: true } : { world: createDefaultIsland(), restored: false }
}

export function saveIsland(world: IslandWorld, storage: WriteStorage | null) {
  try {
    storage?.setItem(ISLAND_STORAGE_KEY, serializeIsland(world))
    return true
  } catch {
    return false
  }
}

// ---- Residents' homes -----------------------------------------------------

// Homes are laid out once on the default island so they stay put however the
// visitor reshapes it; settleResidents relocates residents from blocked tiles.
export function layoutResidentHomes(count: number): Array<{ x: number; y: number }> {
  const world = createDefaultIsland()
  const homes: Array<{ x: number; y: number }> = []
  if (!count) return homes
  homes.push({ ...ISLAND_CENTER })
  const candidates: Array<{ x: number; y: number; order: number }> = []
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.columns; x++) {
      if (!isWalkable(world, x, y)) continue
      if (Math.abs(x - ISLAND_CENTER.x) <= 1 && Math.abs(y - ISLAND_CENTER.y) <= 1) continue
      candidates.push({ x, y, order: hash2(x, y, 7) })
    }
  }
  candidates.sort((a, b) => a.order - b.order)
  for (const spacing of [2, 1, 0]) {
    for (const tile of candidates) {
      if (homes.length >= count) return homes
      if (homes.some((home) => home.x === tile.x && home.y === tile.y)) continue
      if (
        homes.some(
          (home) => Math.max(Math.abs(home.x - tile.x), Math.abs(home.y - tile.y)) < spacing
        )
      )
        continue
      homes.push({ x: tile.x, y: tile.y })
    }
  }
  while (homes.length < count) homes.push({ ...ISLAND_CENTER })
  return homes
}

// Nearest walkable tile by expanding rings, preferring tiles nobody uses yet.
export function nearestWalkable(
  world: IslandWorld,
  x: number,
  y: number,
  isTaken: (x: number, y: number) => boolean = () => false
): { x: number; y: number } | null {
  let fallback: { x: number; y: number } | null = null
  const limit = Math.max(world.columns, world.rows)
  for (let r = 0; r <= limit; r++) {
    let best: { x: number; y: number; d: number } | null = null
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const tx = x + dx
        const ty = y + dy
        if (!isWalkable(world, tx, ty)) continue
        const d = dx * dx + dy * dy
        if (isTaken(tx, ty)) {
          if (!fallback) fallback = { x: tx, y: ty }
          continue
        }
        if (!best || d < best.d) best = { x: tx, y: ty, d }
      }
    }
    if (best) return { x: best.x, y: best.y }
  }
  return fallback
}
