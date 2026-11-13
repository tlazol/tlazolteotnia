// The island is a grid of ground tiles with at most one decoration per tile.
// Everything here is plain data so edits, saving and rendering stay separate.

export const ISLAND_COLUMNS = 80
export const ISLAND_ROWS = 60
export const TILE_SIZE = 16
// A ring of open sea around the map keeps every shoreline drawable.
export const EDIT_MARGIN = 2
export const ISLAND_SAVE_VERSION = 3

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
// Saves store a kind by its slot in storedDecorKinds, not by its place here.
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
  relic: { name: '遺物', on: 'land', blocks: true },
  mushroom: { name: 'キノコ', on: 'land', blocks: false },
  shell: { name: '貝殻', on: 'land', blocks: false },
  campfire: { name: '焚き火', on: 'land', blocks: true },
  fireflies: { name: 'ホタル', on: 'land', blocks: false },
  coral: { name: 'サンゴ', on: 'water', blocks: true },
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
      'relic',
      'flowers',
      'mushroom',
      'driftwood',
      'shell'
    ]
  },
  { name: 'あかり', kinds: ['torch', 'campfire', 'fireflies'] },
  { name: '海', kinds: ['searock', 'coral', 'flotsam', 'buoy'] }
]
// Stored decoration codes: 0 is empty, otherwise the slot here plus one.
// Retired kinds leave a null hole (stone lantern 19, seaweed 22) so the codes
// after them keep their kinds; new kinds go at the end.
const storedDecorKinds: Array<DecorKind | null> = [
  'tree',
  'palm',
  'bush',
  'rock',
  'flowers',
  'driftwood',
  'torch',
  'searock',
  'bamboo',
  'banana',
  'deadtree',
  'mangrove',
  'monstera',
  'cactus',
  'relic',
  'mushroom',
  'shell',
  'campfire',
  null,
  'fireflies',
  'coral',
  null,
  'flotsam',
  'buoy'
]
export const MAX_DECOR_CODE = storedDecorKinds.length
// How many looks each kind has; the sprites draw exactly this many.
export const decorLooks = {
  tree: 5,
  palm: 5,
  bush: 6,
  rock: 5,
  flowers: 6,
  driftwood: 4,
  torch: 4,
  searock: 5,
  bamboo: 4,
  banana: 4,
  deadtree: 4,
  mangrove: 4,
  monstera: 4,
  cactus: 4,
  relic: 4,
  mushroom: 4,
  shell: 4,
  campfire: 5,
  fireflies: 4,
  coral: 4,
  flotsam: 4,
  buoy: 2
} as const satisfies Record<DecorKind, number>
// A stored code keeps the kind in its low five bits and, above them, the look
// the visitor picked plus one. Zero there (every older save) lets the tile's
// position pick the look.
const LOOK_SHIFT = 5
const KIND_MASK = (1 << LOOK_SHIFT) - 1
export const MAX_DECOR_LOOKS = (0xff >> LOOK_SHIFT) - 1
export function decorCode(kind: DecorKind, look?: number | null) {
  const base = storedDecorKinds.indexOf(kind) + 1
  return look == null ? base : base | ((look + 1) << LOOK_SHIFT)
}
export function decorKindOf(code: number): DecorKind | null {
  return storedDecorKinds[(code & KIND_MASK) - 1] ?? null
}
// The look picked when the decoration was placed, or null if none was.
export function decorLookOf(code: number): number | null {
  const look = code >> LOOK_SHIFT
  return look ? look - 1 : null
}
// The look a tile shows: the picked one, or one drawn from its position.
export function decorLookAt(code: number, x: number, y: number): number | null {
  const kind = decorKindOf(code)
  if (!kind) return null
  return decorLookOf(code) ?? Math.floor(hash2(x, y, 211) * decorLooks[kind])
}
export function isDecorCode(code: number) {
  if (!Number.isSafeInteger(code) || code < 0 || code > 0xff) return false
  const look = decorLookOf(code)
  if (look === null) return code <= MAX_DECOR_CODE
  const kind = decorKindOf(code)
  return kind !== null && look < decorLooks[kind]
}
export function decorBlocksWalking(code: number) {
  const kind = decorKindOf(code)
  return kind !== null && decorInfo[kind].blocks
}
// A code left by a retired kind, with or without a picked look: it shows
// nothing, and loading a save clears it.
export function isRetiredDecorCode(code: number) {
  const slot = code & KIND_MASK
  return slot > 0 && slot <= MAX_DECOR_CODE && storedDecorKinds[slot - 1] === null
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

// The starting island shows off every ground and decoration. A volcano with
// black beaches and a hot spring stands in the north-west, a mossy bamboo grove
// on the north-east headland, a jungle and a muddy lake in the west, dry clay
// country in the south, and in the south-east a white-sand lagoon with a pier.
export function createDefaultIsland(): IslandWorld {
  const world = createIsland()
  const { columns, rows } = world
  const set = (x: number, y: number, ground: Ground) => {
    if (isEditableTile(world, x, y)) world.ground[y * columns + x] = ground
  }
  // grassy 0 leaves the blob all sand; 1 covers it in grass up to a beach rim,
  // and a little over 1 narrows that beach.
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
  const LAGOON = { x: 55, y: 42, rx: 8.5, ry: 5 }
  const anyLand = (ground: Ground) => ground !== WATER
  const only =
    (...grounds: Ground[]) =>
    (ground: Ground) =>
      grounds.includes(ground)
  // Re-grounds the tiles inside a ragged ellipse, where `over` allows it.
  const patch = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    seed: number,
    ground: Ground,
    over: (ground: Ground) => boolean = anyLand
  ) => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
        const wobble = 1 + (valueNoise(x / 2.5, y / 2.5, 80 + seed) - 0.5) * 0.45
        if (d < wobble && over(groundAt(world, x, y))) set(x, y, ground)
      }
    }
  }
  const near = (x: number, y: number, reach: number, test: (ground: Ground) => boolean) => {
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++)
        if (test(groundAt(world, x + dx, y + dy))) return true
    return false
  }

  blob(38, 29, 20, 13, 0, 1.012)
  // The castaway's cape to the west and a headland to the north-east.
  blob(16, 34, 6, 3.8, 1, 0.55)
  blob(55, 17, 8, 5.5, 2, 1.01)
  // The volcano's shoulder to the north-west and the dry country to the south.
  blob(22, 17, 8, 6, 10, 0.8)
  blob(27, 43, 8, 4.5, 11, 1.01)
  // Sandbars curl round the lagoon, leaving a gap to the open sea.
  blob(63.5, 34, 4, 5, 6, 0.5)
  blob(66, 42, 2.5, 5.5, 7, 0)
  blob(51.5, 49.5, 9.5, 2.3, 8, 0)
  blob(42, 45.5, 4, 3.6, 9, 0)
  carve(LAGOON.x, LAGOON.y, LAGOON.rx, LAGOON.ry)
  // Islets: a lone palm, a rocky outcrop and a picnic spot.
  blob(11, 48.5, 2.3, 1.7, 4, 0)
  blob(70, 10.5, 2.8, 2.1, 3, 0.7)
  blob(72, 51, 2, 1.6, 5, 0)

  // The plaza: cobbles framed in brick, with trails from it to every quarter.
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++)
      set(40 + x, 30 + y, Math.max(Math.abs(x), Math.abs(y)) === 2 ? BRICK : COBBLE)
  const path = (from: [number, number], to: [number, number], wobble: number, ground: Ground) => {
    const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) * 2
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = from[0] + (to[0] - from[0]) * t
      const y = from[1] + (to[1] - from[1]) * t
      const bend = Math.sin(t * Math.PI * 2) * wobble
      const horizontal = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1])
      const px = Math.round(horizontal ? x : x + bend)
      const py = Math.round(horizontal ? y + bend : y)
      if (groundAt(world, px, py) === GRASS) set(px, py, ground)
    }
  }
  path([37, 30], [20, 33], 1.2, PATH)
  path([43, 31], [54, 36], 0.8, PATH)
  path([40, 27], [38, 22], 0.6, PATH)
  path([41, 33], [31, 40], 0.8, PATH)
  // The way to the grove turns to stepping stones as it nears the bamboo.
  path([43, 28], [48, 23], 0.5, PATH)
  path([49, 22], [57, 16], 0.6, STEPPING)

  // The volcano: bare rock round a lava cap, above beaches of black sand.
  patch(22, 16.5, 6.2, 4.2, 1, ROCK)
  patch(22, 16, 2.8, 1.7, 2, LAVA)
  patch(22, 17, 12, 9, 3, BLACKSAND, only(SAND))
  // A hot spring steams among the gravel where the north trail ends.
  patch(36, 20.5, 3.6, 2.4, 4, GRAVEL)
  patch(36, 20.3, 2, 1.2, 5, HOTSPRING)
  // Shingle along the wild north coast.
  patch(46.5, 20.3, 3, 1, 6, GRAVEL, only(SAND))
  // The lake lies in the jungle, its banks trodden to mud.
  patch(29, 26.5, 5.6, 3.6, 7, MUD, only(GRASS))
  patch(29, 26.5, 4.2, 2.4, 8, SWAMP, only(MUD))
  // Moss under the bamboo of the headland, clover by the plaza.
  patch(55, 17, 7.5, 4.8, 9, MOSS, only(GRASS))
  patch(46.5, 29, 4, 2.6, 10, CLOVER, only(GRASS))
  // The south dries out to yellow grass and then to red clay.
  patch(27, 41, 10, 5, 11, DRYGRASS, only(GRASS))
  patch(26, 44, 5, 2.6, 12, CLAY, only(GRASS, DRYGRASS))
  // A flower bed beside the west trail.
  for (let y = 33; y <= 34; y++)
    for (let x = 33; x <= 37; x++) if (groundAt(world, x, y) === GRASS) set(x, y, SOIL)
  // White sand round the lagoon and on the picnic islet; bare rock on the outcrop.
  patch(57, 43, 14, 10.5, 13, WHITESAND, only(SAND))
  patch(72, 51, 4, 3.5, 14, WHITESAND, only(SAND))
  patch(70, 10.5, 1.7, 1.2, 15, ROCK)
  // The lagoon shelves gently: its rim is shallow enough to wade.
  const shallow: number[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (groundAt(world, x, y) !== WATER || !isEditableTile(world, x, y)) continue
      if (Math.hypot((x + 0.5 - LAGOON.x) / LAGOON.rx, (y + 0.5 - LAGOON.y) / LAGOON.ry) > 1.2)
        continue
      if (near(x, y, 1, anyLand) && valueNoise(x / 2, y / 2, 61) > 0.3)
        shallow.push(y * columns + x)
    }
  }
  for (const index of shallow) world.ground[index] = SHALLOWS

  // The pier: out from the lagoon's beach, with a platform on either side.
  const deck = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, DECK)
  }
  deck(55, 36, 55, 45)
  deck(49, 41, 51, 43)
  deck(52, 43, 54, 43)
  deck(59, 41, 61, 43)
  deck(56, 43, 58, 43)
  deck(54, 45, 56, 46)

  const put = (x: number, y: number, kind: DecorKind) => {
    if (isEditableTile(world, x, y) && decorFits(kind, groundAt(world, x, y)))
      world.decor[y * columns + x] = decorCode(kind)
  }
  // Set pieces first, so the greenery grows around them.
  const pieces: Array<[number, number, DecorKind]> = [
    // The castaway's camp on the western cape, and wreckage adrift off it.
    [11, 33, 'driftwood'],
    [18, 35, 'driftwood'],
    [14, 33, 'campfire'],
    [6, 31, 'flotsam'],
    [5, 37, 'flotsam'],
    // Plaza.
    [38, 28, 'torch'],
    [42, 28, 'torch'],
    [38, 32, 'torch'],
    [42, 32, 'torch'],
    // The head of the pier, and buoys marking the way into the lagoon.
    [54, 35, 'torch'],
    [56, 35, 'torch'],
    [61, 47, 'buoy'],
    [64, 46, 'buoy'],
    // The islets.
    [11, 48, 'palm'],
    [70, 10, 'relic'],
    [72, 51, 'campfire']
  ]
  // Nothing grows over a set piece: plants keep off it and the rows in front.
  const reserved = new Uint8Array(columns * rows)
  for (const [x, y, kind] of pieces) {
    put(x, y, kind)
    for (let dy = -1; dy <= 3; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (inBounds(world, x + dx, y + dy)) reserved[(y + dy) * columns + x + dx] = 1
  }

  // Decorations follow the ground: each quarter of the island grows its own.
  const tallKinds: DecorKind[] = ['tree', 'palm', 'banana', 'bamboo', 'deadtree', 'mangrove']
  const tall = tallKinds.map(decorCode)
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
  const isTrail = only(PATH, DECK, COBBLE, BRICK, STEPPING)
  // The first kind whose share of the roll comes up, or nothing.
  const pick = (roll: number, ...shares: Array<[DecorKind, number]>): DecorKind | null => {
    let limit = 0
    for (const [kind, share] of shares) {
      limit += share
      if (roll < limit) return kind
    }
    return null
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!isEditableTile(world, x, y) || decorAt(world, x, y)) continue
      const ground = groundAt(world, x, y)
      if (isTrail(ground)) continue
      const roll = hash2(x, y, 101)
      let kind: DecorKind | null = null
      // Thickets stand closer together than lone trees do.
      let dense = false
      if (ground === WATER) {
        if (!near(x, y, 2, anyLand) || near(x, y, 1, anyLand)) continue
        // Reef rocks keep to the north and west; coral to the warm south-east.
        if (y < 22 || x < 20) kind = pick(roll, ['searock', 0.07])
        else if (x > 38 && y > 30) kind = pick(roll, ['coral', 0.1])
      } else if (ground === SOIL) {
        // The flower bed is planted in rows, shoulder to shoulder.
        if ((x + y) % 2 === 0) put(x, y, 'flowers')
        continue
      } else {
        if (Math.abs(x - 40) <= 3 && Math.abs(y - 30) <= 3) continue
        const nearPath = near(x, y, 1, isTrail)
        const jungle = valueNoise(x / 5, y / 4, 23) + (x < 35 || y < 25 ? 0.2 : 0)
        if (ground === GRASS) {
          dense = jungle > 0.56
          // Bananas and monsteras keep to the deep jungle of the west.
          const west = x < 36
          if (dense && !nearPath)
            kind = pick(
              roll,
              ['tree', 0.26],
              [west ? 'banana' : 'tree', 0.16],
              ['bush', 0.08],
              [west ? 'monstera' : 'bush', 0.12],
              ['mushroom', 0.04]
            )
          else if (roll < 0.03 && !nearPath) kind = 'tree'
          else if (roll < 0.07) kind = 'bush'
          else if (roll < 0.17) kind = valueNoise(x / 3, y / 3, 41) > 0.45 ? 'flowers' : null
          else if (roll < 0.178) kind = 'rock'
        } else if (ground === MOSS) {
          dense = true
          kind = nearPath
            ? pick(roll, ['mushroom', 0.1], ['fireflies', 0.08])
            : pick(
                roll,
                ['bamboo', 0.55],
                ['mushroom', 0.08],
                ['fireflies', 0.1],
                ['monstera', 0.05]
              )
        } else if (ground === CLOVER)
          kind = pick(roll, ['flowers', 0.3], ['fireflies', 0.06], ['bush', 0.04])
        else if (ground === DRYGRASS)
          kind = pick(roll, ['deadtree', 0.07], ['cactus', 0.07], ['rock', 0.04], ['bush', 0.04])
        else if (ground === CLAY)
          kind = pick(roll, ['cactus', 0.2], ['rock', 0.05], ['deadtree', 0.05])
        else if (ground === SAND) {
          const north = y < 24
          if (roll < 0.1 && !nearPath) kind = 'palm'
          else
            kind = pick(
              roll - 0.1,
              ['rock', north ? 0.06 : 0.008],
              ['shell', 0.04],
              ['driftwood', 0.012]
            )
        } else if (ground === WHITESAND) {
          if (roll < 0.08 && !nearPath) kind = 'palm'
          else kind = pick(roll - 0.08, ['shell', 0.08])
        } else if (ground === BLACKSAND)
          kind = pick(roll, ['rock', 0.07], ['deadtree', 0.04], ['driftwood', 0.03])
        else if (ground === ROCK)
          kind = pick(roll, ['relic', 0.1], ['rock', 0.08], ['deadtree', 0.04])
        else if (ground === GRAVEL) kind = pick(roll, ['rock', 0.07])
        else if (ground === MUD) {
          dense = true
          kind = pick(roll, ['mangrove', 0.4], ['mushroom', 0.08])
        } else if (ground === SWAMP) {
          // Mangroves wade in from the banks; fireflies drift over the open water.
          dense = true
          kind = near(x, y, 1, (g) => !isWetGround(g))
            ? pick(roll, ['mangrove', 0.35])
            : pick(roll, ['fireflies', 0.12])
        }
        const isTall = kind !== null && tallKinds.includes(kind)
        if (kind === 'palm') {
          if (crowded(x, y, 3)) kind = null
        } else if (isTall) {
          if (crowded(x, y, dense ? 1 : 2)) kind = kind === 'tree' && roll < 0.12 ? 'bush' : null
        }
        // Fireflies drift wherever they like; everything else wants elbow room.
        if (kind && !isTall && kind !== 'fireflies' && crowded(x, y, 1)) kind = null
      }
      if (kind && decorInfo[kind].on === 'water' && crowded(x, y, 1)) kind = null
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
    const match = /^([1-9a-z]?[0-9a-z])(?:\*(\d{1,5}))?$/.exec(run)
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

export function encodeIsland(world: IslandWorld): IslandSave {
  return {
    version: ISLAND_SAVE_VERSION,
    columns: world.columns,
    rows: world.rows,
    ground: encodeRuns(world.ground),
    decor: encodeRuns(world.decor)
  }
}

export function serializeIsland(world: IslandWorld): string {
  return JSON.stringify(encodeIsland(world))
}

// Decodes exactly the current save version and nothing else: no migration, no
// repair. The shared island and its snapshots use this, so a damaged or
// unknown save is reported instead of quietly becoming a different island.
export function decodeIsland(data: unknown): IslandWorld | null {
  if (typeof data !== 'object' || data === null) return null
  const save = data as Partial<IslandSave>
  if (
    save.version !== ISLAND_SAVE_VERSION ||
    save.columns !== ISLAND_COLUMNS ||
    save.rows !== ISLAND_ROWS
  )
    return null
  const length = ISLAND_COLUMNS * ISLAND_ROWS
  const ground = decodeRuns(save.ground, length, GROUND_COUNT - 1)
  const decor = decodeRuns(save.decor, length, 0xff)
  if (!ground || !decor) return null
  const world: IslandWorld = { columns: ISLAND_COLUMNS, rows: ISLAND_ROWS, ground, decor }
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.columns; x++) {
      const index = y * world.columns + x
      if (isRetiredDecorCode(decor[index])) decor[index] = 0
      if (!isEditableTile(world, x, y) && (ground[index] !== WATER || decor[index] !== 0))
        return null
      if (!isDecorCode(decor[index])) return null
      const kind = decorKindOf(decor[index])
      if (kind && !decorFits(kind, ground[index] as Ground)) return null
    }
  }
  return world
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
      // Nobody lives in the water, though anyone may end up swimming in it.
      if (!isWalkable(world, x, y) || isWetGround(groundAt(world, x, y))) continue
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
