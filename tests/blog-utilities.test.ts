import { describe, expect, it } from 'vitest'
import { parseBlogPosts, sortBlogPostsNewestFirst } from '../src/lib/blog-post'
import { getPostAccent } from '../src/lib/post-accent'
import { shouldClosePostByHistoryBack, shouldOpenPostModal } from '../src/lib/post-modal'
import {
  getAbsoluteUrl,
  getBlogPostOgImageUrl,
  getBlogPostUrl,
  getCopyrightYears
} from '../src/lib/site'

describe('blog utilities', () => {
  it('derives a deterministic accent color from a slug', () => {
    expect(getPostAccent('same')).toBe(getPostAccent('same'))
    expect(getPostAccent('same')).toMatch(/green|blue|pink|yellow|red/)
  })

  it('does not repeat an accent color between consecutive visible articles', () => {
    const posts = getPublishedPosts()
    for (let index = 1; index < posts.length; index += 1) {
      expect(getPostAccent(posts[index].slug)).not.toBe(getPostAccent(posts[index - 1].slug))
    }
  })

  it('builds canonical absolute, post, and OG image URLs', () => {
    expect(getAbsoluteUrl('/about')).toBe('https://0rga.org/about')
    expect(getBlogPostUrl('hello world')).toBe('https://0rga.org/blog/hello%20world')
    expect(getBlogPostOgImageUrl('hello world')).toBe(
      'https://0rga.org/images/og/hello%20world.png'
    )
  })

  it('formats copyright years without reading the current clock', () => {
    expect(getCopyrightYears(2026)).toBe('2026')
    expect(getCopyrightYears(2028)).toBe('2026–2028')
  })

  it('opens previews only for unmodified primary-button clicks', () => {
    const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }

    expect(shouldOpenPostModal(click)).toBe(true)
    expect(shouldOpenPostModal({ ...click, button: 1 })).toBe(false)
    expect(shouldOpenPostModal({ ...click, metaKey: true })).toBe(false)
    expect(shouldOpenPostModal({ ...click, ctrlKey: true })).toBe(false)
    expect(shouldOpenPostModal({ ...click, shiftKey: true })).toBe(false)
    expect(shouldOpenPostModal({ ...click, altKey: true })).toBe(false)
  })

  it('closes posts by going back only when the town is the previous history entry', () => {
    expect(shouldClosePostByHistoryBack(3, 4)).toBe(true)
    // Opened by URL: there is no town entry to go back to.
    expect(shouldClosePostByHistoryBack(null, 0)).toBe(false)
    // Reached by going back from the town, which is now ahead in history.
    expect(shouldClosePostByHistoryBack(1, 0)).toBe(false)
    // Another post was opened from inside the modal.
    expect(shouldClosePostByHistoryBack(3, 5)).toBe(false)
  })
})

function getPublishedPosts() {
  const sources = import.meta.glob<string>('../content/blog/*.md', {
    eager: true,
    query: '?raw',
    import: 'default'
  })
  const posts = parseBlogPosts(Object.entries(sources).map(([path, source]) => ({ path, source })))

  return sortBlogPostsNewestFirst(posts.filter((post) => !post.draft))
}
