import { MAX_GROUND_HEIGHT, tileHeight } from './island-relief'
import { ISLAND_COLUMNS, ISLAND_ROWS, type IslandWorld, TILE_SIZE } from './island-world'
import type { SceneSize } from './scene-math'

// The view center is a map coordinate at sea level. Quarter turns orbit it.
export type IslandView = { x: number; y: number; zoom: number; turn?: number }
export type Point = { x: number; y: number }

export const zoomLevels = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6] as const
export const WORLD_WIDTH = ISLAND_COLUMNS * TILE_SIZE
export const WORLD_HEIGHT = ISLAND_ROWS * TILE_SIZE
export const islandSession: { view?: IslandView } = {}

export const pitchSin = 0.6
export const pitchCos = 0.8
const axes = [
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1]
].map(([x, y]) => ({
  x: x * Math.SQRT1_2,
  y: y * Math.SQRT1_2
}))
export const cameraAxis = (view: IslandView) => axes[view.turn ?? 0]

// Rotate grid-key movement together with the map, keeping one tile per key.
export function gridStep(view: IslandView, dx: number, dy: number): Point {
  switch (view.turn) {
    case 1:
      return { x: dy, y: -dx }
    case 2:
      return { x: -dx, y: -dy }
    case 3:
      return { x: -dy, y: dx }
    default:
      return { x: dx, y: dy }
  }
}

export function defaultZoom(size: SceneSize) {
  return size.width < 600
    ? 1.5
    : Math.max(1, nearestZoom(Math.min(size.width / 1250, size.height / 750)))
}

export function nearestZoom(zoom: number) {
  let best: number = zoomLevels[0]
  for (const level of zoomLevels)
    if (Math.abs(Math.log(level / zoom)) < Math.abs(Math.log(best / zoom))) best = level
  return best
}

export function stepZoom(zoom: number, direction: 1 | -1) {
  const index = zoomLevels.indexOf(nearestZoom(zoom) as (typeof zoomLevels)[number])
  return zoomLevels[Math.max(0, Math.min(zoomLevels.length - 1, index + direction))]
}

export function projectGround(view: IslandView, x: number, y: number, height = 0): Point {
  const axis = cameraAxis(view)
  return { x: axis.y * x - axis.x * y, y: pitchSin * (axis.x * x + axis.y * y) - pitchCos * height }
}

export function worldToScreen(view: IslandView, size: SceneSize, point: Point, height = 0): Point {
  const p = projectGround(view, point.x - view.x, point.y - view.y, height)
  return { x: size.width / 2 + p.x * view.zoom, y: size.height / 2 + p.y * view.zoom }
}

export function screenToWorld(view: IslandView, size: SceneSize, point: Point): Point {
  const axis = cameraAxis(view)
  const u = (point.x - size.width / 2) / view.zoom
  const v = (point.y - size.height / 2) / (view.zoom * pitchSin)
  return { x: view.x + axis.y * u + axis.x * v, y: view.y - axis.x * u + axis.y * v }
}

// Walk the short pick ray from above the highest terrace to the water. Within
// each tile, the first intersection may be its top or its exposed cliff face.
export function tileAt(
  view: IslandView,
  size: SceneSize,
  point: Point,
  world?: IslandWorld | null
) {
  const base = screenToWorld(view, size, point)
  const seaTile = { x: Math.floor(base.x / TILE_SIZE), y: Math.floor(base.y / TILE_SIZE) }
  if (!world) return seaTile
  const axis = cameraAxis(view)
  const dx = (axis.x * pitchCos) / pitchSin
  const dy = (axis.y * pitchCos) / pitchSin
  let z = MAX_GROUND_HEIGHT
  let x = Math.floor((base.x + z * dx) / TILE_SIZE)
  let y = Math.floor((base.y + z * dy) / TILE_SIZE)
  while (z > 0) {
    const nextX = ((x + (dx < 0 ? 1 : 0)) * TILE_SIZE - base.x) / dx
    const nextY = ((y + (dy < 0 ? 1 : 0)) * TILE_SIZE - base.y) / dy
    const exit = Math.max(nextX, nextY)
    if (tileHeight(world, x, y) >= Math.max(0, exit)) return { x, y }
    if (nextX >= nextY) x -= Math.sign(dx)
    if (nextY >= nextX) y -= Math.sign(dy)
    z = exit
  }
  return seaTile
}

export function clampView(view: IslandView, size: SceneSize): IslandView {
  const zoom = Math.max(zoomLevels[0], Math.min(zoomLevels[zoomLevels.length - 1], view.zoom))
  const margin = Math.max(32, (Math.min(size.width, size.height) / zoom) * 0.1)
  return {
    ...view,
    zoom,
    x: Math.max(-margin, Math.min(WORLD_WIDTH + margin, view.x)),
    y: Math.max(-margin, Math.min(WORLD_HEIGHT + margin, view.y))
  }
}

export function zoomViewAt(view: IslandView, size: SceneSize, zoom: number, point: Point) {
  const anchor = screenToWorld(view, size, point)
  const ratio = view.zoom / zoom
  return clampView(
    {
      ...view,
      zoom,
      x: anchor.x + (view.x - anchor.x) * ratio,
      y: anchor.y + (view.y - anchor.y) * ratio
    },
    size
  )
}

export function panView(view: IslandView, size: SceneSize, dx: number, dy: number) {
  const center = screenToWorld(view, size, { x: size.width / 2 - dx, y: size.height / 2 - dy })
  return clampView({ ...view, ...center }, size)
}

export function viewOn(
  target: Point,
  size: SceneSize,
  zoom = defaultZoom(size),
  turn = 0,
  height = 0
): IslandView {
  return panView({ ...target, turn, zoom }, size, 0, size.height * 0.08 + height * pitchCos * zoom)
}
