import { describe, expect, it } from 'vitest'
import { getBlogFeedPosts } from '../src/lib/blog.server'
import { getBlogPostModifiedDate } from '../src/lib/blog-post'
import { createSitemapResponse } from '../src/lib/sitemap.server'

describe('sitemap', () => {
  it('lists the home page and every published post with its last significant change', async () => {
    const posts = getBlogFeedPosts()
    const response = createSitemapResponse()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.match(/<url>/g)).toHaveLength(posts.length + 1)
    expect(xml).toContain('<loc>https://0rga.org/</loc>')
    for (const post of posts) {
      expect(xml).toContain(
        `<url><loc>https://0rga.org/blog/${post.slug}</loc><lastmod>${getBlogPostModifiedDate(post)}</lastmod></url>`
      )
    }
    expect(xml).not.toContain('<priority>')
    expect(xml).not.toContain('<changefreq>')
  })
})
