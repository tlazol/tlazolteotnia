// The island is a grid of ground tiles with at most one decoration per tile.
// Everything here is plain data so edits, saving and rendering stay separate.

export const ISLAND_COLUMNS = 80
export const ISLAND_ROWS = 60
export const TILE_SIZE = 16
// A ring of open sea around the map keeps every shoreline drawable.
export const EDIT_MARGIN = 2
export const ISLAND_SAVE_VERSION = 1
export const ISLAND_STORAGE_KEY = 'tlazolteotnia:island'

export const WATER = 0
export const SAND = 1
export const GRASS = 2
export const PATH = 3
export type Ground = typeof WATER | typeof SAND | typeof GRASS | typeof PATH
export type LandGround = Exclude<Ground, typeof WATER>
export const landGrounds: LandGround[] = [GRASS, SAND, PATH]
export const groundNames: Record<Ground, string> = {
  [WATER]: '海',
  [SAND]: '砂浜',
  [GRASS]: '草地',
  [PATH]: '小道'
}

export const decorKinds = ['tree', 'palm', 'bush', 'rock', 'flowers'] as const
export type DecorKind = (typeof decorKinds)[number]
export const decorNames: Record<DecorKind, string> = {
  tree: '木',
  palm: 'ヤシ',
  bush: '茂み',
  rock: '岩',
  flowers: '花'
}
// Stored decoration codes: 0 is empty, otherwise the index in decorKinds plus one.
export function decorCode(kind: DecorKind) {
  return decorKinds.indexOf(kind) + 1
}
export function decorKindOf(code: number): DecorKind | null {
  return decorKinds[code - 1] ?? null
}
export function decorBlocksWalking(code: number) {
  return code !== 0 && decorKindOf(code) !== 'flowers'
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

export function cloneIsland(world: IslandWorld): IslandWorld {
  return { ...world, ground: world.ground.slice(), decor: world.decor.slice() }
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

// The starting island: a lobed main island with a plaza, paths, a forest,
// beaches with palms, and two islets offshore.
export function createDefaultIsland(): IslandWorld {
  const world = createIsland()
  const { columns, rows } = world
  const set = (x: number, y: number, ground: Ground) => {
    if (isEditableTile(world, x, y)) world.ground[y * columns + x] = ground
  }
  const blob = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
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
        if (r < edge) set(x, y, r < edge - 0.2 - valueNoise(x / 2, y / 2, 5) * 0.12 ? GRASS : SAND)
      }
    }
  }
  blob(40, 30, 15, 10, 0)
  // A sandy cape to the west and a grassy hill to the north-east.
  blob(27, 34, 4.5, 3.2, 1)
  blob(50, 24, 5.5, 4, 2)
  // A small lagoon bites into the south-east coast.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const d = Math.hypot((x + 0.5 - 50) / 3.2, (y + 0.5 - 37) / 2.4)
      if (d < 1) world.ground[y * columns + x] = WATER
      else if (d < 1.5 && isLand(world, x, y)) world.ground[y * columns + x] = SAND
    }
  }
  blob(61, 17, 3, 2.3, 3)
  blob(22, 44, 2.4, 1.7, 4)
  blob(58, 43, 1.8, 1.4, 5)

  // Plaza and paths from it to the beaches.
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
      if (isLand(world, px, py)) set(px, py, PATH)
    }
  }
  path([39, 30], [28, 33], 1.2)
  path([40, 31], [41, 39], 0.8)
  path([41, 29], [50, 23], 0.8)
  path([40, 29], [38, 22], 0.6)

  // Decorations follow the ground: a forest in the north-west, palms on the beaches.
  // Trees and palms spread far wider than their tile, so they keep their distance.
  const tall = [decorCode('tree'), decorCode('palm')]
  const crowded = (x: number, y: number, reach: number) => {
    for (let dy = -reach; dy <= 0; dy++)
      for (let dx = -reach; dx <= reach; dx++)
        if ((dy < 0 || dx < 0) && tall.includes(decorAt(world, x + dx, y + dy))) return true
    return false
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const ground = groundAt(world, x, y)
      if (ground === WATER || ground === PATH) continue
      if (Math.abs(x - 40) <= 2 && Math.abs(y - 30) <= 2) continue
      const nearPath = [-1, 0, 1].some((dy) =>
        [-1, 0, 1].some((dx) => groundAt(world, x + dx, y + dy) === PATH)
      )
      const roll = hash2(x, y, 101)
      const forest = valueNoise(x / 5, y / 4, 23)
      let kind: DecorKind | null = null
      if (ground === GRASS) {
        if (forest > 0.68 && !nearPath) kind = roll < 0.38 ? 'tree' : roll < 0.44 ? 'bush' : null
        else if (roll < 0.03 && !nearPath) kind = 'tree'
        else if (roll < 0.06) kind = 'bush'
        else if (roll < 0.15) kind = valueNoise(x / 3, y / 3, 41) > 0.5 ? 'flowers' : null
        else if (roll < 0.156) kind = 'rock'
      } else {
        const coast = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ].some(([dx, dy]) => !isLand(world, x + dx, y + dy))
        if (roll < (coast ? 0.06 : 0.1)) kind = 'palm'
        else if (roll >= 0.1 && roll < 0.106) kind = 'rock'
      }
      if (kind === 'tree' && crowded(x, y, forest > 0.68 ? 2 : 3)) kind = roll < 0.1 ? 'bush' : null
      if (kind === 'palm' && crowded(x, y, 3)) kind = null
      if (kind) world.decor[y * columns + x] = decorCode(kind)
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
  if (
    save.version !== ISLAND_SAVE_VERSION ||
    save.columns !== ISLAND_COLUMNS ||
    save.rows !== ISLAND_ROWS
  )
    return null
  const length = ISLAND_COLUMNS * ISLAND_ROWS
  const ground = decodeRuns(save.ground, length, PATH)
  const decor = decodeRuns(save.decor, length, decorKinds.length)
  if (!ground || !decor) return null
  const world: IslandWorld = { columns: ISLAND_COLUMNS, rows: ISLAND_ROWS, ground, decor }
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.columns; x++) {
      const index = y * world.columns + x
      if (!isEditableTile(world, x, y)) world.ground[index] = WATER
      if (world.ground[index] === WATER) world.decor[index] = 0
    }
  }
  return world
}

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem' | 'removeItem'>

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

export function clearSavedIsland(storage: WriteStorage | null) {
  try {
    storage?.removeItem(ISLAND_STORAGE_KEY)
  } catch {
    // Storage may be unavailable; the island still resets in memory.
  }
}

// ---- Residents' homes -----------------------------------------------------

// Homes are laid out once on the default island so they stay put however the
// visitor reshapes it; settleHomes moves any that ended up in the sea.
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
