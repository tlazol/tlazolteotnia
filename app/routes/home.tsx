import { HomeTimeline } from '~/components/home-timeline'
import { SiteNavigation } from '~/components/site-navigation'
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

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-[1260px] grid-cols-1 min-[860px]:grid-cols-[220px_minmax(0,650px)] min-[1180px]:grid-cols-[220px_minmax(0,650px)_minmax(0,1fr)]">
      <SiteNavigation homeHref="#timeline-title" />

      <HomeTimeline posts={posts} />
    </main>
  )
}
