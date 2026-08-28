import { createFileRoute } from '@tanstack/react-router'
import { HomeTimeline } from '#/components/home-timeline'
import { getHomeData } from '#/lib/blog.functions'
import { authorName, siteName, siteOrigin } from '#/lib/site'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { topic?: string } => ({
    topic: typeof search.topic === 'string' && search.topic ? search.topic : undefined
  }),
  loader: () => getHomeData(),
  head: () => ({
    meta: [
      { title: `${siteName} | ${new URL(siteOrigin).host}` },
      { name: 'description', content: `Personal site and notes from ${authorName} / ${siteName}.` }
    ]
  }),
  component: Home
})

function Home() {
  const { posts, reactionsBySlug } = Route.useLoaderData()
  return <HomeTimeline posts={posts} reactionsBySlug={reactionsBySlug} />
}
