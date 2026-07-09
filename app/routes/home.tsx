import { HomeTimeline } from '~/components/home-timeline'
import { getBlogPosts } from '~/lib/blog.server'
import { getReactionCountsBySlug } from '~/lib/reactions.server'
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

export async function loader({ context }: Route.LoaderArgs) {
  const posts = await getBlogPosts()
  try {
    const slugs = posts.map((post) => post.slug)
    const reactionsBySlug = await getReactionCountsBySlug(context, slugs)
    return { posts, reactionsBySlug }
  } catch (error) {
    console.error('Failed to read home reactions', error)
    return { posts, reactionsBySlug: {} }
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts, reactionsBySlug } = loaderData

  return <HomeTimeline posts={posts} reactionsBySlug={reactionsBySlug} />
}
