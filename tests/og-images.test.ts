import { readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { formatOgCheckError, renderOgPng, selectPosts } from '../scripts/generate-og-images'
import { type BlogPostRecord, parseBlogPost } from '../src/lib/blog-post'

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

  it('renders the same PNG bytes for the same input', async () => {
    const post = { ...published, title: '同じ入力なら同じステッカー' }
    const first = await renderOgPng(post)
    const second = await renderOgPng(post)

    expect(first.equals(second)).toBe(true)
    expect(first.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(first.readUInt32BE(16)).toBe(1200)
    expect(first.readUInt32BE(20)).toBe(630)
  }, 20_000)

  it('uses the article slug to choose its sticker design', async () => {
    const first = await renderOgPng(published)
    const second = await renderOgPng({ ...published, slug: 'another-article' })

    expect(first.equals(second)).toBe(false)
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
