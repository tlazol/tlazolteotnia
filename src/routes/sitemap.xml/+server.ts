import { error } from '@sveltejs/kit'
import contentful from 'contentful'
import type { EntryCollection } from 'contentful'
import { env } from '$env/dynamic/private'

export async function GET() {
  try {
    if (env.CONTENTFUL_ACCESS_TOKEN) {
      const client = contentful.createClient({
        space: env.CONTENTFUL_SPACE,
        accessToken: env.CONTENTFUL_ACCESS_TOKEN
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: EntryCollection<any> = await client.getEntries({
        order: ['-sys.createdAt'],
        content_type: 'blog'
      })

      const texts = []

      texts.push(`
        <?xml version="1.0" encoding="UTF-8" ?>
        <urlset
          xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
          xmlns:xhtml="https://www.w3.org/1999/xhtml"
        >
          <url>
            <loc>https://0rga.org/</loc>
            <lastmod>2023-04-13T00:58:30+00:00</lastmod>
            <priority>1.00</priority>
          </url>
          <url>
            <loc>https://0rga.org/skill</loc>
            <lastmod>2023-04-13T00:58:30+00:00</lastmod>
            <priority>0.80</priority>
          </url>
          <url>
            <loc>https://0rga.org/blog</loc>
            <lastmod>2023-04-13T00:58:30+00:00</lastmod>
            <priority>0.80</priority>
          </url>
          <url>
            <loc>https://0rga.org/skill/dwarf</loc>
            <lastmod>2023-04-13T00:58:30+00:00</lastmod>
            <priority>0.64</priority>
          </url>
          <url>
            <loc>https://0rga.org/skill/brave</loc>
            <lastmod>2023-04-13T00:58:30+00:00</lastmod>
            <priority>0.64</priority>
          </url>
          <url>
            <loc>https://0rga.org/skill/demon</loc>
            <lastmod>2023-04-13T00:58:30+00:00</lastmod>
            <priority>0.64</priority>
          </url>
          <url>
            <loc>https://0rga.org/skill/robo</loc>
            <lastmod>2023-04-13T00:58:30+00:00</lastmod>
            <priority>0.64</priority>
          </url>
      `)

      for (const item of list.items) {
        texts.push(`
          <url>
            <loc>https://0rga.org/blog/${item.sys.id}</loc>
            <lastmod>${item.sys.updatedAt}</lastmod>
            <priority>0.64</priority>
          </url>
        `)
      }

      texts.push(`</urlset>`)

      return new Response(texts.join('').trim(), {
        headers: {
          'Content-Type': 'application/xml'
        }
      })
    }
    throw error(404, 'Not found')
  } catch (e) {
    throw error(404, 'Not found')
  }
}
