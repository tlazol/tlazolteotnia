import { BackLink } from '~/components/back-link'
import { MarkdownBody } from '~/components/markdown-body'
import { ProfileFooter } from '~/components/profile-footer'
import { TagList } from '~/components/tag-list'
import { getBlogPost } from '~/lib/blog.server'
import { getBlogPostOgImageUrl, getBlogPostUrl, siteName } from '~/lib/site'
import { headingResetClassName, siteShellClassName, terminalLabelClassName } from '~/lib/styles'
import type { Route } from './+types/blog.$slug'

export async function loader({ params }: Route.LoaderArgs) {
  const post = await getBlogPost(params.slug)

  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  return { post }
}

export function meta({ loaderData }: Route.MetaArgs) {
  const post = loaderData?.post
  const title = post ? `${post.title} | ${siteName}` : 'Post not found'
  const description = post?.description ?? `A note from ${siteName}.`
  const postUrl = post ? getBlogPostUrl(post.slug) : undefined
  const imageUrl = post ? getBlogPostOgImageUrl(post.slug) : undefined
  const imageAlt = post ? `${post.title} | ${siteName}` : undefined

  return [
    { title },
    {
      name: 'description',
      content: description
    },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'article' },
    ...(postUrl ? [{ property: 'og:url', content: postUrl }] : []),
    ...(imageUrl && imageAlt
      ? [
          { property: 'og:image', content: imageUrl },
          { property: 'og:image:type', content: 'image/png' },
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' },
          { property: 'og:image:alt', content: imageAlt }
        ]
      : []),
    { name: 'twitter:card', content: post ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...(imageUrl && imageAlt
      ? [
          { name: 'twitter:image', content: imageUrl },
          { name: 'twitter:image:alt', content: imageAlt }
        ]
      : [])
  ]
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData

  return (
    <main className={siteShellClassName}>
      <article className="pt-[26px]">
        <BackLink />

        <header className="relative border-b border-[var(--line)] pb-7 after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-px after:opacity-50 after:content-[''] after:[background:var(--spectrum)]">
          <p className={terminalLabelClassName}>cat content/blog/{post.slug}.md</p>
          <h1
            className={`${headingResetClassName} mt-16 mb-12 text-[clamp(2rem,12vw,4.8rem)] leading-none text-[var(--green-soft)] [overflow-wrap:anywhere]`}
          >
            {post.title}
          </h1>
          <div className="mt-[18px] grid gap-3 text-[0.82rem] font-bold text-[var(--yellow)]">
            <time dateTime={post.date}>{post.date}</time>
            <TagList tags={post.tags} />
          </div>
          <p className="mt-[18px] max-w-[680px] text-base leading-[1.7] text-[var(--muted)]">
            {post.description}
          </p>
        </header>

        <MarkdownBody body={post.body} />
      </article>

      <ProfileFooter showTopLink />
    </main>
  )
}
