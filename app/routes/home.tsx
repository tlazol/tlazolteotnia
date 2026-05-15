import type { Route } from './+types/home'
import { useState } from 'react'
import { Link } from 'react-router'
import { FaAngleRight, FaHashtag } from 'react-icons/fa6'
import { ProfileFooter } from '~/components/profile-footer'
import { getBlogPosts } from '~/lib/blog.server'
import {
  headingResetClassName,
  siteShellClassName,
  tagPillClassName,
  terminalLabelClassName,
  textLinkClassName
} from '~/lib/styles'

export function meta() {
  return [
    { title: 'Tlazolteotnia | 0rga.org' },
    {
      name: 'description',
      content: 'Personal site and notes from Daisuke Kobayashi / Tlazolteotnia.'
    }
  ]
}

export async function loader() {
  const posts = await getBlogPosts()
  const tags = getTagFilters(posts)

  return { posts, tags }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts, tags } = loaderData
  const [selectedTag, setSelectedTag] = useState('')
  const visiblePosts = selectedTag ? posts.filter((post) => post.tags.includes(selectedTag)) : posts

  return (
    <main className={siteShellClassName}>
      <section
        className="relative flex min-h-[62svh] flex-col justify-center border-b border-[var(--line)] py-[52px] pb-[38px] after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-px after:opacity-72 after:shadow-[0_0_22px_rgba(49,255,128,0.28)] after:content-[''] after:[background:var(--spectrum)] min-[680px]:min-h-[58svh] min-[680px]:pt-[70px]"
        aria-labelledby="site-title"
      >
        <p className={terminalLabelClassName}>ssh 0rga.org</p>
        <h1
          id="site-title"
          className={`${headingResetClassName} text-[clamp(2.15rem,11vw,5.8rem)] leading-[0.95] text-[var(--green-soft)] whitespace-nowrap [overflow-wrap:normal] [text-shadow:0_0_24px_rgba(49,255,128,0.24),-0.05em_0_30px_rgba(45,172,249,0.15),0.05em_0_30px_rgba(250,115,218,0.14)]`}
        >
          Tlazolteotnia
        </h1>
        <p
          className="mt-6 grid max-w-[670px] gap-[0.18em] text-[clamp(0.78rem,3vw,0.98rem)] leading-[1.55] text-[var(--text)] [overflow-wrap:anywhere]"
          aria-hidden="true"
        >
          <span>CHΔ0S://9X_QR⟊⟊⧖NULL::0x7F-VOID</span>
          <span>SYS∴C-AO5⟫⟫VANTA_404::λλ⟁ERR</span>
          <span>{'RX#CHA0S//Ω_808⟐⟐GL1TCH::NOISE'}</span>
        </p>
        <nav className="mt-7 flex flex-wrap gap-3" aria-label="Primary links">
          <a className={textLinkClassName} href="https://www.artstation.com/orga">
            <FaAngleRight aria-hidden="true" />
            ArtStation
          </a>
        </nav>
        <div className="relative mt-8 w-full max-w-[540px] overflow-hidden rounded-lg border border-[rgba(49,255,128,0.34)] [background:linear-gradient(135deg,rgba(45,172,249,0.12),transparent_42%),linear-gradient(315deg,rgba(250,115,218,0.1),transparent_48%),rgba(3,9,6,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_46px_rgba(0,0,0,0.36),0_0_32px_rgba(49,255,128,0.1)] before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[''] before:[background:var(--spectrum)]">
          <div className="flex gap-[7px] px-3.5 pt-3">
            <span className="size-2 rounded-full bg-[var(--red)] text-[var(--red)] shadow-[0_0_14px_currentColor]" />
            <span className="size-2 rounded-full bg-[var(--yellow)] text-[var(--yellow)] shadow-[0_0_14px_currentColor]" />
            <span className="size-2 rounded-full bg-[var(--green)] text-[var(--green)] shadow-[0_0_14px_currentColor]" />
          </div>
          <pre className="m-0 overflow-x-hidden px-4 pt-[15px] pb-[17px] text-[clamp(0.78rem,3.4vw,0.95rem)] leading-[1.7] whitespace-pre-wrap text-[var(--text)] [overflow-wrap:anywhere]">
            <code>{`Art, notes, and odds and ends.
Updated now and then.`}</code>
          </pre>
        </div>
      </section>

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

      <ProfileFooter />
    </main>
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

function getTagFilters(posts: Awaited<ReturnType<typeof getBlogPosts>>): TagFilter[] {
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
