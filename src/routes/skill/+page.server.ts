import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import { skills } from '$lib/server/skill'

export const load: PageServerLoad = function load() {
  try {
    return {
      skills: Object.entries(skills)
    }
  } catch (e) {
    throw error(404, 'Not found')
  }
}
