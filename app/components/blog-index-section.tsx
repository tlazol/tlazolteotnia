import { useState } from 'react'
import { FaHashtag, FaSatelliteDish, FaWandMagicSparkles } from 'react-icons/fa6'
import { Link } from 'react-router'
import { CommunityLayout, type TopicChannel } from '~/components/community-layout'
import type { BlogPostSummary } from '~/lib/blog-post'
import { filterPostsByTag, getTagFilters } from '~/lib/blog-tags'
import { getPostAccent } from '~/lib/post-accent'
import { getPostAuthor, getPostEmoji } from '~/lib/post-identity'
import { authorAccount } from '~/lib/site'

type BlogIndexSectionProps = {
  posts: BlogPostSummary[]
}

export function BlogIndexSection({ posts }: BlogIndexSectionProps) {
  const tags = getTagFilters(posts)
  const [selectedTag, setSelectedTag] = useState('')
  const visiblePosts = filterPostsByTag(posts, selectedTag)
  const topics: TopicChannel[] = [
    {
      active: selectedTag === '',
      count: posts.length,
      label: 'all-posts',
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
    <CommunityLayout
      activeSection="blog"
      channelLabel={selectedTag || 'all-posts'}
      channelMeta={`${visiblePosts.length} archived transmissions`}
      rightSidebar={<ArchiveDetails posts={posts} tagCount={tags.length} />}
      statusLabel="archive live"
      topics={topics}
    >
      <div className="w-full">
        <header className="relative overflow-hidden border-b border-[var(--line)]">
          <div className="absolute top-0 right-8 h-40 w-40 rounded-full bg-[rgba(45,172,249,0.11)] blur-3xl" />
          <div className="relative flex w-full max-w-[940px] items-start gap-4 px-4 py-8 min-[680px]:px-6 min-[680px]:py-10">
            <span className="server-orb relative hidden size-12 shrink-0 items-center justify-center rounded-2xl min-[520px]:flex">
              <span className="relative z-10 flex size-[42px] items-center justify-center rounded-[13px] bg-[var(--panel-strong)] text-[var(--cyan)]">
                <FaSatelliteDish aria-hidden="true" />
              </span>
            </span>
            <div>
              <p className="m-0 flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--pink)] uppercase">
                <FaWandMagicSparkles aria-hidden="true" />
                Transmission archive
              </p>
              <h1 className="mt-2 mb-0 text-[clamp(2rem,8vw,3.7rem)] leading-none font-bold tracking-[-0.05em] text-[var(--text-strong)] [font-family:var(--font-display)]">
                {selectedTag || 'All posts'}
              </h1>
              <p className="mt-3 mb-0 max-w-[36rem] text-[0.92rem] leading-[1.65] text-[var(--muted)]">
                Notes on frontend work, tools, art, games, experiments, and whatever else joins the
                signal.
              </p>
            </div>
          </div>
        </header>

        {visiblePosts.length > 0 ? (
          <ol className="message-stream m-0 list-none p-0">
            {visiblePosts.map((post) => (
              <li data-post-accent={getPostAccent(post.slug)} key={post.slug}>
                <Link
                  className="community-message group block border-b border-[var(--line)] text-inherit no-underline transition-colors hover:bg-[color-mix(in_srgb,var(--post-accent)_6%,transparent)]"
                  to={`/blog/${post.slug}`}
                >
                  <span className="grid w-full max-w-[940px] grid-cols-[40px_minmax(0,1fr)] gap-3 px-4 py-5 min-[680px]:grid-cols-[48px_minmax(0,1fr)] min-[680px]:gap-4 min-[680px]:px-6 min-[680px]:py-6">
                    <span className="relative z-10 flex size-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--post-accent)_70%,var(--line))] bg-[color-mix(in_srgb,var(--post-accent)_12%,var(--panel))] text-[1.15rem] shadow-[0_0_22px_color-mix(in_srgb,var(--post-accent)_26%,transparent)] transition-transform group-hover:-translate-y-0.5 group-hover:scale-105 min-[680px]:size-12 min-[680px]:text-[1.3rem]">
                      {getPostEmoji(post.slug)}
                      <span className="absolute -right-1 -bottom-1 size-2.5 rounded-full border-2 border-[var(--chat)] bg-[var(--post-accent)] shadow-[0_0_10px_var(--post-accent)]" />
                    </span>
                    <span className="min-w-0 [font-family:var(--font-ui)]">
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.82rem]">
                        <strong className="truncate text-[var(--post-accent-soft)]">
                          {getPostAuthor(post.slug)}
                        </strong>
                        <span className="text-[var(--muted)]">@{authorAccount}</span>
                        <time className="text-[0.7rem] text-[var(--dim)]" dateTime={post.date}>
                          {post.date.replaceAll('-', '.')}
                        </time>
                      </span>
                      <strong className="mt-2 block text-[clamp(1.02rem,3vw,1.2rem)] leading-[1.42] text-[var(--text-strong)] transition-colors group-hover:text-[var(--post-accent-soft)]">
                        {post.title}
                      </strong>
                      <span className="mt-1.5 block text-[0.91rem] leading-[1.68] text-[var(--text)]">
                        {post.description}
                      </span>
                      {post.tags.length > 0 && (
                        <span className="mt-3 flex flex-wrap gap-1.5">
                          {post.tags.map((tag) => (
                            <span
                              className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--post-accent)_26%,var(--line))] bg-[color-mix(in_srgb,var(--post-accent)_7%,transparent)] px-2 py-1 text-[0.68rem] font-semibold text-[color-mix(in_srgb,var(--post-accent)_78%,var(--text))]"
                              key={tag}
                            >
                              <FaHashtag className="size-[0.68em]" aria-hidden="true" />
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-5 py-20 text-center text-[var(--muted)]">
            No signals in this channel yet. Try another topic.
          </div>
        )}
      </div>
    </CommunityLayout>
  )
}

function ArchiveDetails({ posts, tagCount }: { posts: BlogPostSummary[]; tagCount: number }) {
  const newestPost = posts[0]
  const oldestPost = posts.at(-1)

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[rgba(7,16,11,0.78)]">
      <div className="h-1 [background:var(--spectrum)]" />
      <div className="p-4">
        <p className="m-0 text-[0.66rem] font-bold tracking-[0.08em] text-[var(--pink)] uppercase">
          Archive status
        </p>
        <h2 className="mt-2 mb-5 text-[1.25rem] font-bold tracking-[-0.03em] text-[var(--text-strong)] [font-family:var(--font-display)]">
          Signal library
        </h2>
        <dl className="m-0 grid gap-3 text-[0.74rem] [font-family:var(--font-ui)]">
          <ArchiveDetail label="Messages" value={String(posts.length)} />
          <ArchiveDetail label="Channels" value={String(tagCount)} />
          <ArchiveDetail label="Newest" value={newestPost?.date ?? '—'} />
          <ArchiveDetail label="First signal" value={oldestPost?.date ?? '—'} />
        </dl>
      </div>
    </section>
  )
}

function ArchiveDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2.5 last:border-0 last:pb-0">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="m-0 font-semibold text-[var(--cyan)]">{value}</dd>
    </div>
  )
}
