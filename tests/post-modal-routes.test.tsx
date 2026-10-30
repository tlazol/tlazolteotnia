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
    tags: ['CSS'],
    body: 'Article body'
  }
  return {
    getHomeData: async () => ({ posts: [post] }),
    getPostData: async ({ data }: { data: { slug: string } }) => {
      if (data.slug === 'broken') throw new Error('Failed to load post')
      return data.slug === post.slug ? { post, reactions: [] } : null
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
})
