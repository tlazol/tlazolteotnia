import { describe, expect, it } from 'vitest'
import { type BlogPostRecord, parseBlogPost } from '../app/lib/blog-post'
import { validateContent } from '../app/lib/content-validation'

describe('content validation', () => {
  it('accepts valid public links and existing images while ignoring code fences', () => {
    const post = makePost(
      'source',
      '[Target](/blog/target)\n\n![Image](/images/blog/image.png)\n\n```md\n[Missing](/blog/missing)\n```'
    )
    const target = makePost('target', 'Target body.')

    expect(
      validateContent({
        posts: [post, target],
        publicImagePaths: new Set(['/images/blog/image.png']),
        ogImageSlugs: new Set(['source', 'target'])
      })
    ).toEqual([])
  })

  it('reports missing and draft links without duplicate messages', () => {
    const source = makePost(
      'source',
      '[Missing](/blog/missing) [again](/blog/missing) [Draft](/blog/draft)'
    )
    const draft = makePost('draft', 'Draft body.', true)
    const issues = validateContent({
      posts: [source, draft],
      publicImagePaths: new Set(),
      ogImageSlugs: new Set(['source'])
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: '/blog/missing',
          message: expect.stringContaining('does not exist')
        }),
        expect.objectContaining({
          reference: '/blog/draft',
          message: expect.stringContaining('draft')
        })
      ])
    )
    expect(issues.filter((issue) => issue.reference === '/blog/missing')).toHaveLength(1)
  })

  it('reports missing local images, missing OG images, orphan OG images, and draft OG images', () => {
    const published = makePost('published', '![Missing](/images/blog/missing.png)')
    const draft = makePost('draft', 'Draft body.', true)
    const issues = validateContent({
      posts: [published, draft],
      publicImagePaths: new Set(),
      ogImageSlugs: new Set(['draft', 'orphan'])
    })

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'local image does not exist',
        'OG image is missing',
        'draft posts must not have OG images',
        'OG image has no published post'
      ])
    )
  })

  it('rejects unsafe external protocols without network access', () => {
    const post = makePost('source', '[unsafe](javascript:alert(1))')
    const issues = validateContent({
      posts: [post],
      publicImagePaths: new Set(),
      ogImageSlugs: new Set(['source'])
    })

    expect(issues[0]?.message).toContain('protocol is not allowed')
  })
})

function makePost(slug: string, body: string, draft = false): BlogPostRecord {
  return parseBlogPost(
    [
      '---',
      `title: "${slug}"`,
      'date: "2026-05-15"',
      'description: "Description"',
      'tags: []',
      `draft: ${draft}`,
      '---',
      body
    ].join('\n'),
    `content/blog/${slug}.md`
  )
}
