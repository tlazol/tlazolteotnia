import { isProtectedIndex } from './island-policy'
import {
  type DecorKind,
  decorBlocksWalking,
  decorCode,
  decorFits,
  decorInfo,
  decorKindOf,
  decorNames,
  type Ground,
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

export type IslandCommand =
  | { tool: 'land'; ground: LandGround }
  | { tool: 'erase' }
  | { tool: 'decor'; decor: DecorKind }
  | { tool: 'remove' }

// Why a tile in a valid request was left alone. Malformed requests (outside the
// editable area, duplicates, unknown tools) are refused as a whole instead.
export type SkipCode = 'PROTECTED_TILE' | 'DECOR_CONFLICT' | 'INVALID_GROUND' | 'NO_CHANGE'
export type CommandPlan = { edit: TileEdit; code: null } | { edit: null; code: SkipCode }

export function commandOf(options: Pick<EditOptions, 'tool' | 'ground' | 'decor'>): IslandCommand {
  switch (options.tool) {
    case 'land':
      return { tool: 'land', ground: options.ground }
    case 'decor':
      return { tool: 'decor', decor: options.decor }
    default:
      return { tool: options.tool }
  }
}

export function isEditableIndex(world: IslandWorld, index: number) {
  return (
    Number.isSafeInteger(index) &&
    index >= 0 &&
    index < world.columns * world.rows &&
    isEditableTile(world, index % world.columns, Math.floor(index / world.columns))
  )
}

// The one rule both the browser preview and the island's server apply. It
// reads only the confirmed island, never where residents happen to walk: the
// fixed shelter around the centre keeps a walkable spot for everyone.
export function planCommand(
  world: IslandWorld,
  index: number,
  command: IslandCommand
): CommandPlan {
  const ground = world.ground[index] as Ground
  const decor = world.decor[index]
  const edit = (next: Partial<TileState>): CommandPlan => ({
    edit: { index, ground, decor, ...next },
    code: null
  })
  const skip = (code: SkipCode): CommandPlan => ({ edit: null, code })
  switch (command.tool) {
    case 'land':
      if (ground === command.ground) return skip('NO_CHANGE')
      return edit({ ground: command.ground, decor: ground === WATER ? 0 : decor })
    case 'erase':
      if (ground === WATER) return skip('NO_CHANGE')
      if (isProtectedIndex(index)) return skip('PROTECTED_TILE')
      return edit({ ground: WATER, decor: 0 })
    case 'decor': {
      if (!decorFits(command.decor, ground)) return skip('INVALID_GROUND')
      const existing = decorKindOf(decor)
      if (existing === command.decor) return skip('NO_CHANGE')
      if (existing) return skip('DECOR_CONFLICT')
      const code = decorCode(command.decor)
      if (decorBlocksWalking(code) && isProtectedIndex(index)) return skip('PROTECTED_TILE')
      return edit({ decor: code })
    }
    case 'remove':
      if (!decor) return skip('NO_CHANGE')
      return edit({ decor: 0 })
  }
}

export function planTileEdit(
  world: IslandWorld,
  x: number,
  y: number,
  options: EditOptions
): TilePlan {
  if (!isEditableTile(world, x, y)) return { edit: null, reason: '編集できる範囲の外です' }
  const index = y * world.columns + x
  const plan = planCommand(world, index, commandOf(options))
  if (plan.edit) return { edit: plan.edit, reason: null }
  return { edit: null, ...explain(world, index, options, plan.code) }
}

function explain(
  world: IslandWorld,
  index: number,
  options: EditOptions,
  code: SkipCode
): { reason: string; soft?: boolean } {
  const existing = decorKindOf(world.decor[index])
  switch (code) {
    case 'NO_CHANGE':
      if (options.tool === 'land')
        return { reason: `もう${groundNames[options.ground]}です`, soft: true }
      if (options.tool === 'erase') return { reason: 'ここはもう海です', soft: true }
      if (options.tool === 'decor' && existing)
        return { reason: `もう${decorNames[existing]}があります`, soft: true }
      return { reason: '撤去できる装飾がありません' }
    case 'PROTECTED_TILE':
      return {
        reason: options.tool === 'erase' ? '島の中心は削れません' : '島の中心には置けません'
      }
    case 'DECOR_CONFLICT':
      return {
        reason: `${existing ? decorNames[existing] : '装飾'}があります。先に「撤去」してください`
      }
    case 'INVALID_GROUND':
      return {
        reason:
          decorInfo[options.decor].on === 'water'
            ? `${decorNames[options.decor]}は海に浮かべてください`
            : '海の上には置けません'
      }
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
  options: EditOptions
): BrushPlan {
  const tiles: BrushPlan['tiles'] = []
  const edits: TileEdit[] = []
  let reason: string | null = null
  let soft = false
  // Decorations are placed and removed one at a time.
  const brush = options.tool === 'decor' || options.tool === 'remove' ? 1 : options.brush
  for (const tile of brushTiles(x, y, brush)) {
    const plan = planTileEdit(world, tile.x, tile.y, options)
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

// Brush size used by a tool: decorations are placed and removed one at a time.
export function brushFor(options: EditOptions): BrushSize {
  return options.tool === 'decor' || options.tool === 'remove' ? 1 : options.brush
}

// Indices a stroke covers at one tile, inside the editable area.
export function brushIndices(world: IslandWorld, x: number, y: number, options: EditOptions) {
  return brushTiles(x, y, brushFor(options))
    .filter((tile) => isEditableTile(world, tile.x, tile.y))
    .map((tile) => tile.y * world.columns + tile.x)
}

// Adds the tiles that would really change to a stroke's targets, without
// repeats and up to the limit. Returns the newly added indices.
export function collectStrokeTargets(
  world: IslandWorld,
  command: IslandCommand,
  targets: number[],
  candidates: number[],
  limit: number
) {
  const added: number[] = []
  for (const index of candidates) {
    if (targets.length >= limit) break
    if (targets.includes(index)) continue
    if (!planCommand(world, index, command).edit) continue
    targets.push(index)
    added.push(index)
  }
  return added
}

// What a stroke would change on the latest confirmed island. Targets that
// someone else already changed the same way simply drop out.
export function planStroke(world: IslandWorld, command: IslandCommand, targets: number[]) {
  const edits: TileEdit[] = []
  for (const index of targets) {
    const plan = planCommand(world, index, command)
    if (plan.edit) edits.push(plan.edit)
  }
  return edits
}

// Copies the confirmed island into the drawn one at the given tiles, then lays
// the preview over it. Returns the tiles whose drawn state changed.
export function overlayPreview(
  drawn: IslandWorld,
  confirmed: IslandWorld,
  touched: Iterable<number>,
  preview: TileEdit[]
) {
  const indices = new Set(touched)
  for (const edit of preview) indices.add(edit.index)
  const before = new Map<number, number>()
  for (const index of indices) {
    before.set(index, drawn.ground[index] * 256 + drawn.decor[index])
    drawn.ground[index] = confirmed.ground[index]
    drawn.decor[index] = confirmed.decor[index]
  }
  for (const edit of preview) {
    drawn.ground[edit.index] = edit.ground
    drawn.decor[edit.index] = edit.decor
  }
  return [...indices].filter(
    (index) => before.get(index) !== drawn.ground[index] * 256 + drawn.decor[index]
  )
}

export function applyEdits(world: IslandWorld, edits: TileEdit[]) {
  for (const edit of edits) {
    world.ground[edit.index] = edit.ground
    world.decor[edit.index] = edit.decor
  }
}

export function cloneIsland(world: IslandWorld): IslandWorld {
  return {
    columns: world.columns,
    rows: world.rows,
    ground: world.ground.slice(),
    decor: world.decor.slice()
  }
}
