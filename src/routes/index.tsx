import { createFileRoute } from '@tanstack/react-router'
import { getHomeData } from '#/lib/blog.functions'
import { authorName, siteName, siteOrigin } from '#/lib/site'
import { ArticleTown } from '../components/article-town'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { topic?: string; q?: string } => ({
    topic: typeof search.topic === 'string' && search.topic ? search.topic : undefined,
    q: typeof search.q === 'string' && search.q ? search.q : undefined
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
  const { posts } = Route.useLoaderData()
  return <ArticleTown posts={posts} />
}
