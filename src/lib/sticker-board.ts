import type { BlogPostSummary } from './blog-post'

export type BoardView = { x: number; y: number; zoom: number }
export type BoardSize = { width: number; height: number }
export type Sticker = {
  post: BlogPostSummary
  x: number
  y: number
  width: number
  height: number
  angle: number
  seed: number
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
  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(posts.length))))
  const bottoms = Array.from({ length: columns }, (_, index) => (index % 2) * 70)
  const stickers = posts.map((post): Sticker => {
    const seed = hashSlug(post.slug)
    const column = bottoms.indexOf(Math.min(...bottoms))
    const width = 320 + (seed % 3) * 18
    const lines = wrapStickerTitle(post.title, 9 + (seed % 2))
    const fontSize = lines.length > 5 ? 27 : 31
    const height = 108 + lines.length * fontSize * 1.18
    const x = column * 390 + 195 + ((seed % 17) - 8)
    const y = bottoms[column] + height / 2 + 34
    bottoms[column] += height + 58
    const maxAngle = Math.min((9 * Math.PI) / 180, Math.asin(Math.min(1, (370 - width) / height)))
    return {
      post,
      x,
      y,
      width,
      height,
      angle: (((seed % 19) - 9) / 9) * maxAngle,
      seed,
      lines,
      fontSize
    }
  })
  return { stickers, width: columns * 390, height: Math.max(0, ...bottoms) + 24 }
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
  const zoom = size.width < 600 ? 0.82 : 0.95
  return clampBoardView({ x: 16, y: 100, zoom }, size, bounds)
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
      height <= size.height - 150
        ? 84 + (size.height - 150 - height) / 2
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
