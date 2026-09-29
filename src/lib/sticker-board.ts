import { type BlogPostSummary, sortBlogPostsNewestFirst } from './blog-post'

export type BoardView = { x: number; y: number; zoom: number }
export type BoardSize = { width: number; height: number }
const stickerShapes = ['die-cut', 'rounded', 'ticket', 'beveled', 'scalloped', 'ribbon'] as const
export const hologramFinishes = ['prism', 'glitter', 'aurora', 'laser'] as const
export type Sticker = {
  post: BlogPostSummary
  x: number
  y: number
  width: number
  height: number
  angle: number
  seed: number
  shape: (typeof stickerShapes)[number]
  hologram: (typeof hologramFinishes)[number]
  eyeCount: number
  lines: string[]
  fontSize: number
}

export function hashSlug(slug: string) {
  let hash = 2166136261
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return hash >>> 0
}

// Width estimates are conservative; the renderer measures the loaded font as well.
export function wrapStickerTitle(title: string, maxUnits = 10) {
  const unitsOf = (text: string) =>
    Array.from(text).reduce((sum, char) => sum + (/[\u0020-\u007e]/.test(char) ? 0.6 : 1), 0)
  const tokens = title.match(/[A-Za-z0-9]+(?:[.+-][A-Za-z0-9]+)*|[^A-Za-z0-9]/gu) ?? []
  const parts = tokens.flatMap((token) => (unitsOf(token) > maxUnits ? Array.from(token) : [token]))
  const costs = Array.from({ length: parts.length + 1 }, () => Number.POSITIVE_INFINITY)
  const breaks = Array.from({ length: parts.length }, (_, index) => index + 1)
  costs[parts.length] = 0
  // Balance every line, including the last, so a lone character never becomes a dangling tab.
  for (let start = parts.length - 1; start >= 0; start--) {
    let width = 0
    for (let end = start + 1; end <= parts.length; end++) {
      width += unitsOf(parts[end - 1])
      if (width > maxUnits + 0.001) break
      const punctuationPenalty =
        end < parts.length && /^[、。，．！？）」』】]/.test(parts[end]) ? 80 : 0
      const cost = (maxUnits - width) ** 2 + 24 + punctuationPenalty + costs[end]
      if (cost < costs[start]) {
        costs[start] = cost
        breaks[start] = end
      }
    }
  }
  const lines: string[] = []
  for (let index = 0; index < parts.length; index = breaks[index]) {
    lines.push(parts.slice(index, breaks[index]).join(''))
  }
  return lines
}

export function layoutStickers(posts: BlogPostSummary[]) {
  const stickers = sortBlogPostsNewestFirst(posts).map((post): Sticker => {
    const seed = hashSlug(post.slug)
    const width = 288 + (seed % 3) * 18
    const lines = wrapStickerTitle(post.title, 9 + (seed % 2))
    const fontSize = lines.length > 5 ? 27 : 31
    const height = 128 + Math.max(0, lines.length - 1) * fontSize * 1.22
    const maxAngle = Math.min((9 * Math.PI) / 180, Math.asin(Math.min(1, (370 - width) / height)))
    return {
      post,
      x: 0,
      y: 0,
      width,
      height,
      angle: (((seed % 19) - 9) / 9) * maxAngle,
      seed,
      shape: stickerShapes[(seed >>> 20) % stickerShapes.length],
      hologram: hologramFinishes[(seed >>> 12) % hologramFinishes.length],
      eyeCount: 1 + ((seed >>> 16) % 4),
      lines,
      fontSize
    }
  })
  const extents = stickers.map((sticker) => ({
    width:
      Math.abs(Math.cos(sticker.angle)) * sticker.width +
      Math.abs(Math.sin(sticker.angle)) * sticker.height,
    height:
      Math.abs(Math.cos(sticker.angle)) * sticker.height +
      Math.abs(Math.sin(sticker.angle)) * sticker.width
  }))
  const horizontalSpacing = Math.max(0, ...extents.map((item) => item.width)) + 20
  const verticalSpacing = Math.max(0, ...extents.map((item) => item.height)) + 20
  let ring = 1
  let slot = 0
  let halfWidth = 0
  let halfHeight = 0
  // Five more slots per ring keep the spacing steady as the circumference grows.
  stickers.forEach((sticker, index) => {
    if (index > 0) {
      const count = ring * 5
      const angle = (slot / count) * Math.PI * 2
      sticker.x = Math.sin(angle) * ring * horizontalSpacing
      sticker.y = -Math.cos(angle) * ring * verticalSpacing
      slot++
      if (slot === count) {
        ring++
        slot = 0
      }
    }
    halfWidth = Math.max(halfWidth, Math.abs(sticker.x) + extents[index].width / 2 + 24)
    halfHeight = Math.max(halfHeight, Math.abs(sticker.y) + extents[index].height / 2 + 24)
  })
  // Symmetric bounds keep the newest article at the board's center, even on a partial ring.
  for (const sticker of stickers) {
    sticker.x += halfWidth
    sticker.y += halfHeight
  }
  return { stickers, width: halfWidth * 2, height: halfHeight * 2 }
}

export function filterStickerPosts(posts: BlogPostSummary[], topic: string, query: string) {
  const terms = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return posts.filter((post) => {
    const text = [post.title, post.description, ...post.tags]
      .join(' ')
      .normalize('NFKC')
      .toLocaleLowerCase()
    return (!topic || post.tags.includes(topic)) && terms.every((term) => text.includes(term))
  })
}

export function fitBoard(size: BoardSize, bounds: BoardSize): BoardView {
  const zoom = Math.min(
    1,
    (size.width - 36) / Math.max(1, bounds.width),
    (size.height - 150) / Math.max(1, bounds.height)
  )
  return {
    x: (size.width - bounds.width * zoom) / 2,
    y: 84 + (size.height - 150 - bounds.height * zoom) / 2,
    zoom
  }
}

export function initialBoardView(size: BoardSize, bounds: BoardSize): BoardView {
  const zoom = 0.6
  return clampBoardView(
    {
      x: (size.width - bounds.width * zoom) / 2,
      y: (size.height - bounds.height * zoom) / 2,
      zoom
    },
    size,
    bounds
  )
}

export function clampBoardView(view: BoardView, size: BoardSize, bounds: BoardSize): BoardView {
  const zoom = Math.max(Math.min(0.15, fitBoard(size, bounds).zoom), Math.min(2.5, view.zoom))
  const width = bounds.width * zoom
  const height = bounds.height * zoom
  return {
    zoom,
    x:
      width <= size.width - 32
        ? (size.width - width) / 2
        : Math.max(size.width - width - 40, Math.min(40, view.x)),
    y:
      height <= size.height - 120
        ? (size.height - height) / 2
        : Math.max(size.height - height - 60, Math.min(100, view.y))
  }
}

export function zoomBoardAt(
  view: BoardView,
  factor: number,
  point: { x: number; y: number }
): BoardView {
  const zoom = Math.max(0.02, Math.min(2.5, view.zoom * factor))
  const ratio = zoom / view.zoom
  return { zoom, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }
}

// Kept in memory for route navigation; never populated during server rendering.
export const boardSession: {
  view?: BoardView
  search?: { topic?: string; q?: string }
  key?: string
} = {}
