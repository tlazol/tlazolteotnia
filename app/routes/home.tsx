import type { Route } from './+types/home'
import { FaArrowUpRightFromSquare, FaHouse, FaPalette } from 'react-icons/fa6'
import { HomeTimeline } from '~/components/home-timeline'
import { getBlogPosts } from '~/lib/blog.server'

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

  return { posts }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-[1260px] grid-cols-1 min-[860px]:grid-cols-[220px_minmax(0,650px)] min-[1180px]:grid-cols-[220px_minmax(0,650px)_minmax(0,1fr)]">
      <aside className="hidden px-5 pt-6 min-[860px]:block" aria-label="Site navigation">
        <div className="sticky top-6 flex min-h-[calc(100svh-3rem)] flex-col">
          <a
            className="mb-9 flex size-12 items-center justify-center rounded-full border border-[rgba(49,255,128,0.38)] bg-[rgba(49,255,128,0.07)] font-bold tracking-[-0.12em] text-[var(--green-soft)] no-underline shadow-[0_0_30px_rgba(49,255,128,0.12)] transition-colors hover:bg-[rgba(49,255,128,0.13)]"
            href="#timeline-title"
            aria-label="Tlazolteotnia home"
          >
            0r
          </a>

          <nav className="flex flex-col items-start gap-2" aria-label="Primary navigation">
            <a className={navLinkClassName} href="#timeline-title">
              <FaHouse aria-hidden="true" />
              Home
            </a>
            <a className={navLinkClassName} href="https://www.artstation.com/orga">
              <FaPalette aria-hidden="true" />
              ArtStation
            </a>
            <a className={navLinkClassName} href="https://twitter.com/0rga">
              <FaArrowUpRightFromSquare aria-hidden="true" />X / Twitter
            </a>
          </nav>

          <div className="mt-auto pb-2">
            <p className="m-0 text-[0.68rem] leading-[1.65] text-[var(--dim)]">
              SIGNAL: STABLE
              <br />
              TOKYO / JST
            </p>
          </div>
        </div>
      </aside>

      <HomeTimeline posts={posts} />
    </main>
  )
}

const navLinkClassName =
  'inline-flex items-center gap-3 rounded-full px-3 py-2.5 text-[0.95rem] font-semibold text-[var(--text)] no-underline transition-[background-color,color] [font-family:var(--font-ui)] hover:bg-[rgba(49,255,128,0.08)] hover:text-[var(--green-soft)] [&_svg]:size-4 [&_svg]:text-[var(--green)]'
