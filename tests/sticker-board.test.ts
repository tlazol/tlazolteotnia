import { describe, expect, it } from 'vitest'
import { parseBlogPosts, sortBlogPostsNewestFirst } from '../src/lib/blog-post'
import { hashSlug } from '../src/lib/scene-math'
import { layoutStickers, wrapStickerTitle } from '../src/lib/sticker-board'

const sources = import.meta.glob<string>('../content/blog/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
})
const posts = sortBlogPostsNewestFirst(
  parseBlogPosts(Object.entries(sources).map(([path, source]) => ({ path, source }))).filter(
    (post) => !post.draft
  )
)

describe('sticker board', () => {
  it('preserves the seeds used by existing sticker and resident designs', () => {
    expect(
      ['', 'react-router-renewal', 'jev-and-gpt-customer-support', '日本語'].map(hashSlug)
    ).toEqual([2166136261, 903066047, 2991010919, 1409693518])
  })

  it('lays out every published article deterministically inside the board', () => {
    const board = layoutStickers(posts)
    expect(board).toEqual(layoutStickers(posts))
    expect(new Set(board.stickers.map((item) => item.post.slug)).size).toBe(posts.length)
    for (const item of board.stickers) {
      const width =
        Math.abs(Math.cos(item.angle)) * item.width + Math.abs(Math.sin(item.angle)) * item.height
      const height =
        Math.abs(Math.cos(item.angle)) * item.height + Math.abs(Math.sin(item.angle)) * item.width
      expect(item.x - width / 2).toBeGreaterThanOrEqual(0)
      expect(item.y - height / 2).toBeGreaterThanOrEqual(0)
      expect(item.x + width / 2).toBeLessThanOrEqual(board.width)
      expect(item.y + height / 2).toBeLessThanOrEqual(board.height)
      expect(item.lines.join('')).toBe(item.post.title)
    }
  })

  it('uses all four eye counts and keeps them consistent on the board and article pages', () => {
    const board = layoutStickers(posts)
    expect([...new Set(board.stickers.map((sticker) => sticker.eyeCount))].sort()).toEqual([
      1, 2, 3, 4
    ])
    for (const sticker of board.stickers) {
      const article = layoutStickers([sticker.post]).stickers[0]
      expect(article.eyeCount).toBe(sticker.eyeCount)
    }
  })

  it('uses six compact shapes consistently across filtering and article pages', () => {
    const board = layoutStickers(posts)
    expect(new Set(board.stickers.map((sticker) => sticker.shape))).toEqual(
      new Set(['die-cut', 'rounded', 'ticket', 'beveled', 'scalloped', 'ribbon'])
    )
    for (const sticker of board.stickers) {
      const article = layoutStickers([sticker.post]).stickers[0]
      expect(article.shape).toBe(sticker.shape)
      expect(article.width).toBe(sticker.width)
      expect(article.height).toBe(sticker.height)
      expect(sticker.width).toBeLessThanOrEqual(324)
      expect(sticker.height).toBeLessThan(
        144 + Math.max(0, sticker.lines.length - 1) * sticker.fontSize * 1.22
      )
    }
  })

  it('keeps all four holographic materials consistent across filtering and article pages', () => {
    const board = layoutStickers(posts)
    expect(new Set(board.stickers.map((sticker) => sticker.hologram))).toEqual(
      new Set(['prism', 'glitter', 'aurora', 'laser'])
    )
    for (const sticker of board.stickers) {
      expect(layoutStickers([sticker.post]).stickers[0].hologram).toBe(sticker.hologram)
    }
  })

  it('preserves long Japanese titles and avoids splitting ordinary English words', () => {
    const title = 'TypeScriptでChatGPTを使う方法について'
    const lines = wrapStickerTitle(title)
    expect(lines.join('')).toBe(title)
    expect(lines.some((line) => line.includes('TypeScript'))).toBe(true)
    expect(wrapStickerTitle('最近やってよかったこと').every((line) => line.length > 1)).toBe(true)
    expect(wrapStickerTitle('a'.repeat(200)).join('')).toBe('a'.repeat(200))
  })

  it('places the newest article in the center and older articles clockwise without overlaps', () => {
    const reversed = [...posts].reverse()
    const board = layoutStickers(reversed)
    expect(reversed).toEqual([...posts].reverse())
    expect(board.stickers.map((item) => item.post.date)).toEqual(posts.map((post) => post.date))
    const [newest, ...older] = board.stickers
    expect(newest.x).toBe(board.width / 2)
    expect(newest.y).toBe(board.height / 2)
    expect(older[0].x).toBe(newest.x)
    expect(older[0].y).toBeLessThan(newest.y)
    for (let index = 1; index < older.length; index++) {
      const a = older[index - 1]
      const b = older[index]
      const cross = (a.x - newest.x) * (b.y - newest.y) - (a.y - newest.y) * (b.x - newest.x)
      expect(cross).toBeGreaterThan(0)
      expect(Math.hypot(b.x - newest.x, b.y - newest.y)).toBeGreaterThan(0)
    }
    const rectangles = board.stickers.map((item) => ({
      x: item.x,
      y: item.y,
      width:
        Math.abs(Math.cos(item.angle)) * item.width + Math.abs(Math.sin(item.angle)) * item.height,
      height:
        Math.abs(Math.cos(item.angle)) * item.height + Math.abs(Math.sin(item.angle)) * item.width
    }))
    rectangles.forEach((a, index) => {
      for (const b of rectangles.slice(index + 1)) {
        expect(
          Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
            Math.abs(a.y - b.y) >= (a.height + b.height) / 2
        ).toBe(true)
      }
    })
  })
})
