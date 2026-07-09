import { describe, expect, it } from 'vitest'
import { filterPostsByTag, getTagFilters } from '../app/lib/blog-tags'
import { getPostAccent } from '../app/lib/post-accent'
import {
  getPostAuthor,
  getPostEmoji,
  getPostIdentity,
  getPostSpecies
} from '../app/lib/post-identity'
import { shouldOpenPostModal } from '../app/lib/post-modal'
import {
  getAbsoluteUrl,
  getBlogPostOgImageUrl,
  getBlogPostUrl,
  getCopyrightYears
} from '../app/lib/site'

describe('blog utilities', () => {
  it('counts tags and sorts them by count and then name', () => {
    const posts = [
      { tags: ['Z', 'A'] },
      { tags: ['Z', 'A'] },
      { tags: ['Z', 'A'] },
      { tags: ['B'] },
      { tags: ['B'] },
      { tags: ['B'] }
    ]

    expect(getTagFilters(posts)).toEqual([
      { name: 'A', count: 3 },
      { name: 'B', count: 3 },
      { name: 'Z', count: 3 }
    ])
  })

  it('filters using the same All and tag rules on every post list', () => {
    const posts = [
      { slug: 'one', tags: ['React'] },
      { slug: 'two', tags: ['CSS'] }
    ]

    expect(filterPostsByTag(posts, '')).toBe(posts)
    const filteredPosts = filterPostsByTag(posts, 'React')
    expect(filteredPosts.map((post) => post.slug)).toEqual(['one'])
    expect(filteredPosts).toHaveLength(1)
  })

  it('derives deterministic visual identities from a slug', () => {
    expect([getPostAccent('same'), getPostEmoji('same'), getPostAuthor('same')]).toEqual([
      getPostAccent('same'),
      getPostEmoji('same'),
      getPostAuthor('same')
    ])
    expect(getPostAccent('same')).toMatch(/green|blue|pink|yellow|red/)
  })

  it('gives every published article its own animal identity', () => {
    const slugs = Object.keys(
      import.meta.glob<string>('../content/blog/*.md', {
        eager: true,
        query: '?raw',
        import: 'default'
      })
    ).map((path) => path.split('/').at(-1)?.replace(/\.md$/, '') ?? '')
    const identities = slugs.map(getPostIdentity)

    expect(new Set(identities.map(({ author }) => author))).toHaveLength(slugs.length)
    expect(new Set(identities.map(({ emoji }) => emoji))).toHaveLength(slugs.length)
    expect(new Set(identities.map(({ species }) => species))).toHaveLength(slugs.length)
    expect(identities.every(({ species }) => species !== 'なかま')).toBe(true)
    expect(getPostSpecies('react-router-renewal')).toBe('キツネ')
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
})
