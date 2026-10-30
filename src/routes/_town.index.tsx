import { createFileRoute } from '@tanstack/react-router'
import { authorName, siteName, siteOrigin } from '#/lib/site'

export const Route = createFileRoute('/_town/')({
  head: () => ({
    meta: [
      { title: `${siteName} | ${new URL(siteOrigin).host}` },
      { name: 'description', content: `Personal site and notes from ${authorName} / ${siteName}.` }
    ]
  }),
  // The town itself is rendered by the _town layout.
  component: () => null
})
