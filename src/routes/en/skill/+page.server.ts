import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from '../$types'

export const load: PageServerLoad = function load() {
  throw redirect(301, '/skill')
}
