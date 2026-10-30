import type { BlogPostSummary } from './blog-post'
import { hashSlug, type SceneSize } from './scene-math'
import { townPersonStyles } from './town-person'
import { type TrafficRoute, trafficPose } from './town-traffic'
import { type TownView, townToBoard } from './town-view'
import { coastOutline, townPeaks, walkSegments } from './town-world'

export type TownArticle = {
  slug: string
  variant: number
  kind: 'walker' | 'bicycle'
  route: TrafficRoute
}

const residentSegments = walkSegments

// Shuffle the full catalogue once per visit; filtering keeps these residents in place.
export function layoutTownArticles(
  posts: BlogPostSummary[],
  random: () => number = Math.random
): TownArticle[] {
  const segments = [...residentSegments]
  for (let i = segments.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[segments[i], segments[j]] = [segments[j], segments[i]]
  }
  return posts.map(({ slug }, index) => {
    const seed = hashSlug(slug)
    const riding = slug !== 'skills-inventory' && (seed >>> 16) % 4 === 0
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
        lane: (random() < 0.5 ? -1 : 1) * (riding ? segment.cycleLane : segment.lane),
        progress: 0.08 + ((slot + random()) / count) * 0.84,
        speed: (riding ? 28 : 10) + (seed % 5)
      }
    }
  })
}

// Choose a street or beach circuit to rejoin after walking from the drop location.
export function nearestResidentRoute(
  point: { x: number; z: number },
  route: TrafficRoute,
  canStand: (point: { x: number; z: number }) => boolean = () => true
) {
  let nearest = route
  let distance = Infinity
  // Cyclists ride along the curb; walkers keep to the middle of the pavement.
  const riding = route.speed > 20
  for (const segment of residentSegments) {
    const radius = riding ? segment.cycleLane : segment.lane
    for (const lane of [-radius, radius]) {
      const candidate = { ...route, start: segment.start, end: segment.end, lane, progress: 0 }
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

const landmarks = [...coastOutline().map((point) => ({ ...point, height: 0 })), ...townPeaks]
export function getTownBounds(rotation = 0) {
  const projected = landmarks.map((p) => townToBoard(p.x, p.z, p.height, rotation))
  return {
    left: Math.min(...projected.map((p) => p.x)) - 160,
    right: Math.max(...projected.map((p) => p.x)) + 160,
    top: Math.min(...projected.map((p) => p.y)) - 220,
    bottom: Math.max(...projected.map((p) => p.y)) + 160
  }
}
export function fitTown(size: SceneSize, rotation = 0): TownView {
  const townBounds = getTownBounds(rotation)
  const zoom = Math.max(
    0.01,
    Math.min(
      1,
      (size.width - 32) / (townBounds.right - townBounds.left),
      (size.height - 170) / (townBounds.bottom - townBounds.top)
    )
  )
  return {
    rotation,
    zoom,
    x: size.width / 2 - ((townBounds.left + townBounds.right) / 2) * zoom,
    y: (size.height + 30) / 2 - ((townBounds.top + townBounds.bottom) / 2) * zoom
  }
}

export function clampTownView(view: TownView, size: SceneSize): TownView {
  const townBounds = getTownBounds(view.rotation)
  const zoom = Math.max(Math.min(0.15, fitTown(size, view.rotation).zoom), Math.min(2.5, view.zoom))
  const clamp = (value: number, min: number, max: number) =>
    min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value))
  return {
    ...view,
    zoom,
    x: clamp(view.x, size.width - 40 - townBounds.right * zoom, 40 - townBounds.left * zoom),
    y: clamp(view.y, size.height - 80 - townBounds.bottom * zoom, 90 - townBounds.top * zoom)
  }
}

export function initialTownView(size: SceneSize, article?: TownArticle): TownView {
  const pose = article ? trafficPose(article.route, 0) : { x: 600, z: 200 }
  const point = townToBoard(pose.x, pose.z, 28)
  const zoom = 0.5
  return clampTownView(
    {
      x: size.width / 2 - point.x * zoom,
      y: size.height * 0.56 - point.y * zoom,
      zoom,
      rotation: 0
    },
    size
  )
}

export function placeTownBubble(
  point: { x: number; y: number },
  bubble: SceneSize,
  viewport: SceneSize
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
