import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import contentful from 'contentful'
import type { EntryCollection } from 'contentful'
import { env } from '$env/dynamic/private'

export const load: PageServerLoad = async function () {
  try {
    if (env.CONTENTFUL_ACCESS_TOKEN) {
      const client = contentful.createClient({
        space: env.CONTENTFUL_SPACE,
        accessToken: env.CONTENTFUL_ACCESS_TOKEN
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: EntryCollection<any> = await client.getEntries({
        content_type: 'blog'
      })

      return {
        list
      }
    }
    throw error(404, 'Not found')
  } catch (e) {
    throw error(404, 'Not found')
  }
}
