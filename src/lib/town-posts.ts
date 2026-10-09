import type { BlogPostSummary } from './blog-post'
import { type BoardSize, type BoardView, hashSlug } from './sticker-board'
import { onettBuildings, onettHills, onettRoads, onettToTown } from './town-layout'
import { townPersonStyles } from './town-person'
import { type TrafficRoute, trafficPose } from './town-traffic'

export type TownArticle = {
  slug: string
  variant: number
  kind: 'walker' | 'bicycle'
  route: TrafficRoute
}

// Residents walk at ground level, so trim paths where the raised hills cover them.
const residentRoadSegments = onettRoads.flatMap((road) =>
  road.points.slice(1).flatMap((end, index) => {
    const start = road.points[index]
    const dx = end.x - start.x
    const dz = end.z - start.z
    let intervals = [{ start: 0, end: 1 }]
    for (const hill of onettHills) {
      const center = onettToTown(hill.x, hill.y)
      let enter = 0
      let exit = 1
      for (const [origin, delta, middle, extent] of [
        [start.x, dx, center.x, hill.width / 2 + 60],
        [start.z, dz, center.z, hill.depth / 2 + 60]
      ]) {
        if (delta === 0) {
          if (Math.abs(origin - middle) > extent) exit = -1
        } else {
          const a = (middle - extent - origin) / delta
          const b = (middle + extent - origin) / delta
          enter = Math.max(enter, Math.min(a, b))
          exit = Math.min(exit, Math.max(a, b))
        }
      }
      if (enter >= exit) continue
      intervals = intervals.flatMap((interval) => {
        if (exit <= interval.start || enter >= interval.end) return [interval]
        return [
          { start: interval.start, end: Math.max(interval.start, enter) },
          { start: Math.min(interval.end, exit), end: interval.end }
        ].filter((part) => part.end > part.start)
      })
    }
    return intervals
      .filter((part) => (part.end - part.start) * Math.hypot(dx, dz) >= 120)
      .map((part) => ({
        start:
          part.start === 0 ? start : { x: start.x + dx * part.start, z: start.z + dz * part.start },
        end: part.end === 1 ? end : { x: start.x + dx * part.end, z: start.z + dz * part.end },
        lane: road.trail ? 9 : road.width / 2 + 9
      }))
  })
)

// Shuffle the full catalogue once per visit; filtering keeps these residents in place.
export function layoutTownArticles(
  posts: BlogPostSummary[],
  random: () => number = Math.random
): TownArticle[] {
  const segments = [...residentRoadSegments]
  for (let i = segments.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[segments[i], segments[j]] = [segments[j], segments[i]]
  }
  return posts.map(({ slug }, index) => {
    const seed = hashSlug(slug)
    const riding = (seed >>> 16) % 4 === 0
    const segment = segments[index % segments.length]
    const count = Math.ceil((posts.length - (index % segments.length)) / segments.length)
    const slot = Math.floor(index / segments.length)
    return {
      slug,
      variant: seed % townPersonStyles.length,
      kind: riding ? 'bicycle' : 'walker',
      route: {
        start: segment.start,
        end: segment.end,
        lane: (random() < 0.5 ? -1 : 1) * Math.min(segment.lane, riding ? 29 : 48),
        progress: 0.08 + ((slot + random()) / count) * 0.84,
        speed: (riding ? 28 : 10) + (seed % 5)
      }
    }
  })
}

// Choose a lane to rejoin after walking back from the drop location.
export function nearestResidentRoute(
  point: { x: number; z: number },
  route: TrafficRoute,
  canStand: (point: { x: number; z: number }) => boolean = () => true
) {
  let nearest = route
  let distance = Infinity
  for (const segment of residentRoadSegments) {
    const radius = Math.min(segment.lane, Math.abs(route.lane))
    for (const lane of [-radius, radius]) {
      const candidate = { ...route, ...segment, lane, progress: 0 }
      const start = trafficPose(candidate, 0)
      const end = trafficPose({ ...candidate, progress: 1 }, 0)
      const dx = end.x - start.x
      const dz = end.z - start.z
      candidate.progress = Math.max(
        0,
        Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / (dx * dx + dz * dz))
      )
      const pose = trafficPose(candidate, 0)
      const nextDistance = Math.hypot(point.x - pose.x, point.z - pose.z)
      if (nextDistance < distance && canStand(pose)) {
        nearest = candidate
        distance = nextDistance
      }
    }
  }
  return nearest
}

export function townToBoard(x: number, z: number, height = 0) {
  return { x: (x - z) / Math.SQRT2, y: (x + z) / 2 - height / Math.SQRT2 }
}

const landmarks = [...onettRoads.flatMap((road) => road.points), ...onettBuildings].map((p) =>
  townToBoard(p.x, p.z)
)
export const townBounds = {
  left: Math.min(...landmarks.map((p) => p.x)) - 220,
  right: Math.max(...landmarks.map((p) => p.x)) + 220,
  top: Math.min(...landmarks.map((p) => p.y)) - 300,
  bottom: Math.max(...landmarks.map((p) => p.y)) + 220
}

export function fitTown(size: BoardSize): BoardView {
  const zoom = Math.max(
    0.03,
    Math.min(
      1,
      (size.width - 32) / (townBounds.right - townBounds.left),
      (size.height - 170) / (townBounds.bottom - townBounds.top)
    )
  )
  return {
    zoom,
    x: size.width / 2 - ((townBounds.left + townBounds.right) / 2) * zoom,
    y: (size.height + 30) / 2 - ((townBounds.top + townBounds.bottom) / 2) * zoom
  }
}

export function clampTownView(view: BoardView, size: BoardSize): BoardView {
  const zoom = Math.max(Math.min(0.15, fitTown(size).zoom), Math.min(2.5, view.zoom))
  const clamp = (value: number, min: number, max: number) =>
    min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value))
  return {
    zoom,
    x: clamp(view.x, size.width - 40 - townBounds.right * zoom, 40 - townBounds.left * zoom),
    y: clamp(view.y, size.height - 80 - townBounds.bottom * zoom, 90 - townBounds.top * zoom)
  }
}

export function initialTownView(size: BoardSize, article?: TownArticle): BoardView {
  const pose = article ? trafficPose(article.route, 0) : { x: 2000, z: 600 }
  const point = townToBoard(pose.x, pose.z, 28)
  const zoom = 1
  return clampTownView(
    { x: size.width / 2 - point.x * zoom, y: size.height * 0.56 - point.y * zoom, zoom },
    size
  )
}

export function placeTownBubble(
  point: { x: number; y: number },
  bubble: BoardSize,
  viewport: BoardSize
) {
  const left = Math.max(
    12,
    Math.min(viewport.width - bubble.width - 12, point.x - bubble.width / 2)
  )
  const above = point.y - bubble.height - 22 >= 82
  const top = Math.max(
    82,
    Math.min(
      viewport.height - bubble.height - 95,
      above ? point.y - bubble.height - 22 : point.y + 24
    )
  )
  return { left, top, above, tail: Math.max(22, Math.min(bubble.width - 22, point.x - left)) }
}
