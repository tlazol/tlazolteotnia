import {
  BLACKSAND,
  BRICK,
  CLAY,
  DECK,
  GRAVEL,
  groundAt,
  type IslandWorld,
  isWetGround,
  LAVA,
  MUD,
  ROCK,
  SAND,
  valueNoise,
  WHITESAND
} from './island-world'

export const MAX_GROUND_HEIGHT = 32

// Elevation belongs to the material and location, so older islands and live
// edits use exactly the same terraces without another field in the save.
export function tileHeight(world: IslandWorld, x: number, y: number) {
  const kind = groundAt(world, x, y)
  if (isWetGround(kind)) return 0
  if (kind === DECK) return 8
  if (kind === SAND || kind === WHITESAND || kind === BLACKSAND || kind === MUD) return 4
  if (kind === GRAVEL) return 8
  const terrace = Math.floor(valueNoise(x / 9, y / 9, 706) * 3) * 4
  if (kind === ROCK || kind === LAVA) return 24 + terrace
  if (kind === CLAY) return 16 + terrace
  return (kind === BRICK ? 13 : 12) + terrace
}
