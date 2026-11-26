import {
  BLACKSAND,
  BRICK,
  CLAY,
  DECK,
  GRAVEL,
  type Ground,
  groundAt,
  type IslandWorld,
  isWetGround,
  LAVA,
  MAX_ELEVATION_LEVEL,
  MIN_ELEVATION_LEVEL,
  MUD,
  ROCK,
  SAND,
  SEA_LEVEL_CODE,
  valueNoise,
  WHITESAND
} from './island-world'

const STEP_HEIGHT = 4
// Brick paving sits one unit above the underlying terrace.
export const MAX_GROUND_HEIGHT = MAX_ELEVATION_LEVEL * STEP_HEIGHT + 1

export const MIN_GROUND_HEIGHT = MIN_ELEVATION_LEVEL * STEP_HEIGHT

export function elevationLevel(code: number) {
  return code >= SEA_LEVEL_CODE ? SEA_LEVEL_CODE - code : code
}

export function elevationCode(level: number, natural: number) {
  if (level === natural) return 0
  return level <= 0 ? SEA_LEVEL_CODE - level : level
}

export function naturalLevel(kind: Ground, x: number, y: number) {
  if (isWetGround(kind)) return 0
  if (kind === DECK || kind === GRAVEL) return 2
  if (kind === SAND || kind === WHITESAND || kind === BLACKSAND || kind === MUD) return 1
  const terrace = Math.floor(valueNoise(x / 9, y / 9, 706) * 3)
  if (kind === ROCK || kind === LAVA) return 6 + terrace
  if (kind === CLAY) return 4 + terrace
  return 3 + terrace
}

export function tileHeight(world: IslandWorld, x: number, y: number) {
  const kind = groundAt(world, x, y)
  if (isWetGround(kind)) return 0
  const code = world.elevation[y * world.columns + x]
  const level = code ? elevationLevel(code) : naturalLevel(kind, x, y)
  return level * STEP_HEIGHT + (kind === BRICK ? 1 : 0)
}
