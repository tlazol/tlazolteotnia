import { useState } from 'react'
import { Link } from 'react-router'
import { FaHashtag } from 'react-icons/fa6'
import type { BlogPostSummary } from '~/lib/blog.server'
import { tagPillClassName, terminalLabelClassName } from '~/lib/styles'

type BlogIndexSectionProps = {
  posts: BlogPostSummary[]
}

export function BlogIndexSection({ posts }: BlogIndexSectionProps) {
  const tags = getTagFilters(posts)
  const [selectedTag, setSelectedTag] = useState('')
  const visiblePosts = selectedTag ? posts.filter((post) => post.tags.includes(selectedTag)) : posts

  return (
    <section className="py-11">
      <p className={terminalLabelClassName}>ls content/blog</p>

      {tags.length > 0 && (
        <fieldset className="m-0 mb-6 flex min-w-0 flex-wrap gap-2 border-0 border-b border-dashed border-[var(--line)] p-0 pb-5">
          <legend className="sr-only">Filter posts by tag</legend>
          <button
            aria-pressed={selectedTag === ''}
            className={getTagFilterClassName(selectedTag === '')}
            onClick={() => setSelectedTag('')}
            type="button"
          >
            All
            <span className={tagCountClassName}>{posts.length}</span>
          </button>
          {tags.map((tag) => (
            <button
              aria-pressed={selectedTag === tag.name}
              className={getTagFilterClassName(selectedTag === tag.name)}
              key={tag.name}
              onClick={() => setSelectedTag(tag.name)}
              type="button"
            >
              <FaHashtag aria-hidden="true" />
              {tag.name}
              <span className={tagCountClassName}>{tag.count}</span>
            </button>
          ))}
        </fieldset>
      )}

      {visiblePosts.length > 0 ? (
        <ol className="m-0 grid list-none gap-3.5 p-0">
          {visiblePosts.map((post, index) => (
            <li key={post.slug}>
              <Link
                className={`${postCardClassName} ${
                  postAccentClassNames[index % postAccentClassNames.length]
                }`}
                to={`/blog/${post.slug}`}
              >
                <span className="text-[0.82rem] font-bold text-[color-mix(in_srgb,var(--card-accent)_76%,var(--yellow))]">
                  {formatDate(post.date)}
                </span>
                <div className="grid gap-2">
                  <span className="text-[1.08rem] leading-[1.35] font-bold text-[var(--green-soft)] underline decoration-[rgba(156,255,191,0.42)] decoration-dashed decoration-1 underline-offset-[0.24em]">
                    {post.title}
                  </span>
                  <span className="text-[0.94rem] leading-[1.65] text-[var(--muted)]">
                    {post.description}
                  </span>
                  {post.tags.length > 0 && (
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Tags">
                      {post.tags.map((tag) => (
                        <li className={tagPillClassName} key={tag}>
                          <FaHashtag aria-hidden="true" />
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 border border-dashed border-[var(--line)] p-[22px] text-[var(--muted)]">
          {selectedTag
            ? `No public posts tagged "${selectedTag}" found.`
            : 'No public posts found.'}
        </p>
      )}
    </section>
  )
}

const postCardClassName = [
  'relative grid min-h-[124px] grid-cols-1 gap-3 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--card-accent)_34%,var(--line))] p-[18px] no-underline [background:linear-gradient(90deg,color-mix(in_srgb,var(--card-accent)_14%,transparent),transparent_42%),rgba(7,16,11,0.86)] transition-[border-color,background-color,transform] duration-[160ms] ease-out',
  "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[linear-gradient(180deg,var(--card-accent),transparent_84%)] before:shadow-[0_0_24px_color-mix(in_srgb,var(--card-accent)_52%,transparent)] before:content-['']",
  'hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--card-accent)_72%,var(--green))] hover:[background-color:color-mix(in_srgb,var(--card-accent)_10%,transparent)]',
  'min-[680px]:grid-cols-[150px_1fr] min-[680px]:p-[22px]'
].join(' ')

const postAccentClassNames = [
  '[--card-accent:var(--green)]',
  '[--card-accent:var(--blue)]',
  '[--card-accent:var(--pink)]',
  '[--card-accent:var(--yellow)]',
  '[--card-accent:var(--red)]'
]

const tagFilterBaseClassName = [
  'inline-flex max-w-full cursor-pointer appearance-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.76rem] leading-[1.35] font-bold transition-[border-color,background-color,color,transform] duration-[160ms] ease-out [overflow-wrap:anywhere]',
  '[&_svg]:size-[0.72em] [&_svg]:shrink-0'
].join(' ')

const tagFilterInactiveClassName =
  'border-[color-mix(in_srgb,var(--green)_28%,var(--line))] text-[var(--green)] [background:linear-gradient(180deg,rgba(156,255,191,0.08),transparent),rgba(49,255,128,0.04)] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--green)_74%,var(--line))] hover:text-[var(--green-soft)] focus-visible:-translate-y-px focus-visible:border-[var(--green)] [&_svg]:text-[var(--green-soft)]'

const tagFilterActiveClassName =
  'border-[var(--green)] bg-[var(--green)] text-[var(--bg)] shadow-[0_0_20px_rgba(49,255,128,0.22)] [&_svg]:text-[var(--bg)]'

const tagCountClassName =
  'rounded-full border border-current px-[0.52em] py-[0.06em] text-[0.68rem] leading-[1.25] opacity-75'

const tagFilterMinimumCount = 3

type TagFilter = {
  name: string
  count: number
}

function getTagFilters(posts: BlogPostSummary[]): TagFilter[] {
  const tagCounts = new Map<string, number>()

  for (const post of posts) {
    for (const tag of post.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(tagCounts, ([name, count]) => ({ name, count }))
    .filter((tag) => tag.count >= tagFilterMinimumCount)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
}

function getTagFilterClassName(isActive: boolean) {
  return `${tagFilterBaseClassName} ${
    isActive ? tagFilterActiveClassName : tagFilterInactiveClassName
  }`
}

function formatDate(date: string) {
  return date
}
