import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { routeTree } from '#/routeTree.gen'

vi.mock('../src/app.css?url', () => ({ default: '/app.css' }))
vi.mock('../src/stickers.css?url', () => ({ default: '/stickers.css' }))

vi.mock('#/lib/blog.functions', () => {
  const post = {
    slug: 'sample',
    title: 'Sample article',
    description: 'Sample description',
    date: '2026-10-01',
    tags: ['CSS', 'React'],
    body: 'Article body'
  }
  // Deliberately unsorted, with single-tag matches and a newer unrelated article.
  const posts = [
    { ...post, slug: 'old', date: '2020-01-01' },
    post,
    { ...post, slug: 'related', title: 'Related article', date: '2026-09-01' },
    { ...post, slug: 'unrelated', date: '2026-11-01', tags: ['SQL'] },
    { ...post, slug: 'css-only', date: '2026-10-02', tags: ['CSS', 'HTML'] },
    { ...post, slug: 'react-only', date: '2026-10-03', tags: ['React'] },
    { ...post, slug: 'untagged', tags: [] },
    { ...post, slug: 'revised', tags: ['Revised'], updated: '2026-11-20' }
  ]
  return {
    getHomeData: async () => ({ posts }),
    getPostData: async ({ data }: { data: { slug: string } }) => {
      if (data.slug === 'broken') throw new Error('Failed to load post')
      const found = posts.find((candidate) => candidate.slug === data.slug)
      return found ? { post: found } : null
    }
  }
})

async function renderRoute(url: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] })
  })
  await router.load()
  return renderToString(<RouterProvider router={router} />)
}

describe('post modal routes', () => {
  it('renders loader errors in a closable modal even without an article summary', async () => {
    const html = await renderRoute('/blog/broken')
    expect(html).toContain('<dialog')
    expect(html).toContain('記事を読み込めませんでした。')
    expect(html).toContain('aria-label="記事を閉じる"')
  })

  it('renders the 404 page for missing articles', async () => {
    const html = await renderRoute('/blog/missing')
    expect(html).toContain('The requested page could not be found.')
  })

  it('renders the 404 page for malformed slugs', async () => {
    const html = await renderRoute('/blog/INVALID')
    expect(html).toContain('The requested page could not be found.')
  })

  it('renders the article on direct visits with non-navigable tags', async () => {
    const html = await renderRoute('/blog/sample')
    expect(html).toContain('<dialog')
    expect(html).toContain('Article body')
    expect(html.replaceAll('<!-- -->', '')).toContain('<li>#CSS</li>')
    expect(html).not.toContain('?topic=')
  })

  it('ignores old filter URLs and displays all articles without search controls', async () => {
    const html = await renderRoute('/?topic=missing&q=missing')
    expect(html).toContain('Sample article')
    expect(html).not.toContain('type="search"')
    expect(html).not.toContain('絞り込みを解除')
  })

  it('renders recommendations after the body as og-image links', async () => {
    const html = await renderRoute('/blog/sample')
    const article = html.slice(html.indexOf('<article>'), html.indexOf('</article>'))
    expect(article).toContain('あわせて読みたい')
    expect(article).toContain('href="/blog/related"')
    expect(article.indexOf('Article body')).toBeLessThan(article.indexOf('あわせて読みたい'))
    expect(article).not.toContain('href="/blog/sample"')
    expect([...article.matchAll(/href="\/blog\/([^"]+)"/g)].map((match) => match[1])).toEqual([
      'react-only',
      'css-only',
      'related',
      'old'
    ])
    expect(article).toContain('src="/images/og/related.png"')
    expect(article).toContain('alt="Related article"')
    // Only the og-image is shown; the title is exposed as alt text.
    expect(article).not.toContain('共通のタグ')
    expect(article).not.toContain('#HTML')
  })

  it.each(['unrelated', 'untagged'])(
    'hides recommendations for %s when no other published article shares a tag',
    async (slug) => {
      const html = await renderRoute(`/blog/${slug}`)
      expect(html).toContain('Article body')
      expect(html).not.toContain('あわせて読みたい')
    }
  )

  it('describes articles to search engines with canonical, article meta, and JSON-LD', async () => {
    const html = await renderRoute('/blog/revised')
    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toContain('<link rel="canonical" href="https://0rga.org/blog/revised"/>')
    expect(head).toContain('<meta property="og:site_name" content="Tlazolteotnia"/>')
    expect(head).toContain('<meta name="twitter:site" content="@0rga"/>')
    expect(head).toContain('<meta property="article:published_time" content="2026-10-01"/>')
    expect(head).toContain('<meta property="article:modified_time" content="2026-11-20"/>')
    expect(head).toContain('application/ld+json')

    const jsonLd = getJsonLd(head)
    expect(jsonLd).toMatchObject({
      '@type': 'BlogPosting',
      headline: 'Sample article',
      datePublished: '2026-10-01',
      dateModified: '2026-11-20',
      image: 'https://0rga.org/images/og/revised.png',
      keywords: ['Revised'],
      author: { '@type': 'Person', name: 'Daisuke Kobayashi' }
    })
    expect(html).toContain('dateTime="2026-11-20"')
  })

  it('falls back to the publish date when an article has not been revised', async () => {
    const html = await renderRoute('/blog/sample')
    expect(getJsonLd(html)).toMatchObject({ dateModified: '2026-10-01' })
    expect(html).not.toContain('更新')
  })

  it('describes the home page as a Japanese website with a canonical URL', async () => {
    const html = await renderRoute('/')
    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toContain('<link rel="canonical" href="https://0rga.org/"/>')
    expect(head).toMatch(/<meta name="description" content="[^"]*技術ブログ/)
    expect(getJsonLd(head)['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual([
      'WebSite',
      'Person'
    ])
  })
})

function getJsonLd(html: string) {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('JSON-LD is missing')
  return JSON.parse(
    match[1]
      .replaceAll('&quot;', '"')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
  )
}
