import { createFileRoute } from '@tanstack/react-router'
import { getHomeHead } from '#/lib/seo'

export const Route = createFileRoute('/_town/')({
  head: getHomeHead,
  // The town itself is rendered by the _town layout.
  component: () => null
})
