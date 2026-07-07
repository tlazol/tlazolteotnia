import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { type BlogPostRecord, parseBlogPost } from '../app/lib/blog-post'
import {
  formatOgCheckError,
  getTitleFontSize,
  renderOgPng,
  selectPosts
} from '../scripts/generate-og-images'

describe('OG image generation', () => {
  const published = makePost('published')
  const draft = makePost('draft', true)

  it('selects all public posts or one requested public slug', () => {
    expect(selectPosts([published, draft]).map((post) => post.slug)).toEqual(['published'])
    expect(selectPosts([published, draft], 'published').map((post) => post.slug)).toEqual([
      'published'
    ])
  })

  it('rejects missing and draft requested slugs', () => {
    expect(() => selectPosts([published, draft], 'missing')).toThrow('Post not found: missing')
    expect(() => selectPosts([published, draft], 'draft')).toThrow('Post is a draft: draft')
  })

  it.each([
    [26, 70],
    [27, 60],
    [42, 60],
    [43, 50],
    [60, 50],
    [61, 44]
  ])('uses the expected title size at %i characters', (length, size) => {
    expect(getTitleFontSize('a'.repeat(length))).toBe(size)
  })

  it('renders the same PNG bytes for the same input', async () => {
    const font = await readFile('scripts/assets/NotoSansCJKjp-Bold.otf')
    const first = await renderOgPng('Deterministic title', '2026-05-15', font)
    const second = await renderOgPng('Deterministic title', '2026-05-15', font)

    expect(first.equals(second)).toBe(true)
  }, 20_000)

  it('names changed slugs and the regeneration command in check errors', () => {
    const message = formatOgCheckError([
      'example-slug: generated image differs from public/images/og/example-slug.png'
    ])

    expect(message).toContain('example-slug')
    expect(message).toContain('npm run og')
  })

  it('has one tracked image for every current published slug', async () => {
    const contentSlugs = (await readdir('content/blog'))
      .filter((filename) => filename.endsWith('.md'))
      .map((filename) => filename.slice(0, -3))
      .sort()
    const imageSlugs = (await readdir('public/images/og'))
      .filter((filename) => filename.endsWith('.png'))
      .map((filename) => filename.slice(0, -4))
      .sort()

    expect(imageSlugs).toEqual(contentSlugs)
  })
})

function makePost(slug: string, draft = false): BlogPostRecord {
  return parseBlogPost(
    [
      '---',
      `title: "${slug}"`,
      'date: "2026-05-15"',
      'description: "Description"',
      'tags: []',
      `draft: ${draft}`,
      '---',
      'Body'
    ].join('\n'),
    `content/blog/${slug}.md`
  )
}
