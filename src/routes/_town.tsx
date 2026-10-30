import { createFileRoute } from '@tanstack/react-router'
import { ArticleTown } from '#/components/article-town'
import { getHomeData } from '#/lib/blog.functions'

// Pathless layout: the town stays mounted while posts open over it at /blog/$slug.
export const Route = createFileRoute('/_town')({
  loader: () => getHomeData(),
  component: TownLayout
})

function TownLayout() {
  const { posts } = Route.useLoaderData()
  return <ArticleTown posts={posts} />
}
