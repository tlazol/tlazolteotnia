import { createFileRoute } from '@tanstack/react-router'
import { createSitemapResponse } from '#/lib/sitemap.server'

export const Route = createFileRoute('/sitemap.xml')({
  server: { handlers: { GET: () => createSitemapResponse() } }
})
