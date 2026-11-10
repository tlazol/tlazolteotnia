import {
  type DecorKind,
  decorAt,
  decorBlocksWalking,
  decorCode,
  decorFits,
  decorInfo,
  decorKindOf,
  decorNames,
  type Ground,
  groundAt,
  groundNames,
  type IslandWorld,
  isEditableTile,
  type LandGround,
  WATER
} from './island-world'

export type IslandTool = 'land' | 'erase' | 'decor' | 'remove'
export type BrushSize = 1 | 3
export type EditOptions = {
  tool: IslandTool
  ground: LandGround
  decor: DecorKind
  brush: BrushSize
}
export type TileState = { ground: Ground; decor: number }
export type TileEdit = TileState & { index: number }
// soft reasons describe a no-op (already sea, already grass) rather than a refusal.
export type TilePlan = { edit: TileEdit | null; reason: string | null; soft?: boolean }

export const toolNames: Record<IslandTool, string> = {
  land: '土地を足す・塗り替える',
  erase: '土地を削る',
  decor: '装飾を置く',
  remove: '装飾を撤去'
}

// Whether a tile is under (or about to be under) a resident's feet.
export type Occupied = (x: number, y: number) => boolean

export function planTileEdit(
  world: IslandWorld,
  x: number,
  y: number,
  options: EditOptions,
  occupied: Occupied
): TilePlan {
  if (!isEditableTile(world, x, y)) return { edit: null, reason: '編集できる範囲の外です' }
  const index = y * world.columns + x
  const ground = groundAt(world, x, y)
  const decor = decorAt(world, x, y)
  const edit = (next: Partial<TileState>): TilePlan => ({
    edit: { index, ground, decor, ...next },
    reason: null
  })
  switch (options.tool) {
    case 'land':
      if (ground === options.ground)
        return { edit: null, reason: `もう${groundNames[options.ground]}です`, soft: true }
      return edit({ ground: options.ground, decor: ground === WATER ? 0 : decor })
    case 'erase':
      if (ground === WATER) return { edit: null, reason: 'ここはもう海です', soft: true }
      if (occupied(x, y)) return { edit: null, reason: '住人の足もとは削れません' }
      return edit({ ground: WATER, decor: 0 })
    case 'decor': {
      if (!decorFits(options.decor, ground))
        return {
          edit: null,
          reason:
            decorInfo[options.decor].on === 'water'
              ? `${decorNames[options.decor]}は海に浮かべてください`
              : '海の上には置けません'
        }
      const existing = decorKindOf(decor)
      if (existing === options.decor)
        return { edit: null, reason: `もう${decorNames[existing]}があります`, soft: true }
      if (existing)
        return { edit: null, reason: `${decorNames[existing]}があります。先に「撤去」してください` }
      const code = decorCode(options.decor)
      if (decorBlocksWalking(code) && occupied(x, y))
        return { edit: null, reason: '住人が立っている場所には置けません' }
      return edit({ decor: code })
    }
    case 'remove':
      if (!decor) return { edit: null, reason: '撤去できる装飾がありません' }
      return edit({ decor: 0 })
  }
}

export function brushTiles(x: number, y: number, brush: BrushSize) {
  if (brush === 1) return [{ x, y }]
  const tiles: Array<{ x: number; y: number }> = []
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) tiles.push({ x: x + dx, y: y + dy })
  return tiles
}

export type BrushPlan = {
  tiles: Array<{ x: number; y: number; allowed: boolean }>
  edits: TileEdit[]
  // Why nothing (or not the tile under the pointer) can change, for the cursor.
  reason: string | null
  soft: boolean
}

export function planBrush(
  world: IslandWorld,
  x: number,
  y: number,
  options: EditOptions,
  occupied: Occupied
): BrushPlan {
  const tiles: BrushPlan['tiles'] = []
  const edits: TileEdit[] = []
  let reason: string | null = null
  let soft = false
  // Decorations are placed and removed one at a time.
  const brush = options.tool === 'decor' || options.tool === 'remove' ? 1 : options.brush
  for (const tile of brushTiles(x, y, brush)) {
    const plan = planTileEdit(world, tile.x, tile.y, options, occupied)
    tiles.push({ ...tile, allowed: plan.edit !== null })
    if (plan.edit) edits.push(plan.edit)
    else if (tile.x === x && tile.y === y) {
      reason = plan.reason
      soft = plan.soft === true
    }
  }
  return edits.length ? { tiles, edits, reason: null, soft: false } : { tiles, edits, reason, soft }
}

// Tiles crossed between two pointer samples, so fast drags leave no gaps.
// Steps are 4-connected: a diagonal step would only touch at a corner and
// leave two separate islands.
export function tilesAlong(from: { x: number; y: number }, to: { x: number; y: number }) {
  const tiles: Array<{ x: number; y: number }> = [{ ...from }]
  let x = from.x
  let y = from.y
  const dx = Math.abs(to.x - x)
  const dy = Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1
  const sy = y < to.y ? 1 : -1
  let error = dx - dy
  while (x !== to.x || y !== to.y) {
    if (error * 2 > -dy && x !== to.x) {
      error -= dy
      x += sx
    } else {
      error += dx
      y += sy
    }
    tiles.push({ x, y })
  }
  return tiles
}

// Keep only the unfinished gesture so switching to a pinch can cancel it.
export function createIslandStroke() {
  let before = new Map<number, TileState>()
  return {
    begin() {
      before = new Map()
    },
    apply(world: IslandWorld, edits: TileEdit[]) {
      const changed: number[] = []
      for (const edit of edits) {
        if (world.ground[edit.index] === edit.ground && world.decor[edit.index] === edit.decor)
          continue
        if (!before.has(edit.index))
          before.set(edit.index, {
            ground: world.ground[edit.index] as Ground,
            decor: world.decor[edit.index]
          })
        world.ground[edit.index] = edit.ground
        world.decor[edit.index] = edit.decor
        changed.push(edit.index)
      }
      return changed
    },
    commit() {
      const changed = before.size > 0
      before.clear()
      return changed
    },
    cancel(world: IslandWorld) {
      const changed = [...before.keys()]
      for (const [index, state] of before) {
        world.ground[index] = state.ground
        world.decor[index] = state.decor
      }
      before.clear()
      return changed
    }
  }
}
