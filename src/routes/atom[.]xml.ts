import { createFileRoute } from '@tanstack/react-router'
import { createBlogFeedResponse } from '#/lib/blog-feed.server'

export const Route = createFileRoute('/atom.xml')({
  server: { handlers: { GET: () => createBlogFeedResponse('atom') } }
})
