import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'
import { skills } from '$lib/server/skill'

export const load: PageServerLoad = async function ({ params }) {
  const { slug } = params

  if (slug && skills[slug]) {
    throw redirect(301, `/skill/${slug}`)
  }
  throw error(404, 'Not found')
}
