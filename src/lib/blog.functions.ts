import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { loadHomeData, loadPostData } from '#/lib/blog-data.server'

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
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)
  )
}

function applyPrivateHeaders(cookie?: string) {
  setResponseHeader('Cache-Control', 'private, no-store')
  if (cookie) setResponseHeader('Set-Cookie', cookie)
}

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  // Keep the existing cache policy; home data no longer needs a visitor cookie.
  setResponseHeader('Cache-Control', 'private, no-store')
  return loadHomeData()
})

export const getPostData = createServerFn({ method: 'GET' })
  .validator(validateSlug)
  .handler(async ({ context, data }) => {
    const result = await loadPostData(context, getRequest(), data.slug)
    applyPrivateHeaders(result?.cookie)
    if (!result) return null
    return { post: result.post, reactions: result.reactions }
  })
