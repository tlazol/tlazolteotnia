import type { LayoutServerLoad } from './$types'
import { getMetaData } from '$lib/server/meta'
import { error } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

export const load: LayoutServerLoad = async function load({ locals, url }) {
  const metaData = getMetaData(url.pathname)
  const meta = metaData ? metaData[locals.lang] : null

  try {
    return {
      lang: locals.lang,
      meta,
      gtagId: env.GTAG_ID
    }
  } catch (e) {
    throw error(404, 'Not found')
  }
}
