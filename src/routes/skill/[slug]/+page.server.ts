import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import { skills } from '$lib/server/skill'

export const load: PageServerLoad = async function ({ params }) {
  try {
    const { slug } = params

    if (slug && skills[slug]) {
      const data = skills[slug]

      return {
        id: slug,
        skill: data
      }
    }
    throw error(404, 'Not found')
  } catch (e) {
    throw error(404, 'Not found')
  }
}
