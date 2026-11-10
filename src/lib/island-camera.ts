import { ISLAND_COLUMNS, ISLAND_ROWS, TILE_SIZE } from './island-world'
import type { SceneSize } from './scene-math'

// x and y are the world pixel at the center of the viewport; zoom is screen
// pixels per art pixel. Zoom steps keep every art pixel a whole number of
// device pixels on 1x and 2x screens.
export type IslandView = { x: number; y: number; zoom: number }
type Point = { x: number; y: number }

export const zoomLevels = [1, 1.5, 2, 2.5, 3, 4, 5, 6] as const
export const WORLD_WIDTH = ISLAND_COLUMNS * TILE_SIZE
export const WORLD_HEIGHT = ISLAND_ROWS * TILE_SIZE

// Kept in memory so leaving for another page and coming back keeps the view.
export const islandSession: { view?: IslandView } = {}

export function defaultZoom(size: SceneSize) {
  const short = Math.min(size.width, size.height)
  return short < 1000 ? 2 : 3
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

export function screenToWorld(view: IslandView, size: SceneSize, point: Point): Point {
  return {
    x: view.x + (point.x - size.width / 2) / view.zoom,
    y: view.y + (point.y - size.height / 2) / view.zoom
  }
}

export function worldToScreen(view: IslandView, size: SceneSize, point: Point): Point {
  return {
    x: (point.x - view.x) * view.zoom + size.width / 2,
    y: (point.y - view.y) * view.zoom + size.height / 2
  }
}

export function tileAt(view: IslandView, size: SceneSize, point: Point) {
  const world = screenToWorld(view, size, point)
  return { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) }
}

// The view center may wander a little past the map, never so far that the island leaves the screen.
export function clampView(view: IslandView, size: SceneSize): IslandView {
  const zoom = Math.max(zoomLevels[0], Math.min(zoomLevels[zoomLevels.length - 1], view.zoom))
  const marginX = Math.max(0, size.width / zoom / 2 - WORLD_WIDTH / 2) + 64
  const marginY = Math.max(0, size.height / zoom / 2 - WORLD_HEIGHT / 2) + 64
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  return {
    zoom,
    x: clamp(view.x, -marginX + WORLD_WIDTH * 0.1, WORLD_WIDTH * 0.9 + marginX),
    y: clamp(view.y, -marginY + WORLD_HEIGHT * 0.1, WORLD_HEIGHT * 0.9 + marginY)
  }
}

// Zoom keeping the world point under `point` fixed on screen.
export function zoomViewAt(view: IslandView, size: SceneSize, zoom: number, point: Point) {
  const anchor = screenToWorld(view, size, point)
  return clampView(
    {
      zoom,
      x: anchor.x - (point.x - size.width / 2) / zoom,
      y: anchor.y - (point.y - size.height / 2) / zoom
    },
    size
  )
}

export function panView(view: IslandView, size: SceneSize, dx: number, dy: number) {
  return clampView({ ...view, x: view.x - dx / view.zoom, y: view.y - dy / view.zoom }, size)
}

// Center a world point, nudged down a little so a speech bubble fits above it.
export function viewOn(target: Point, size: SceneSize, zoom = defaultZoom(size)): IslandView {
  return clampView({ zoom, x: target.x, y: target.y - (size.height * 0.08) / zoom }, size)
}
