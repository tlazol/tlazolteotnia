import { type MouseEvent, useState } from 'react'
import { FaArrowUpRightFromSquare, FaHashtag, FaRegBookmark, FaThumbtack } from 'react-icons/fa6'
import { Link, useFetcher } from 'react-router'
import { CommunityLayout, type TopicChannel } from '~/components/community-layout'
import { PostModal } from '~/components/post-modal'
import type { BlogPost, BlogPostSummary } from '~/lib/blog-post'
import { filterPostsByTag, getTagFilters } from '~/lib/blog-tags'
import { getPostAccent } from '~/lib/post-accent'
import { getPostAuthor, getPostEmoji } from '~/lib/post-identity'
import { shouldOpenPostModal } from '~/lib/post-modal'
import {
  artStationUrl,
  authorAccount,
  authorName,
  copyrightCurrentYear,
  getCopyrightText,
  siteName,
  xUrl
} from '~/lib/site'

type HomeTimelineProps = {
  posts: BlogPostSummary[]
}

export function HomeTimeline({ posts }: HomeTimelineProps) {
  const tags = getTagFilters(posts)
  const postFetcher = useFetcher<{ post: BlogPost }>()
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedPost, setSelectedPost] = useState<BlogPostSummary | null>(null)
  const visiblePosts = filterPostsByTag(posts, selectedTag)
  const fetchedPost = postFetcher.data?.post
  const modalPost = fetchedPost && fetchedPost.slug === selectedPost?.slug ? fetchedPost : null

  function openPost(event: MouseEvent<HTMLAnchorElement>, post: BlogPostSummary) {
    if (!shouldOpenPostModal(event)) {
      return
    }

    event.preventDefault()
    setSelectedPost(post)
    postFetcher.load(`/blog/${post.slug}`)
  }

  const topics: TopicChannel[] = [
    {
      active: selectedTag === '',
      count: posts.length,
      label: 'all-signals',
      onSelect: () => setSelectedTag('')
    },
    ...tags.map((tag) => ({
      active: selectedTag === tag.name,
      count: tag.count,
      label: tag.name,
      onSelect: () => setSelectedTag(tag.name)
    }))
  ]

  return (
    <>
      <CommunityLayout
        activeSection="home"
        channelLabel={selectedTag ? selectedTag : 'top'}
        channelMeta={
          selectedTag
            ? `${visiblePosts.length} transmissions tagged ${selectedTag}`
            : 'Art, code, experiments, and bright little signals.'
        }
        rightSidebar={<SignalMembers posts={posts} />}
        topics={topics}
      >
        <div className="w-full">
          <WelcomeMessage />
          <TimelinePosts
            onOpenPost={openPost}
            selectedTag={selectedTag}
            visiblePosts={visiblePosts}
          />
          <footer className="border-t border-[var(--line)] text-[0.65rem] leading-[1.7] text-[var(--dim)]">
            <div className="mx-auto w-full max-w-[940px] px-4 py-7 min-[680px]:px-6">
              {getCopyrightText(copyrightCurrentYear)} · Built somewhere between signal and noise.
            </div>
          </footer>
        </div>
      </CommunityLayout>

      {selectedPost && (
        <PostModal onClose={() => setSelectedPost(null)} post={modalPost} summary={selectedPost} />
      )}
    </>
  )
}

function WelcomeMessage() {
  return (
    <article className="relative overflow-hidden border-b border-[var(--line)]">
      <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-[rgba(250,115,218,0.1)] blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-32 w-56 rounded-full bg-[rgba(45,172,249,0.08)] blur-3xl" />
      <div className="relative grid w-full max-w-[940px] grid-cols-[44px_minmax(0,1fr)] gap-3 px-4 py-7 min-[680px]:grid-cols-[52px_minmax(0,1fr)] min-[680px]:gap-4 min-[680px]:px-6 min-[680px]:py-9">
        <span className="welcome-avatar relative flex size-11 items-center justify-center rounded-full border border-[rgba(156,255,191,0.58)] bg-[var(--panel-strong)] text-[0.76rem] font-bold tracking-[-0.08em] text-[var(--green-soft)] shadow-[0_0_28px_rgba(49,255,128,0.2)] min-[680px]:size-12">
          0r
          <span className="online-spectrum absolute right-[-2px] bottom-[-2px] size-3 rounded-full border-2 border-[var(--chat)]" />
        </span>
        <div className="min-w-0">
          <p className="mt-0 mb-1.5 flex items-center gap-1.5 text-[0.68rem] font-semibold text-[var(--yellow)] [font-family:var(--font-ui)]">
            <FaThumbtack className="size-[0.72rem]" aria-hidden="true" />
            Pinned welcome
          </p>
          <p className="mt-0 mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 [font-family:var(--font-ui)]">
            <strong className="text-[0.96rem] text-[var(--text-strong)]">{authorName}</strong>
            <span className="text-[0.8rem] text-[var(--muted)]">@{authorAccount}</span>
            <span className="rounded-md bg-[rgba(45,172,249,0.15)] px-1.5 py-0.5 text-[0.58rem] font-bold tracking-[0.06em] text-[var(--cyan)] uppercase">
              host
            </span>
          </p>
          <h1 className="spectrum-text m-0 text-[clamp(2rem,8vw,4rem)] leading-[0.95] font-bold tracking-[-0.055em] [font-family:var(--font-display)] [filter:drop-shadow(0_0_18px_rgba(49,255,128,0.18))]">
            {siteName}
          </h1>
          <p className="mt-4 mb-0 max-w-[38rem] text-[0.98rem] leading-[1.68] text-[var(--text)] [font-family:var(--font-ui)]">
            Art, code, and experiments from the edge of the terminal. Drop in, follow a channel, and
            see what is glowing today.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Reaction emoji="✨" label="hello" />
            <Reaction emoji="⚡" label="signal boost" />
            <Reaction emoji="🌈" label="stay weird" />
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <a className={profileLinkClassName} href={artStationUrl}>
              ArtStation <FaArrowUpRightFromSquare aria-hidden="true" />
            </a>
            <a className={profileLinkClassName} href={xUrl}>
              X / Twitter <FaArrowUpRightFromSquare aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

function TimelinePosts({
  visiblePosts,
  selectedTag,
  onOpenPost
}: {
  visiblePosts: BlogPostSummary[]
  selectedTag: string
  onOpenPost: (event: MouseEvent<HTMLAnchorElement>, post: BlogPostSummary) => void
}) {
  if (visiblePosts.length === 0) {
    return (
      <div className="px-5 py-20 text-center">
        <FaRegBookmark className="mx-auto mb-4 text-[var(--pink)]" aria-hidden="true" />
        <p className="m-0 text-[var(--muted)] [font-family:var(--font-ui)]">
          No signals tagged “{selectedTag}” yet. Try another channel.
        </p>
      </div>
    )
  }

  return (
    <ol className="message-stream m-0 list-none p-0">
      {visiblePosts.map((post) => (
        <li data-post-accent={getPostAccent(post.slug)} key={post.slug}>
          <Link
            aria-haspopup="dialog"
            className="community-message group block border-b border-[var(--line)] text-inherit no-underline transition-[background-color] duration-200 hover:bg-[color-mix(in_srgb,var(--post-accent)_6%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--post-accent)_6%,transparent)]"
            onClick={(event) => onOpenPost(event, post)}
            to={`/blog/${post.slug}`}
          >
            <div className="grid w-full max-w-[940px] grid-cols-[40px_minmax(0,1fr)] gap-3 px-4 py-5 min-[680px]:grid-cols-[48px_minmax(0,1fr)] min-[680px]:gap-4 min-[680px]:px-6 min-[680px]:py-6">
              <span
                className="relative z-10 mt-0.5 flex size-10 items-center justify-center rounded-full border text-[1.15rem] leading-none shadow-[0_0_22px_color-mix(in_srgb,var(--post-accent)_28%,transparent)] transition-[transform,box-shadow] group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:shadow-[0_0_30px_color-mix(in_srgb,var(--post-accent)_48%,transparent)] [background:color-mix(in_srgb,var(--post-accent)_12%,var(--panel))] [border-color:color-mix(in_srgb,var(--post-accent)_70%,var(--line))] min-[680px]:size-12 min-[680px]:text-[1.3rem]"
                aria-hidden="true"
              >
                {getPostEmoji(post.slug)}
                <span className="absolute -right-1 -bottom-1 size-2.5 rounded-full border-2 border-[var(--chat)] bg-[var(--post-accent)] shadow-[0_0_10px_var(--post-accent)]" />
              </span>

              <div className="min-w-0 [font-family:var(--font-ui)]">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.82rem] leading-[1.35]">
                  <strong className="min-w-0 truncate text-[var(--post-accent-soft)]">
                    {getPostAuthor(post.slug)}
                  </strong>
                  <span className="truncate text-[var(--muted)]">@{authorAccount}</span>
                  <time className="shrink-0 text-[0.7rem] text-[var(--dim)]" dateTime={post.date}>
                    {post.date.replaceAll('-', '.')}
                  </time>
                </div>

                <h2 className="mt-2 mb-0 text-[clamp(1.02rem,3vw,1.2rem)] leading-[1.42] font-bold text-[var(--text-strong)] transition-colors group-hover:text-[var(--post-accent-soft)]">
                  {post.title}
                </h2>
                <p className="mt-1.5 mb-0 text-[0.91rem] leading-[1.68] text-[var(--text)]">
                  {post.description}
                </p>

                {post.tags.length > 0 && (
                  <ul
                    className="mt-3 mb-0 flex list-none flex-wrap gap-1.5 p-0"
                    aria-label="Reactions"
                  >
                    {post.tags.map((tag) => (
                      <li
                        className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--post-accent)_26%,var(--line))] bg-[color-mix(in_srgb,var(--post-accent)_7%,transparent)] px-2 py-1 text-[0.68rem] font-semibold text-[color-mix(in_srgb,var(--post-accent)_78%,var(--text))] transition-colors group-hover:border-[color-mix(in_srgb,var(--post-accent)_48%,var(--line))]"
                        key={tag}
                      >
                        <FaHashtag className="size-[0.68em]" aria-hidden="true" />
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}

function SignalMembers({ posts }: { posts: BlogPostSummary[] }) {
  const memberPosts = posts.slice(0, 6)

  return (
    <section>
      <p className={detailLabelClassName}>Online signals — {memberPosts.length + 1}</p>
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-[rgba(49,255,128,0.045)] px-2 py-2 [font-family:var(--font-ui)]">
        <span className="relative flex size-9 items-center justify-center rounded-full border border-[var(--green)] bg-[var(--panel-strong)] text-[0.68rem] font-bold text-[var(--green-soft)]">
          0r
          <span className="online-spectrum absolute right-[-2px] bottom-[-2px] size-3 rounded-full border-2 border-[var(--sidebar)]" />
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-[0.78rem] text-[var(--green-soft)]">
            {authorName}
          </strong>
          <span className="block truncate text-[0.64rem] text-[var(--muted)]">
            hosting the signal
          </span>
        </span>
      </div>
      <div className="grid gap-1">
        {memberPosts.map((post) => (
          <div
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 [font-family:var(--font-ui)] hover:bg-[var(--hover)]"
            data-post-accent={getPostAccent(post.slug)}
            key={post.slug}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--post-accent)_56%,var(--line))] bg-[var(--panel)] text-[0.95rem] shadow-[0_0_14px_color-mix(in_srgb,var(--post-accent)_18%,transparent)]">
              {getPostEmoji(post.slug)}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[0.72rem] text-[var(--post-accent-soft)]">
                {getPostAuthor(post.slug)}
              </strong>
              <span className="block truncate text-[0.6rem] text-[var(--dim)]">transmitting</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-5 px-2 text-[0.62rem] leading-[1.7] text-[var(--dim)]">
        A playful relay of art, code, games, and experiments from Tokyo / JST.
      </p>
    </section>
  )
}

function Reaction({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[rgba(7,16,11,0.72)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--muted)] [font-family:var(--font-ui)]">
      <span aria-hidden="true">{emoji}</span>
      {label}
    </span>
  )
}

const profileLinkClassName =
  'inline-flex items-center gap-1.5 text-[0.78rem] font-bold text-[var(--green-soft)] no-underline transition-colors [font-family:var(--font-ui)] hover:text-[var(--cyan)] [&_svg]:size-[0.72em]'

const detailLabelClassName =
  'm-0 px-2 pb-2 text-[0.66rem] font-bold tracking-[0.04em] text-[var(--dim)] uppercase [font-family:var(--font-ui)]'
