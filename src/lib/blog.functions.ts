import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { loadHomeData, loadPostData } from '#/lib/blog-data.server'
import { isValidSlug } from '#/lib/blog-slug'

function validateSlug(input: unknown) {
  if (!isSlugInput(input)) throw new Error('Invalid slug')
  return { slug: input.slug }
}

function isSlugInput(input: unknown): input is { slug: string } {
  return (
    input !== null &&
    typeof input === 'object' &&
    'slug' in input &&
    typeof input.slug === 'string' &&
    isValidSlug(input.slug)
  )
}

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return loadHomeData()
})

export const getPostData = createServerFn({ method: 'GET' })
  .validator(validateSlug)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return loadPostData(data.slug)
  })
