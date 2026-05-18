import type { Route } from './+types/home'
import { FaAngleRight } from 'react-icons/fa6'
import { BlogIndexSection } from '~/components/blog-index-section'
import { ProfileFooter } from '~/components/profile-footer'
import { getBlogPosts } from '~/lib/blog.server'
import {
  headingResetClassName,
  siteShellClassName,
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

  return { posts }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData

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

      <BlogIndexSection posts={posts} />

      <ProfileFooter />
    </main>
  )
}
