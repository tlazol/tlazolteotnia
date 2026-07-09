import { FaArrowLeftLong, FaFileLines, FaHashtag, FaWandMagicSparkles } from 'react-icons/fa6'
import { data, Link, useNavigate } from 'react-router'
import { CommunityLayout, type TopicChannel } from '~/components/community-layout'
import { MarkdownBody } from '~/components/markdown-body'
import { ReactionBar } from '~/components/reaction-bar'
import { getBlogPost, getBlogPosts } from '~/lib/blog.server'
import { getTagFilters } from '~/lib/blog-tags'
import { getPostAccent } from '~/lib/post-accent'
import { getPostAuthor, getPostEmoji } from '~/lib/post-identity'
import { getReactionTotal } from '~/lib/reactions'
import { appendVisitorCookie, getPostReactions } from '~/lib/reactions.server'
import {
  authorAccount,
  copyrightCurrentYear,
  getBlogPostOgImageUrl,
  getBlogPostUrl,
  getCopyrightText,
  siteName
} from '~/lib/site'
import type { Route } from './+types/blog.$slug'

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const [post, posts] = await Promise.all([getBlogPost(params.slug), getBlogPosts()])

  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  try {
    const result = await getPostReactions(context, request, post.slug)
    const headers = new Headers({ 'Cache-Control': 'private, no-store' })
    appendVisitorCookie(headers, result.cookie)
    return data({ post, posts, reactions: result.reactions }, { headers })
  } catch (error) {
    console.error('Failed to read post reactions', error)
    return { post, posts, reactions: [] }
  }
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
    { name: 'description', content: description },
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
  const { post, posts, reactions } = loaderData
  const accent = getPostAccent(post.slug)
  const navigate = useNavigate()
  const topics: TopicChannel[] = [
    {
      active: false,
      count: posts.length,
      label: 'all-signals',
      onSelect: () => navigate('/')
    },
    ...getTagFilters(posts).map((tag) => ({
      active: false,
      count: tag.count,
      label: tag.name,
      onSelect: () => navigate(`/?topic=${encodeURIComponent(tag.name)}`)
    }))
  ]

  return (
    <CommunityLayout
      activeSection="home"
      channelLabel={post.slug}
      channelMeta={post.title}
      rightSidebar={
        <PostDetails accent={accent} post={post} reactionTotal={getReactionTotal(reactions)} />
      }
      statusLabel="reading mode"
      topics={topics}
    >
      <div className="w-full" data-post-accent={accent}>
        <div className="border-b border-[var(--line)]">
          <div className="flex min-h-11 w-full max-w-[940px] items-center px-4 min-[680px]:px-6">
            <Link
              className="inline-flex items-center gap-2 text-[0.72rem] font-semibold text-[var(--muted)] no-underline transition-colors hover:text-[var(--post-accent-soft)] [font-family:var(--font-ui)]"
              to="/"
            >
              <FaArrowLeftLong className="text-[var(--post-accent)]" aria-hidden="true" />
              Back to all posts
            </Link>
          </div>
        </div>

        <article className="[font-family:var(--font-ui)]">
          <header className="relative overflow-hidden border-b border-[color-mix(in_srgb,var(--post-accent)_22%,var(--line))] bg-[linear-gradient(120deg,var(--post-accent-wash),transparent_58%)]">
            <div className="absolute top-0 right-0 h-56 w-56 rounded-full bg-[var(--post-accent-wash)] blur-3xl" />
            <div className="relative mx-auto w-full max-w-[768px] px-4 py-7 min-[680px]:px-6 min-[680px]:py-9">
              <div className="absolute top-7 left-4 z-10 min-[680px]:top-9 min-[1440px]:left-[-40px]">
                <span
                  className="animal-avatar relative flex size-11 items-center justify-center rounded-full border-2 border-[var(--post-accent)] text-[1.2rem] leading-none shadow-[0_0_26px_color-mix(in_srgb,var(--post-accent)_42%,transparent)] min-[680px]:size-12 min-[680px]:text-[1.3rem]"
                  aria-hidden="true"
                >
                  <span className="animal-avatar__emoji">{getPostEmoji(post.slug)}</span>
                  <span className="absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-[var(--chat)] bg-[var(--post-accent)] shadow-[0_0_12px_var(--post-accent)]" />
                </span>
              </div>

              <div className="relative min-w-0">
                <p className="m-0 flex min-h-11 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-14 text-[0.82rem] leading-[1.35] min-[1440px]:min-h-0 min-[1440px]:items-baseline min-[1440px]:pl-0">
                  <strong className="min-w-0 text-[var(--post-accent-soft)]">
                    {getPostAuthor(post.slug)}
                  </strong>
                  <span className="text-[var(--muted)]">@{authorAccount}</span>
                  <time className="text-[0.72rem] text-[var(--dim)]" dateTime={post.date}>
                    {post.date.replaceAll('-', '.')}
                  </time>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--post-accent)_13%,transparent)] px-1.5 py-0.5 text-[0.58rem] font-bold tracking-[0.05em] text-[var(--post-accent)] uppercase">
                    <FaWandMagicSparkles aria-hidden="true" /> featured
                  </span>
                </p>

                <h1 className="mt-4 mb-0 text-[clamp(1.8rem,7vw,3.35rem)] leading-[1.08] font-bold tracking-[-0.045em] text-[var(--post-accent-soft)] [overflow-wrap:anywhere] [font-family:var(--font-display)] [text-shadow:0_0_26px_var(--post-accent-glow)]">
                  {post.title}
                </h1>
                <p className="mt-4 mb-0 text-[0.95rem] leading-[1.75] text-[var(--text)]">
                  {post.description}
                </p>

                {post.tags.length > 0 && (
                  <ul className="mt-4 mb-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Tags">
                    {post.tags.map((tag) => (
                      <li
                        className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--post-accent)_28%,var(--line))] bg-[color-mix(in_srgb,var(--post-accent)_7%,transparent)] px-2 py-1 text-[0.7rem] font-semibold text-[var(--post-accent)]"
                        key={tag}
                      >
                        <FaHashtag className="size-[0.68em]" aria-hidden="true" />
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
                <ReactionBar reactions={reactions} slug={post.slug} />
              </div>
            </div>
          </header>

          <div className="mx-auto w-full max-w-[768px] px-4 min-[680px]:px-6">
            <div className="min-w-0">
              <MarkdownBody body={post.body} />
            </div>
          </div>
        </article>

        <footer className="mt-16 border-t border-[var(--line)] text-[0.65rem] leading-[1.7] text-[var(--dim)]">
          <div className="mx-auto w-full max-w-[940px] px-4 py-7 min-[680px]:px-6">
            {getCopyrightText(copyrightCurrentYear)} · Signal received in Tokyo / JST.
          </div>
        </footer>
      </div>
    </CommunityLayout>
  )
}

function PostDetails({
  accent,
  post,
  reactionTotal
}: {
  accent: ReturnType<typeof getPostAccent>
  post: Route.ComponentProps['loaderData']['post']
  reactionTotal: number
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--post-accent)_30%,var(--line))] bg-[rgba(7,16,11,0.82)]"
      data-post-accent={accent}
    >
      <div className="h-1 [background:var(--post-spectrum)]" />
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <FaFileLines className="text-[var(--post-accent)]" aria-hidden="true" />
          <h2 className="m-0 text-[1.2rem] font-bold tracking-[-0.03em] text-[var(--text-strong)] [font-family:var(--font-display)]">
            Post signal
          </h2>
        </div>

        <dl className="m-0 grid gap-3 text-[0.75rem] [font-family:var(--font-ui)]">
          <PostDetail label="Published" value={post.date} />
          <PostDetail label="Format" value="Markdown" />
          <PostDetail active label="Status" value="Public" />
          <PostDetail label="Reactions" value={String(reactionTotal)} />
        </dl>

        <p className="mt-5 mb-1.5 text-[0.66rem] font-bold tracking-[0.1em] text-[var(--dim)] uppercase">
          Current channel
        </p>
        <p className="m-0 break-all text-[0.68rem] leading-[1.6] text-[var(--post-accent-soft)]">
          # long-form / {post.slug}
        </p>
      </div>
    </section>
  )
}

function PostDetail({
  active = false,
  label,
  value
}: {
  active?: boolean
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2.5 last:border-0 last:pb-0">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd
        className={`m-0 font-semibold ${
          active
            ? 'inline-flex items-center gap-1.5 text-[var(--post-accent)]'
            : 'text-[var(--text)]'
        }`}
      >
        {active && (
          <span className="size-1.5 rounded-full bg-[var(--post-accent)] shadow-[0_0_8px_var(--post-accent)]" />
        )}
        {value}
      </dd>
    </div>
  )
}
