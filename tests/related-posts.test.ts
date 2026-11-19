import { describe, expect, it } from 'vitest'
import type { BlogPostSummary } from '#/lib/blog-post'
import { getRelatedPosts } from '#/lib/related-posts'

function summary(slug: string, date: string, tags: string[]): BlogPostSummary {
  return { slug, date, tags, title: slug, description: slug }
}

describe('related posts', () => {
  const current = summary('current', '2026-08-01', ['React', 'CSS'])

  it('returns at most five other posts sharing any tag, newest first', () => {
    const posts = [
      summary('old', '2020-01-01', ['React']),
      current,
      summary('both', '2026-07-01', ['React', 'CSS']),
      summary('unrelated', '2026-11-01', ['Cloudflare']),
      summary('css', '2026-09-01', ['CSS']),
      summary('react', '2026-10-01', ['React']),
      summary('css-2', '2026-06-01', ['CSS']),
      summary('react-2', '2026-05-01', ['React'])
    ]
    const original = [...posts]

    expect(getRelatedPosts(current, posts).map((post) => post.slug)).toEqual([
      'react',
      'css',
      'both',
      'css-2',
      'react-2'
    ])
    expect(posts).toEqual(original)
  })

  it('returns fewer results when only a few match, and none without shared tags', () => {
    const match = summary('match', '2026-01-01', ['CSS'])
    expect(getRelatedPosts(current, [current, match])).toEqual([match])
    expect(getRelatedPosts(current, [current, summary('other', '2026-01-01', [])])).toEqual([])
    expect(getRelatedPosts({ ...current, tags: [] }, [match])).toEqual([])
  })
})
