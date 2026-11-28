import { getBlogFeedPosts } from '#/lib/blog.server'
import { getBlogPostModifiedDate } from '#/lib/blog-post'
import { getBlogPostUrl, siteOrigin } from '#/lib/site'

let document: string | undefined

export function createSitemapResponse() {
  document ??= buildSitemap()

  return new Response(document, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/xml; charset=utf-8'
    }
  })
}

function buildSitemap() {
  const posts = getBlogFeedPosts()
  const entries = posts.map((post) => ({
    loc: getBlogPostUrl(post.slug),
    lastmod: getBlogPostModifiedDate(post)
  }))
  // The home page lists every post, so it changes whenever any post does.
  const homeLastmod = entries
    .map((entry) => entry.lastmod)
    .sort()
    .at(-1)
  const urls = [{ loc: `${siteOrigin}/`, lastmod: homeLastmod }, ...entries]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      ({ loc, lastmod }) =>
        `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
    ),
    '</urlset>',
    ''
  ].join('\n')
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
