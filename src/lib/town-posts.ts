import type { BlogPostSummary } from './blog-post'
import { type BoardSize, type BoardView, hashSlug } from './sticker-board'
import { onettBuildings, onettRoads } from './town-layout'
import { type TrafficRoute, trafficPose } from './town-traffic'

export type TownArticle = {
  slug: string
  variant: number
  kind: 'walker' | 'bicycle'
  route: TrafficRoute
}

// Derive identities from the complete catalogue; filtering never reassigns a resident.
export function layoutTownArticles(posts: BlogPostSummary[]): TownArticle[] {
  const segments = onettRoads
    .filter((road) => !road.trail && road.width >= 78)
    .flatMap((road) =>
      road.points.slice(1).map((end, index) => ({ start: road.points[index], end }))
    )
  return posts.map(({ slug }) => {
    const seed = hashSlug(slug)
    const riding = (seed >>> 16) % 4 === 0
    return {
      slug,
      variant: seed % 30,
      kind: riding ? 'bicycle' : 'walker',
      route: {
        ...segments[seed % segments.length],
        lane: (seed & 16 ? 1 : -1) * (riding ? 29 : 48),
        progress: 0.08 + (((seed >>> 8) % 1000) / 1000) * 0.84,
        speed: (riding ? 28 : 10) + (seed % 5)
      }
    }
  })
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
