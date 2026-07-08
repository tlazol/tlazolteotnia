import { HomeTimeline } from '~/components/home-timeline'
import { getBlogPosts } from '~/lib/blog.server'
import { authorName, siteName, siteOrigin } from '~/lib/site'
import type { Route } from './+types/home'

export function meta() {
  return [
    { title: `${siteName} | ${new URL(siteOrigin).host}` },
    {
      name: 'description',
      content: `Personal site and notes from ${authorName} / ${siteName}.`
    }
  ]
}

export async function loader() {
  const posts = await getBlogPosts()

  return { posts }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData

  return <HomeTimeline posts={posts} />
}
