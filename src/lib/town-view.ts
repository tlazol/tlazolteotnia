import { type SceneView, zoomViewAt } from './scene-math'
import { townGroundHeight } from './town-world'

// Missing rotation means the original diagonal view.
export type TownView = SceneView & { rotation?: number }
type Point = { x: number; y: number }
// Kept in memory for route navigation; only written by client effects and events.
export const townSession: {
  view?: TownView
  search?: { topic?: string; q?: string }
} = {}

const elevation = Math.PI / 4
const sinElevation = Math.sin(elevation)

export function townToBoard(x: number, z: number, height = 0, rotation = 0) {
  const angle = Math.PI / 4 + rotation
  return {
    x: Math.cos(angle) * x - Math.sin(angle) * z,
    y: sinElevation * (Math.sin(angle) * x + Math.cos(angle) * z) - height * Math.cos(elevation)
  }
}

// Inverse projection onto the ground, also used for screen-space drag deltas.
export function boardToTown(x: number, y: number, rotation = 0) {
  const angle = Math.PI / 4 + rotation
  return {
    x: Math.cos(angle) * x + (Math.sin(angle) * y) / sinElevation,
    z: -Math.sin(angle) * x + (Math.cos(angle) * y) / sinElevation
  }
}

// The town point at a given height under a screen point.
export function boardToTownAt(x: number, y: number, height: number, rotation = 0) {
  return boardToTown(x, y + height * Math.cos(elevation), rotation)
}

// Find the frontmost terrain under a screen point, including hills above the town.
export function boardToTownTerrain(x: number, y: number, rotation = 0) {
  const pointAt = (height: number) => boardToTownAt(x, y, height, rotation)
  const aboveGround = (height: number) => {
    const point = pointAt(height)
    return height > townGroundHeight(point.x, point.z)
  }
  // 8192 exceeds the sum of all peak heights; -48 is the seabed.
  for (let top = 8192; top > -48; top -= 16) {
    let low = Math.max(-48, top - 16)
    if (aboveGround(low)) continue
    let high = top
    for (let step = 0; step < 16; step++) {
      const middle = (low + high) / 2
      if (aboveGround(middle)) high = middle
      else low = middle
    }
    return pointAt((low + high) / 2)
  }
  return pointAt(-48)
}

export function rotateTownAt(view: TownView, delta: number, point: Point): TownView {
  const ground = boardToTown(
    (point.x - view.x) / view.zoom,
    (point.y - view.y) / view.zoom,
    view.rotation
  )
  const rotation = Math.atan2(
    Math.sin((view.rotation ?? 0) + delta),
    Math.cos((view.rotation ?? 0) + delta)
  )
  const projected = townToBoard(ground.x, ground.z, 0, rotation)
  return {
    ...view,
    rotation,
    x: point.x - projected.x * view.zoom,
    y: point.y - projected.y * view.zoom
  }
}

export function zoomTownAt(view: TownView, factor: number, point: Point): TownView {
  return { ...view, ...zoomViewAt(view, factor, point) }
}

export function gestureTownView(
  view: TownView,
  before: [Point, Point],
  after: [Point, Point]
): TownView {
  const center = (points: [Point, Point]) => ({
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2
  })
  const oldCenter = center(before)
  const newCenter = center(after)
  const dx = before[1].x - before[0].x
  const dy = before[1].y - before[0].y
  const nextDx = after[1].x - after[0].x
  const nextDy = after[1].y - after[0].y
  const distance = Math.hypot(dx, dy)
  const nextDistance = Math.hypot(nextDx, nextDy)
  // Nearly coincident fingers have no reliable angle or scale.
  const stable = distance >= 8 && nextDistance >= 8
  const rotated = rotateTownAt(
    view,
    stable ? Math.atan2(nextDy, nextDx) - Math.atan2(dy, dx) : 0,
    oldCenter
  )
  const zoomed = zoomTownAt(rotated, stable ? nextDistance / distance : 1, oldCenter)
  return {
    ...zoomed,
    x: zoomed.x + newCenter.x - oldCenter.x,
    y: zoomed.y + newCenter.y - oldCenter.y
  }
}
