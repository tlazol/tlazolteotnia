import { Link } from 'react-router'
import { FaAngleRight } from 'react-icons/fa6'
import { headingResetClassName, terminalLabelClassName, textLinkClassName } from '~/lib/styles'

export function ProfileFooter({ showTopLink = false }: { showTopLink?: boolean }) {
  return (
    <footer className="relative -mx-[18px] mt-24 grid gap-[26px] border-t border-[color-mix(in_srgb,var(--line)_72%,black)] px-[18px] pt-[30px] pb-[28px] [background:linear-gradient(180deg,rgba(2,4,3,0.38),rgba(2,4,3,0.82))] before:absolute before:top-[-1px] before:right-0 before:left-0 before:h-px before:bg-[linear-gradient(90deg,color-mix(in_srgb,var(--green)_42%,transparent),color-mix(in_srgb,var(--blue)_28%,transparent),transparent)] before:opacity-70 before:content-[''] min-[680px]:-mx-[30px] min-[680px]:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)] min-[680px]:items-start min-[680px]:px-[30px] min-[680px]:pt-[42px]">
      <div>
        <p className={terminalLabelClassName}>whoami</p>
        <h2
          className={`${headingResetClassName} text-[clamp(1.6rem,9vw,3rem)] leading-[1.05] text-[color-mix(in_srgb,var(--green-soft)_74%,var(--muted))]`}
        >
          Daisuke Kobayashi
        </h2>
        <p className="mt-4 max-w-[570px] text-[clamp(0.78rem,3vw,0.98rem)] leading-[1.55] text-[color-mix(in_srgb,var(--muted)_84%,var(--dim))]">
          Tlazolteotnia is a personal space for artwork, experiments, and short notes. For current
          visual work, visit ArtStation.
        </p>
      </div>

      <nav
        className="flex flex-col items-start gap-2.5 [&_a]:text-[color-mix(in_srgb,var(--green-soft)_78%,var(--muted))] [&_svg]:text-[color-mix(in_srgb,var(--green)_70%,var(--muted))]"
        aria-label="Footer links"
      >
        {showTopLink && (
          <Link className={textLinkClassName} to="/">
            <FaAngleRight aria-hidden="true" />
            Back to top
          </Link>
        )}
        <a className={textLinkClassName} href="https://twitter.com/0rga">
          <FaAngleRight aria-hidden="true" />X / Twitter
        </a>
        <a className={textLinkClassName} href="https://www.artstation.com/orga">
          <FaAngleRight aria-hidden="true" />
          ArtStation
        </a>
      </nav>
    </footer>
  )
}
