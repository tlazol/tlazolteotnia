import { data } from 'react-router'
import { HomeTimeline } from '~/components/home-timeline'
import { getBlogPosts } from '~/lib/blog.server'
import type { ReactionCount } from '~/lib/reactions'
import { appendVisitorCookie, getReactionCountsBySlug } from '~/lib/reactions.server'
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

export async function loader({ context, request }: Route.LoaderArgs) {
  const posts = await getBlogPosts()
  try {
    const slugs = posts.map((post) => post.slug)
    const result = await getReactionCountsBySlug(context, request, slugs)
    const headers = new Headers({ 'Cache-Control': 'private, no-store' })
    appendVisitorCookie(headers, result.cookie)
    return data({ posts, reactionsBySlug: result.reactionsBySlug }, { headers })
  } catch (error) {
    console.error('Failed to read home reactions', error)
    const reactionsBySlug: Record<string, ReactionCount[]> = {}
    return data({ posts, reactionsBySlug }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts, reactionsBySlug } = loaderData

  return <HomeTimeline posts={posts} reactionsBySlug={reactionsBySlug} />
}
