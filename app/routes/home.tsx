import { HomeTimeline } from '~/components/home-timeline'
import { getBlogPosts } from '~/lib/blog.server'
import type { ReactionCount } from '~/lib/reactions'
import { getReactionCountsBySlug } from '~/lib/reactions.server'
import { authorName, siteName, siteOrigin } from '~/lib/site'
import type { Route } from './+types/home'

let reactionCache: {
  expiresAt: number
  slugsKey: string
  value: Record<string, ReactionCount[]>
} | null = null

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
    const now = Date.now()
    const slugs = posts.map((post) => post.slug)
    const slugsKey = slugs.join('\0')
    let reactionsBySlug: Record<string, ReactionCount[]>
    if (reactionCache && reactionCache.expiresAt > now && reactionCache.slugsKey === slugsKey) {
      reactionsBySlug = reactionCache.value
    } else {
      reactionsBySlug = await getReactionCountsBySlug(context, slugs)
      reactionCache = { expiresAt: now + 45_000, slugsKey, value: reactionsBySlug }
    }
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
