import { FaArrowUpRightFromSquare, FaHouse, FaPalette } from 'react-icons/fa6'
import { artStationUrl, siteName, xUrl } from '~/lib/site'

export function SiteNavigation({ homeHref = '/' }: { homeHref?: string }) {
  return (
    <aside className="hidden px-5 pt-6 min-[860px]:block" aria-label="Site navigation">
      <div className="sticky top-6 flex min-h-[calc(100svh-3rem)] flex-col">
        <a
          className="mb-9 flex size-12 items-center justify-center rounded-full border border-[rgba(49,255,128,0.38)] bg-[rgba(49,255,128,0.07)] font-bold tracking-[-0.12em] text-[var(--green-soft)] no-underline shadow-[0_0_30px_rgba(49,255,128,0.12)] transition-colors hover:bg-[rgba(49,255,128,0.13)]"
          href={homeHref}
          aria-label={`${siteName} home`}
        >
          0r
        </a>

        <nav className="flex flex-col items-start gap-2" aria-label="Primary navigation">
          <a className={navLinkClassName} href={homeHref}>
            <FaHouse aria-hidden="true" />
            Home
          </a>
          <a className={navLinkClassName} href={artStationUrl}>
            <FaPalette aria-hidden="true" />
            ArtStation
          </a>
          <a className={navLinkClassName} href={xUrl}>
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
  )
}

const navLinkClassName =
  'inline-flex items-center gap-3 rounded-full px-3 py-2.5 text-[0.95rem] font-semibold text-[var(--text)] no-underline transition-[background-color,color] [font-family:var(--font-ui)] hover:bg-[rgba(49,255,128,0.08)] hover:text-[var(--green-soft)] [&_svg]:size-4 [&_svg]:text-[var(--green)]'
