import type { Route } from './+types/blog'
import { BackLink } from '~/components/back-link'
import { BlogIndexSection } from '~/components/blog-index-section'
import { ProfileFooter } from '~/components/profile-footer'
import { getBlogPosts } from '~/lib/blog.server'
import { headingResetClassName, siteShellClassName } from '~/lib/styles'
import { siteName } from '~/lib/site'

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

  return (
    <main className={siteShellClassName}>
      <header className="border-b border-[var(--line)] pt-[26px] pb-8">
        <BackLink />
        <h1
          className={`${headingResetClassName} mt-14 text-[clamp(2.35rem,14vw,5.4rem)] leading-none text-[var(--green-soft)] [text-shadow:0_0_24px_rgba(49,255,128,0.22)]`}
        >
          Blog
        </h1>
        <p className="mt-5 max-w-[620px] text-base leading-[1.7] text-[var(--muted)]">
          Notes on frontend work, tools, experiments, and site updates.
        </p>
      </header>

      <BlogIndexSection posts={posts} />

      <ProfileFooter showTopLink />
    </main>
  )
}
