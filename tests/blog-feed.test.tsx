import { describe, expect, it } from 'vitest'
import { getBlogFeedPosts } from '../app/lib/blog.server'
import { createBlogFeedResponse } from '../app/lib/blog-feed.server'

describe('blog feeds', () => {
  it('publishes every post with summaries and full content as RSS', async () => {
    const posts = await getBlogFeedPosts()
    const response = await createBlogFeedResponse('rss')
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
    expect(xml.match(/<item>/g)).toHaveLength(posts.length)
    expect(xml).toContain(`<title><![CDATA[${posts[0].title}]]></title>`)
    expect(xml).toContain(`<description><![CDATA[${posts[0].description}]]></description>`)
    expect(xml).toContain('<content:encoded><![CDATA[')
    expect(xml).toContain('src="https://0rga.org/images/blog/')
    expect(xml).toContain('<atom:link href="https://0rga.org/rss.xml" rel="self"')
  })

  it('publishes every post with stable ids, summaries, and full content as Atom', async () => {
    const posts = await getBlogFeedPosts()
    const response = await createBlogFeedResponse('atom')
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/atom+xml; charset=utf-8')
    expect(xml.match(/<entry>/g)).toHaveLength(posts.length)
    expect(xml).toContain(`<id>https://0rga.org/blog/${posts[0].slug}</id>`)
    expect(xml).toContain(`<summary type="html"><![CDATA[${posts[0].description}]]></summary>`)
    expect(xml).toContain('<content type="html"><![CDATA[')
    expect(xml).toContain('<link rel="self" href="https://0rga.org/atom.xml"/>')
  })

  it('keeps all published posts in newest-first order', async () => {
    const posts = await getBlogFeedPosts()

    expect(posts.length).toBeGreaterThan(20)
    for (let index = 1; index < posts.length; index += 1) {
      expect(Date.parse(posts[index - 1].date)).toBeGreaterThanOrEqual(
        Date.parse(posts[index].date)
      )
    }
  })
})
