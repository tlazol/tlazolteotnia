import { type MouseEvent, useState } from 'react'
import {
  FaArrowRightLong,
  FaArrowUpRightFromSquare,
  FaHashtag,
  FaRegBookmark,
  FaThumbtack
} from 'react-icons/fa6'
import { Link, useFetcher } from 'react-router'
import { PostModal } from '~/components/post-modal'
import type { BlogPost, BlogPostSummary } from '~/lib/blog.server'
import { getTagFilters } from '~/lib/blog-tags'
import { getPostAuthor, getPostEmoji } from '~/lib/post-identity'

type HomeTimelineProps = {
  posts: BlogPostSummary[]
}

export function HomeTimeline({ posts }: HomeTimelineProps) {
  const tags = getTagFilters(posts)
  const postFetcher = useFetcher<{ post: BlogPost }>()
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedPost, setSelectedPost] = useState<BlogPostSummary | null>(null)
  const visiblePosts = selectedTag ? posts.filter((post) => post.tags.includes(selectedTag)) : posts
  const fetchedPost = postFetcher.data?.post
  const modalPost = fetchedPost && fetchedPost.slug === selectedPost?.slug ? fetchedPost : null

  function openPost(event: MouseEvent<HTMLAnchorElement>, post: BlogPostSummary) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    event.preventDefault()
    setSelectedPost(post)
    postFetcher.load(`/blog/${post.slug}`)
  }

  return (
    <div className="contents">
      <section
        className="min-w-0 border-x border-[var(--line)] bg-[rgba(2,8,5,0.7)]"
        aria-labelledby="timeline-title"
      >
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-[var(--line)] px-4 backdrop-blur-xl [background:rgba(2,8,5,0.82)] min-[680px]:px-5">
          <div>
            <p className="m-0 text-[1.08rem] leading-none font-bold text-[var(--text-strong)] [font-family:var(--font-ui)]">
              Home
            </p>
            <p className="mt-1.5 mb-0 text-[0.66rem] leading-none tracking-[0.12em] text-[var(--muted)] uppercase">
              {visiblePosts.length} posts / public log
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--green)] uppercase">
            <span className="signal-pulse size-2 rounded-full bg-[var(--green)] shadow-[0_0_14px_var(--green)]" />
            online
          </span>
        </header>

        <article className="relative border-b border-[var(--line)] px-4 py-5 min-[680px]:px-5">
          <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 min-[680px]:grid-cols-[52px_minmax(0,1fr)]">
            <ProfileAvatar />
            <div className="min-w-0">
              <p className="mt-0 mb-1.5 flex items-center gap-1.5 text-[0.68rem] font-semibold text-[var(--yellow)] [font-family:var(--font-ui)]">
                <FaThumbtack className="size-[0.72rem]" aria-hidden="true" />
                Pinned post
              </p>
              <p className="mt-0 mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 [font-family:var(--font-ui)]">
                <strong className="text-[0.96rem] text-[var(--text-strong)]">
                  Daisuke Kobayashi
                </strong>
                <span className="text-[0.8rem] text-[var(--muted)]">@0rga</span>
              </p>
              <h1
                id="timeline-title"
                className="m-0 text-[clamp(2rem,8vw,3.75rem)] leading-[0.95] font-bold tracking-[-0.055em] text-[var(--green-soft)] [font-family:var(--font-display)] [text-shadow:0_0_28px_rgba(49,255,128,0.2)]"
              >
                Tlazolteotnia
              </h1>
              <p className="mt-4 mb-0 max-w-[36rem] text-[0.98rem] leading-[1.65] text-[var(--text)] [font-family:var(--font-ui)]">
                Art, code, and experiments from the edge of the terminal. Notes are posted here,
                irregularly but deliberately.
              </p>
              <p className="mt-3 mb-0 text-[0.76rem] leading-[1.6] text-[var(--muted)]">
                CHΔ0S://9X_QR · SYS∴VANTA_404 · RX#NOISE
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                <a className={profileLinkClassName} href="https://www.artstation.com/orga">
                  ArtStation <FaArrowUpRightFromSquare aria-hidden="true" />
                </a>
                <a className={profileLinkClassName} href="https://twitter.com/0rga">
                  X / Twitter <FaArrowUpRightFromSquare aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </article>

        {tags.length > 0 && (
          <div className="no-scrollbar overflow-x-auto border-b border-[var(--line)] px-4 py-3 min-[1180px]:hidden">
            <div className="flex w-max gap-2">
              <TagFilter
                active={selectedTag === ''}
                count={posts.length}
                label="All"
                onClick={() => setSelectedTag('')}
              />
              {tags.map((tag) => (
                <TagFilter
                  active={selectedTag === tag.name}
                  count={tag.count}
                  key={tag.name}
                  label={tag.name}
                  onClick={() => setSelectedTag(tag.name)}
                />
              ))}
            </div>
          </div>
        )}

        {visiblePosts.length > 0 ? (
          <ol className="m-0 list-none p-0">
            {visiblePosts.map((post, index) => (
              <li
                className={postAccentClassNames[index % postAccentClassNames.length]}
                key={post.slug}
              >
                <Link
                  aria-haspopup="dialog"
                  className={postLinkClassName}
                  onClick={(event) => openPost(event, post)}
                  to={`/blog/${post.slug}`}
                >
                  <span
                    className="relative z-10 mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border text-[1.15rem] leading-none shadow-[0_0_20px_color-mix(in_srgb,var(--post-accent)_22%,transparent)] [background:color-mix(in_srgb,var(--post-accent)_10%,var(--panel))] [border-color:color-mix(in_srgb,var(--post-accent)_65%,var(--line))] min-[680px]:size-11 min-[680px]:text-[1.25rem]"
                    aria-hidden="true"
                  >
                    {getPostEmoji(post.slug)}
                  </span>

                  <div className="min-w-0 [font-family:var(--font-ui)]">
                    <div className="flex min-w-0 items-baseline gap-1.5 text-[0.82rem] leading-[1.35]">
                      <strong className="min-w-0 truncate text-[var(--text-strong)]">
                        {getPostAuthor(post.slug)}
                      </strong>
                      <span className="truncate text-[var(--muted)]">@0rga</span>
                      <span className="shrink-0 text-[var(--dim)]" aria-hidden="true">
                        ·
                      </span>
                      <time
                        className="shrink-0 font-sans text-[0.72rem] text-[var(--muted)]"
                        dateTime={post.date}
                      >
                        {post.date.replaceAll('-', '.')}
                      </time>
                    </div>

                    <h2 className="mt-2 mb-0 text-[clamp(1.02rem,3vw,1.18rem)] leading-[1.45] font-bold text-[var(--text-strong)] transition-colors group-hover:text-[var(--green-soft)]">
                      {post.title}
                    </h2>
                    <p className="mt-1.5 mb-0 text-[0.91rem] leading-[1.65] text-[var(--text)]">
                      {post.description}
                    </p>

                    {post.tags.length > 0 && (
                      <ul className="mt-3 mb-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
                        {post.tags.map((tag) => (
                          <li
                            className="flex items-center gap-1 text-[0.72rem] font-medium text-[color-mix(in_srgb,var(--post-accent)_76%,var(--muted))]"
                            key={tag}
                          >
                            <FaHashtag className="size-[0.68em]" aria-hidden="true" />
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}

                    <span className="mt-4 flex items-center justify-between border-t border-[color-mix(in_srgb,var(--post-accent)_16%,var(--line))] pt-3 text-[0.72rem] font-bold tracking-[0.04em] text-[var(--muted)] transition-colors group-hover:text-[var(--post-accent)]">
                      Read the post
                      <FaArrowRightLong
                        className="transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-5 py-16 text-center">
            <FaRegBookmark className="mx-auto mb-4 text-[var(--green)]" aria-hidden="true" />
            <p className="m-0 text-[var(--muted)] [font-family:var(--font-ui)]">
              No public posts tagged “{selectedTag}” found.
            </p>
          </div>
        )}

        <footer className="border-t border-[var(--line)] px-4 py-6 text-[0.65rem] leading-[1.7] text-[var(--dim)] min-[680px]:px-5 min-[1180px]:hidden">
          <p className="m-0">
            © 2026 Daisuke Kobayashi
            <br />
            Built somewhere between signal and noise.
          </p>
        </footer>
      </section>

      <aside className="hidden min-w-0 px-5 pt-6 min-[1180px]:block" aria-label="Explore posts">
        <div className="sticky top-6">
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[rgba(7,16,11,0.82)]">
            <div className="h-1 [background:var(--spectrum)]" />
            <div className="p-4">
              <h2 className="m-0 text-[1.2rem] font-bold tracking-[-0.03em] text-[var(--text-strong)] [font-family:var(--font-display)]">
                Explore channels
              </h2>
              <p className="mt-1.5 mb-4 text-[0.78rem] leading-[1.5] text-[var(--muted)] [font-family:var(--font-ui)]">
                Filter the feed by topic.
              </p>
              <div className="flex flex-col gap-1.5">
                <TagFilter
                  active={selectedTag === ''}
                  count={posts.length}
                  label="All posts"
                  onClick={() => setSelectedTag('')}
                  wide
                />
                {tags.map((tag) => (
                  <TagFilter
                    active={selectedTag === tag.name}
                    count={tag.count}
                    key={tag.name}
                    label={tag.name}
                    onClick={() => setSelectedTag(tag.name)}
                    wide
                  />
                ))}
              </div>
            </div>
          </section>
          <p className="mt-4 px-2 text-[0.65rem] leading-[1.7] text-[var(--dim)]">
            © 2026 Daisuke Kobayashi
            <br />
            Built somewhere between signal and noise.
          </p>
        </div>
      </aside>

      {selectedPost && (
        <PostModal onClose={() => setSelectedPost(null)} post={modalPost} summary={selectedPost} />
      )}
    </div>
  )
}

function ProfileAvatar() {
  return (
    <span
      className="relative flex size-11 items-center justify-center rounded-full border border-[rgba(156,255,191,0.54)] bg-[var(--panel-strong)] text-[0.78rem] font-bold tracking-[-0.08em] text-[var(--green-soft)] shadow-[0_0_28px_rgba(49,255,128,0.16)] before:absolute before:inset-[-4px] before:-z-10 before:rounded-full before:opacity-60 before:blur-[6px] before:content-[''] before:[background:var(--spectrum)] min-[680px]:size-12"
      aria-hidden="true"
    >
      0r
    </span>
  )
}

function TagFilter({
  active,
  count,
  label,
  onClick,
  wide = false
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
  wide?: boolean
}) {
  return (
    <button
      aria-pressed={active}
      className={`${tagFilterClassName} ${wide ? 'w-full justify-between rounded-xl' : ''} ${
        active
          ? 'border-[var(--green)] bg-[rgba(49,255,128,0.12)] text-[var(--green-soft)] shadow-[0_0_16px_rgba(49,255,128,0.08)]'
          : 'border-[var(--line)] text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--green)_50%,var(--line))] hover:bg-[rgba(49,255,128,0.04)] hover:text-[var(--text)]'
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <FaHashtag className="size-[0.7em] shrink-0 text-[var(--green)]" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-[0.65rem] text-[var(--dim)]">{count}</span>
    </button>
  )
}

const profileLinkClassName =
  'inline-flex items-center gap-1.5 text-[0.78rem] font-bold text-[var(--green-soft)] no-underline transition-colors [font-family:var(--font-ui)] hover:text-[var(--green)] [&_svg]:size-[0.72em]'

const postLinkClassName = [
  'group relative grid grid-cols-[40px_minmax(0,1fr)] gap-3 overflow-hidden border-b border-[var(--line)] px-4 py-5 text-inherit no-underline transition-[background-color] duration-200 min-[680px]:grid-cols-[44px_minmax(0,1fr)] min-[680px]:px-5 min-[680px]:py-6',
  "before:absolute before:top-[4.1rem] before:bottom-[-1px] before:left-[2.25rem] before:w-px before:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--post-accent)_52%,transparent),color-mix(in_srgb,var(--post-accent)_8%,transparent))] before:content-[''] min-[680px]:before:left-[2.6rem]",
  "after:absolute after:inset-y-0 after:left-0 after:w-0 after:bg-[var(--post-accent)] after:opacity-70 after:shadow-[0_0_20px_var(--post-accent)] after:transition-[width] after:content-['']",
  'hover:bg-[color-mix(in_srgb,var(--post-accent)_5%,transparent)] hover:after:w-0.5 focus-visible:bg-[color-mix(in_srgb,var(--post-accent)_5%,transparent)] focus-visible:after:w-0.5'
].join(' ')

const postAccentClassNames = [
  '[--post-accent:var(--green)]',
  '[--post-accent:var(--blue)]',
  '[--post-accent:var(--pink)]',
  '[--post-accent:var(--yellow)]',
  '[--post-accent:var(--red)]'
]

const tagFilterClassName =
  'inline-flex h-9 cursor-pointer items-center gap-3 rounded-full border bg-transparent px-3 text-[0.75rem] font-semibold transition-[border-color,background-color,color] [font-family:var(--font-ui)]'
