import { describe, expect, it } from 'vitest'
import { parseBlogPosts, sortBlogPostsNewestFirst } from '../src/lib/blog-post'
import {
  clampBoardView,
  filterStickerPosts,
  fitBoard,
  initialBoardView,
  layoutStickers,
  wrapStickerTitle,
  zoomBoardAt
} from '../src/lib/sticker-board'

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

  it('centers the newest article in the initial desktop and mobile viewport', () => {
    for (const selected of [posts, posts.slice(0, 2), posts.slice(0, 1)]) {
      const board = layoutStickers(selected)
      for (const size of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 }
      ]) {
        const view = initialBoardView(size, board)
        expect(view.x + board.stickers[0].x * view.zoom).toBeCloseTo(size.width / 2)
        expect(view.y + board.stickers[0].y * view.zoom).toBeCloseTo(size.height / 2)
      }
    }
  })

  it('combines tags and normalized search across title, description and tags', () => {
    const sample = [
      {
        slug: 'one',
        title: 'TypeScript 入門',
        description: '実践的な型の説明',
        tags: ['コード'],
        date: '2026-01-01'
      }
    ]
    expect(filterStickerPosts(sample, 'コード', 'ＴＹＰＥＳＣＲＩＰＴ 型')).toEqual(sample)
    expect(filterStickerPosts(sample, '', 'コード')).toEqual(sample)
    expect(filterStickerPosts(sample, '別のタグ', 'typescript')).toEqual([])
    expect(filterStickerPosts(sample, '', '存在しない')).toEqual([])
  })

  it('zooms around the cursor without moving its world position', () => {
    const view = { x: -120, y: 70, zoom: 0.8 }
    const cursor = { x: 500, y: 320 }
    const next = zoomBoardAt(view, 1.5, cursor)
    expect((cursor.x - next.x) / next.zoom).toBeCloseTo((cursor.x - view.x) / view.zoom)
    expect((cursor.y - next.y) / next.zoom).toBeCloseTo((cursor.y - view.y) / view.zoom)
  })

  it('fits all articles and bounds panning on desktop and mobile', () => {
    const board = layoutStickers(posts)
    for (const size of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 }
    ]) {
      const fit = fitBoard(size, board)
      expect(fit.x).toBeGreaterThanOrEqual(0)
      expect(fit.y).toBeGreaterThanOrEqual(80)
      expect(fit.x + board.width * fit.zoom).toBeLessThanOrEqual(size.width)
      expect(fit.y + board.height * fit.zoom).toBeLessThanOrEqual(size.height - 60)
      const initial = initialBoardView(size, board)
      const far = clampBoardView({ ...initial, x: -1e6, y: -1e6 }, size, board)
      expect(far.x + board.width * far.zoom).toBeGreaterThanOrEqual(size.width - 40)
      expect(far.y + board.height * far.zoom).toBeGreaterThanOrEqual(size.height - 60)
      expect(Object.values(fitBoard(size, layoutStickers([]))).every(Number.isFinite)).toBe(true)
    }
  })
})
