import { BlogIndexSection } from '~/components/blog-index-section'
import { getBlogPosts } from '~/lib/blog.server'
import { siteName } from '~/lib/site'
import type { Route } from './+types/blog'

export function meta() {
  return [
    { title: `Blog | ${siteName}` },
    {
      name: 'description',
      content: `Notes and blog posts from ${siteName}.`
    }
  ]
}

export async function loader() {
  const posts = await getBlogPosts()

  return { posts }
}

export default function Blog({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData

  return <BlogIndexSection posts={posts} />
}
