import { FaAngleRight } from 'react-icons/fa6'
import { headingResetClassName, terminalLabelClassName, textLinkClassName } from '~/lib/styles'

export function ProfileFooter() {
  return (
    <footer className="relative mt-24 grid gap-[26px] border-t border-[var(--line)] pt-[30px] before:absolute before:top-[-1px] before:right-0 before:left-0 before:h-px before:bg-[linear-gradient(90deg,var(--green),var(--blue),transparent)] before:opacity-58 before:content-[''] min-[680px]:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)] min-[680px]:items-start min-[680px]:pt-[42px]">
      <div>
        <p className={terminalLabelClassName}>whoami</p>
        <h2
          className={`${headingResetClassName} text-[clamp(1.6rem,9vw,3rem)] leading-[1.05] text-[var(--green-soft)]`}
        >
          Daisuke Kobayashi
        </h2>
        <p className="mt-4 max-w-[570px] text-[0.96rem] leading-[1.75] text-[var(--muted)]">
          Tlazolteotnia is a personal space for artwork, experiments, and short notes. For current
          visual work, visit ArtStation.
        </p>
      </div>

      <nav className="flex flex-col items-start gap-2.5" aria-label="Profile links">
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
