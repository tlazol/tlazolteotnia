import type { BlogPostSummary } from './blog-post'
import { hashSlug } from './scene-math'

const stickerShapes = ['die-cut', 'rounded', 'ticket', 'beveled', 'scalloped', 'ribbon'] as const
// Canvas space added to the sticker's width and height; the renderer's zoom assumes it.
export const stickerPadding = 48
export const hologramFinishes = ['prism', 'glitter', 'aurora', 'laser'] as const
export type Sticker = {
  post: BlogPostSummary
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

export function createSticker(post: BlogPostSummary): Sticker {
  const seed = hashSlug(post.slug)
  const width = 288 + (seed % 3) * 18
  const lines = wrapStickerTitle(post.title, 9 + (seed % 2))
  const fontSize = lines.length > 5 ? 27 : 31
  const height = 128 + Math.max(0, lines.length - 1) * fontSize * 1.22
  const maxAngle = Math.min((9 * Math.PI) / 180, Math.asin(Math.min(1, (370 - width) / height)))
  return {
    post,
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
}
