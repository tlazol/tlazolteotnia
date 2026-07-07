import { FaArrowLeftLong, FaFileLines, FaHashtag } from 'react-icons/fa6'
import { Link } from 'react-router'
import { MarkdownBody } from '~/components/markdown-body'
import { SiteNavigation } from '~/components/site-navigation'
import { getBlogPost } from '~/lib/blog.server'
import { getPostAccent } from '~/lib/post-accent'
import { getPostAuthor, getPostEmoji } from '~/lib/post-identity'
import {
  authorAccount,
  copyrightCurrentYear,
  getBlogPostOgImageUrl,
  getBlogPostUrl,
  getCopyrightText,
  siteName
} from '~/lib/site'
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
    <main
      className="mx-auto grid min-h-svh w-full max-w-[1260px] grid-cols-1 min-[860px]:grid-cols-[220px_minmax(0,650px)] min-[1180px]:grid-cols-[220px_minmax(0,650px)_minmax(0,1fr)]"
      data-post-accent={getPostAccent(post.slug)}
    >
      <SiteNavigation />

      <section className="min-w-0 border-x border-[var(--line)] bg-[rgba(2,8,5,0.7)]">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-[var(--line)] px-4 backdrop-blur-xl [background:rgba(2,8,5,0.82)] min-[680px]:px-5">
          <Link
            className="inline-flex items-center gap-3 text-[1.02rem] font-bold text-[var(--text-strong)] no-underline transition-colors [font-family:var(--font-ui)] hover:text-[var(--post-accent-soft)]"
            to="/"
          >
            <FaArrowLeftLong className="size-4 text-[var(--post-accent)]" aria-hidden="true" />
            Post
          </Link>
          <span className="inline-flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--post-accent)] uppercase">
            <span className="signal-pulse size-2 rounded-full bg-[var(--post-accent)] shadow-[0_0_14px_var(--post-accent)]" />
            public log
          </span>
        </header>

        <article className="[font-family:var(--font-ui)]">
          <header className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-3 overflow-hidden border-b border-[color-mix(in_srgb,var(--post-accent)_18%,var(--line))] bg-[linear-gradient(120deg,var(--post-accent-wash),transparent_55%)] px-4 py-6 after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:opacity-65 after:content-[''] after:[background:var(--post-spectrum)] min-[680px]:grid-cols-[48px_minmax(0,1fr)] min-[680px]:gap-4 min-[680px]:px-5 min-[680px]:py-8">
            <span
              className="relative z-10 flex size-11 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--post-accent)_65%,var(--line))] bg-[color-mix(in_srgb,var(--post-accent)_10%,var(--panel))] text-[1.2rem] leading-none shadow-[0_0_24px_var(--post-accent-glow)] min-[680px]:size-12 min-[680px]:text-[1.3rem]"
              aria-hidden="true"
            >
              {getPostEmoji(post.slug)}
            </span>

            <div className="min-w-0">
              <p className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.82rem] leading-[1.35]">
                <strong className="min-w-0 text-[var(--text-strong)]">
                  {getPostAuthor(post.slug)}
                </strong>
                <span className="text-[var(--muted)]">@{authorAccount}</span>
                <span className="text-[var(--dim)]" aria-hidden="true">
                  ·
                </span>
                <time className="text-[0.72rem] text-[var(--muted)]" dateTime={post.date}>
                  {post.date.replaceAll('-', '.')}
                </time>
              </p>

              <h1 className="mt-4 mb-0 text-[clamp(1.8rem,7vw,3.25rem)] leading-[1.08] font-bold tracking-[-0.045em] text-[var(--post-accent-soft)] [overflow-wrap:anywhere] [font-family:var(--font-display)] [text-shadow:0_0_26px_var(--post-accent-glow)]">
                {post.title}
              </h1>
              <p className="mt-4 mb-0 text-[0.95rem] leading-[1.75] text-[var(--text)]">
                {post.description}
              </p>

              {post.tags.length > 0 && (
                <ul
                  className="mt-4 mb-0 flex list-none flex-wrap gap-x-3 gap-y-1.5 p-0"
                  aria-label="Tags"
                >
                  {post.tags.map((tag) => (
                    <li
                      className="flex items-center gap-1 text-[0.74rem] font-semibold text-[var(--post-accent)]"
                      key={tag}
                    >
                      <FaHashtag className="size-[0.68em]" aria-hidden="true" />
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </header>

          <div className="px-4 min-[680px]:px-5">
            <MarkdownBody body={post.body} />
          </div>
        </article>

        <footer className="mt-16 border-t border-[var(--line)] px-4 py-7 text-[0.65rem] leading-[1.7] text-[var(--dim)] min-[680px]:px-5">
          <p className="m-0">
            {getCopyrightText(copyrightCurrentYear)}
            <br />
            Built somewhere between signal and noise.
          </p>
        </footer>
      </section>

      <aside className="hidden min-w-0 px-5 pt-6 min-[1180px]:block" aria-label="Post details">
        <div className="sticky top-6">
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[rgba(7,16,11,0.82)]">
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
                <PostDetail label="Status" value="Public" active />
              </dl>

              <p className="mt-5 mb-1.5 text-[0.66rem] font-bold tracking-[0.1em] text-[var(--dim)] uppercase">
                Source
              </p>
              <p className="m-0 break-all text-[0.68rem] leading-[1.6] text-[var(--muted)]">
                content/blog/{post.slug}.md
              </p>

              <Link
                className="mt-5 flex h-10 items-center justify-between rounded-xl border border-[var(--line)] px-3 text-[0.76rem] font-bold text-[var(--post-accent-soft)] no-underline transition-colors [font-family:var(--font-ui)] hover:border-[var(--post-accent)] hover:bg-[var(--post-accent-wash)]"
                to="/"
              >
                Back to timeline
                <FaArrowLeftLong aria-hidden="true" />
              </Link>
            </div>
          </section>
          <p className="mt-4 px-2 text-[0.65rem] leading-[1.7] text-[var(--dim)]">
            reader://{post.slug}
            <br />
            Signal received in Tokyo / JST.
          </p>
        </div>
      </aside>
    </main>
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
        className={`m-0 font-semibold ${active ? 'inline-flex items-center gap-1.5 text-[var(--post-accent)]' : 'text-[var(--text)]'}`}
      >
        {active && (
          <span className="size-1.5 rounded-full bg-[var(--post-accent)] shadow-[0_0_8px_var(--post-accent)]" />
        )}
        {value}
      </dd>
    </div>
  )
}
