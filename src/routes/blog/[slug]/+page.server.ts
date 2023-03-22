import type { Load } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'
import contentful from 'contentful'
import type { Entry } from 'contentful'
import markdownit from 'markdown-it'
import { env } from '$env/dynamic/private'

const md = new markdownit()

export const load: Load = async function ({ params }) {
  try {
    const { slug } = params

    if (slug && env.CONTENTFUL_ACCESS_TOKEN) {
      const client = contentful.createClient({
        space: env.CONTENTFUL_SPACE,
        accessToken: env.CONTENTFUL_ACCESS_TOKEN
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blogEntry: Entry<any> = await client.getEntry(slug)

      const description: string = blogEntry.fields.markdown.substring(0, 120)

      blogEntry.fields.markdown = md.render(blogEntry.fields.markdown)

      const meta = {
        title: blogEntry.fields.text,
        description,
        img: `https://us-central1-tlazolteotnia.cloudfunctions.net/getThumbnail?text=${encodeURI(
          blogEntry.fields.text
        )}`,
        url: `https://0rga.org/blog/${slug}`,
        createdAt: blogEntry.sys.createdAt,
        updatedAt: blogEntry.sys.updatedAt
      }

      return {
        blogEntry,
        description,
        meta
      }
    }
    throw error(404, 'Not found')
  } catch (e) {
    throw error(404, 'Not found')
  }
}
