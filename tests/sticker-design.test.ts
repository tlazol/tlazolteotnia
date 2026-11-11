import { describe, expect, it } from 'vitest'
import { parseBlogPosts, sortBlogPostsNewestFirst } from '../src/lib/blog-post'
import { hashSlug } from '../src/lib/scene-math'
import { createSticker, wrapStickerTitle } from '../src/lib/sticker-design'

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

describe('article sticker designs', () => {
  it('preserves the seeds used by existing sticker and resident designs', () => {
    expect(
      ['', 'react-router-renewal', 'jev-and-gpt-customer-support', '日本語'].map(hashSlug)
    ).toEqual([2166136261, 903066047, 2991010919, 1409693518])
  })

  it('creates deterministic article designs without losing title text', () => {
    for (const post of posts) {
      const sticker = createSticker(post)
      expect(sticker).toEqual(createSticker(post))
      expect(sticker.lines.join('')).toBe(post.title)
    }
  })

  it('uses all four eye counts', () => {
    const stickers = posts.map(createSticker)
    expect([...new Set(stickers.map((sticker) => sticker.eyeCount))].sort()).toEqual([1, 2, 3, 4])
  })

  it('uses all six shapes', () => {
    const stickers = posts.map(createSticker)
    expect(new Set(stickers.map((sticker) => sticker.shape))).toEqual(
      new Set(['die-cut', 'rounded', 'ticket', 'beveled', 'scalloped', 'ribbon'])
    )
  })

  it('keeps article designs compact', () => {
    for (const sticker of posts.map(createSticker)) {
      expect(sticker.width).toBeLessThanOrEqual(324)
      expect(sticker.height).toBeLessThan(
        144 + Math.max(0, sticker.lines.length - 1) * sticker.fontSize * 1.22
      )
    }
  })

  it('uses all four holographic materials', () => {
    const stickers = posts.map(createSticker)
    expect(new Set(stickers.map((sticker) => sticker.hologram))).toEqual(
      new Set(['prism', 'glitter', 'aurora', 'laser'])
    )
  })

  it('preserves long Japanese titles and avoids splitting ordinary English words', () => {
    const title = 'TypeScriptでChatGPTを使う方法について'
    const lines = wrapStickerTitle(title)
    expect(lines.join('')).toBe(title)
    expect(lines.some((line) => line.includes('TypeScript'))).toBe(true)
    expect(wrapStickerTitle('最近やってよかったこと').every((line) => line.length > 1)).toBe(true)
    expect(wrapStickerTitle('a'.repeat(200)).join('')).toBe('a'.repeat(200))
  })
})
