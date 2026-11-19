import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ArticleContent } from '#/components/article-content'
import { loadHomeData, loadPostData } from '#/lib/blog-data.server'

describe('public article data', () => {
  it('loads and renders an article without visitor state or a database', async () => {
    const result = await loadPostData('react-router-renewal')
    expect(result).not.toBeNull()
    expect(Object.keys(result ?? {})).toEqual(['post'])
    if (!result) throw new Error('Expected a published article')
    expect(result.post.slug).toBe('react-router-renewal')
    const html = renderToStaticMarkup(<ArticleContent post={result.post} />)
    expect(html).toContain(result.post.description)
    expect(html).not.toContain('読んだ気分を、絵文字でぽちっと。')
    expect(html).not.toContain('aria-label="リアクションを追加"')
  })

  it('returns null for an unknown article', async () => {
    expect(await loadPostData('missing-post')).toBeNull()
  })

  it('lists published articles without visitor state', async () => {
    const result = await loadHomeData()
    expect(Object.keys(result)).toEqual(['posts'])
    expect(result.posts.length).toBeGreaterThan(20)
    expect(result.posts.some((post) => post.slug === 'react-router-renewal')).toBe(true)
  })
})
