import { type ReactNode, useState } from 'react'
import {
  FaArrowUpRightFromSquare,
  FaBars,
  FaChevronDown,
  FaHashtag,
  FaHouse,
  FaPalette,
  FaUserGroup,
  FaXmark
} from 'react-icons/fa6'
import { Link } from 'react-router'
import { artStationUrl, authorAccount, authorName, siteName, xUrl } from '~/lib/site'

type CommunityShellProps = {
  activeSection?: 'home' | 'blog'
  channelLabel: string
  channelMeta: string
  channelNavigation?: ReactNode
  children: ReactNode
  mobileNavigation?: ReactNode
  rightSidebar?: ReactNode
  statusLabel?: string
}

export function CommunityShell({
  activeSection,
  channelLabel,
  channelMeta,
  channelNavigation,
  children,
  mobileNavigation,
  rightSidebar,
  statusLabel = 'online'
}: CommunityShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(true)

  return (
    <main
      className={`grid min-h-svh w-full grid-cols-1 ${
        showDetails
          ? 'min-[900px]:grid-cols-[72px_236px_minmax(0,1fr)] min-[1240px]:grid-cols-[72px_236px_minmax(0,1fr)_280px]'
          : 'min-[900px]:grid-cols-[72px_236px_minmax(0,1fr)]'
      }`}
    >
      <ServerRail />

      <aside
        className="hidden min-h-svh border-r border-[rgba(49,255,128,0.14)] bg-[var(--sidebar)] shadow-[6px_0_24px_rgba(49,255,128,0.035)] min-[900px]:block"
        aria-label="Channel navigation"
      >
        <div className="sticky top-0 flex h-svh flex-col">
          <div className="neon-edge flex min-h-14 items-center justify-between gap-2 px-4 shadow-[0_1px_0_rgba(0,0,0,0.32)]">
            <Link
              className="truncate text-[0.96rem] font-bold tracking-[-0.02em] text-[var(--text-strong)] no-underline [font-family:var(--font-display)]"
              to="/"
            >
              {siteName}
            </Link>
            <FaChevronDown className="size-3 text-[var(--muted)]" aria-hidden="true" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-4">
            <p className={sidebarLabelClassName}>Navigate</p>
            <nav className="mb-5 grid gap-0.5" aria-label="Main channels">
              <SidebarLink
                active={activeSection === 'home'}
                icon={<FaHouse />}
                label="home"
                to="/"
              />
              <SidebarLink
                active={activeSection === 'blog'}
                icon={<FaHashtag />}
                label="all-posts"
                to="/blog"
              />
            </nav>

            {channelNavigation && (
              <section aria-label="Topic channels">
                <p className={sidebarLabelClassName}>Browse by topic</p>
                <div className="grid gap-0.5">{channelNavigation}</div>
              </section>
            )}
          </div>

          <div className="flex items-center gap-2 bg-[var(--rail)] px-2.5 py-2">
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-[rgba(49,255,128,0.46)] bg-[var(--panel-strong)] text-[0.62rem] font-bold text-[var(--green-soft)]">
              0r
              <span className="online-spectrum absolute right-[-2px] bottom-[-2px] size-3 rounded-full border-2 border-[var(--panel)]" />
            </span>
            <span className="min-w-0 [font-family:var(--font-ui)]">
              <strong className="block truncate text-[0.72rem] leading-tight text-[var(--text-strong)]">
                {authorAccount}
              </strong>
              <span className="block truncate text-[0.62rem] leading-tight text-[var(--muted)]">
                Online
              </span>
            </span>
          </div>
        </div>
      </aside>

      <section className="min-w-0 [background:radial-gradient(circle_at_78%_-10%,rgba(49,255,128,0.1),transparent_30rem),radial-gradient(circle_at_8%_42%,rgba(45,172,249,0.045),transparent_24rem),var(--chat)]">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-4 border-b border-[var(--line)] px-3 backdrop-blur-xl [background:color-mix(in_srgb,var(--chat)_92%,transparent)] min-[680px]:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {mobileNavigation && (
              <button
                aria-controls="mobile-channel-navigation"
                aria-expanded={mobileNavigationOpen}
                aria-label={
                  mobileNavigationOpen ? 'Close channel navigation' : 'Open channel navigation'
                }
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text-strong)] min-[900px]:hidden"
                onClick={() => setMobileNavigationOpen((open) => !open)}
                type="button"
              >
                {mobileNavigationOpen ? (
                  <FaXmark aria-hidden="true" />
                ) : (
                  <FaBars aria-hidden="true" />
                )}
              </button>
            )}
            <FaHashtag className="size-5 shrink-0 text-[var(--dim)]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="m-0 truncate text-[0.95rem] leading-tight font-bold text-[var(--text-strong)] [font-family:var(--font-ui)]">
                {channelLabel}
              </p>
              <p className="mt-0.5 mb-0 hidden truncate text-[0.68rem] leading-tight text-[var(--muted)] min-[520px]:block [font-family:var(--font-ui)]">
                {channelMeta}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="mr-1 hidden items-center gap-2 text-[0.62rem] font-semibold tracking-[0.06em] text-[var(--green-soft)] uppercase min-[520px]:inline-flex [font-family:var(--font-mono)]">
              <span className="online-spectrum size-2 rounded-full" />
              {statusLabel}
            </span>
            <button
              aria-label={showDetails ? 'Hide channel details' : 'Show channel details'}
              aria-pressed={showDetails}
              className={`hidden size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent transition-colors min-[1240px]:flex ${
                showDetails
                  ? 'text-[var(--green-soft)]'
                  : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text-strong)]'
              }`}
              onClick={() => setShowDetails((visible) => !visible)}
              type="button"
            >
              <FaUserGroup aria-hidden="true" />
            </button>
          </div>
        </header>

        {mobileNavigation && mobileNavigationOpen && (
          <>
            <button
              aria-label="Close channel navigation"
              className="fixed inset-0 top-14 z-30 cursor-default border-0 bg-[rgba(8,9,12,0.68)] backdrop-blur-[2px] min-[900px]:hidden"
              onClick={() => setMobileNavigationOpen(false)}
              type="button"
            />
            <nav
              className="fixed top-14 bottom-0 left-0 z-40 w-[min(84vw,320px)] overflow-y-auto bg-[var(--sidebar)] px-3 py-4 shadow-[20px_0_60px_rgba(0,0,0,0.38)] min-[900px]:hidden"
              id="mobile-channel-navigation"
              aria-label="Mobile channels"
            >
              <p className={sidebarLabelClassName}>Channels</p>
              <div className="grid gap-1 [&>*]:!w-full [&>*]:!justify-start [&>*]:!px-2">
                {mobileNavigation}
              </div>
            </nav>
          </>
        )}

        {children}
      </section>

      {showDetails && (
        <aside
          className="hidden min-w-0 border-l border-[rgba(112,247,255,0.12)] bg-[var(--sidebar)] px-4 pt-5 min-[1240px]:block"
          aria-label="Channel details"
        >
          <div className="sticky top-5">
            {rightSidebar ?? <DefaultDetails />}
            <p className="mt-4 px-2 text-[0.62rem] leading-[1.7] text-[var(--dim)] [font-family:var(--font-mono)]">
              SIGNAL: STABLE
              <br />
              TOKYO / JST
            </p>
          </div>
        </aside>
      )}
    </main>
  )
}

function ServerRail() {
  return (
    <aside
      className="hidden min-h-svh bg-[var(--rail)] shadow-[inset_-1px_0_0_rgba(112,247,255,0.12)] min-[900px]:block"
      aria-label="Servers"
    >
      <nav
        className="sticky top-0 flex h-svh flex-col items-center gap-2 py-3"
        aria-label="Server rail"
      >
        <Link
          aria-label={`${siteName} home`}
          className="server-rail-active group relative flex size-12 items-center justify-center rounded-2xl border border-[rgba(49,255,128,0.42)] bg-[rgba(49,255,128,0.12)] text-[0.76rem] font-bold tracking-[-0.08em] text-[var(--green-soft)] no-underline transition-[border-radius,background-color] hover:rounded-xl hover:bg-[rgba(49,255,128,0.18)]"
          to="/"
        >
          0r
        </Link>
        <span className="h-px w-8 bg-[var(--line)]" aria-hidden="true" />
        <RailLink href={artStationUrl} label="ArtStation">
          <FaPalette aria-hidden="true" />
        </RailLink>
        <RailLink href={xUrl} label="X / Twitter">
          <FaArrowUpRightFromSquare aria-hidden="true" />
        </RailLink>
      </nav>
    </aside>
  )
}

function RailLink({ children, href, label }: { children: ReactNode; href: string; label: string }) {
  return (
    <a
      aria-label={label}
      className="flex size-12 items-center justify-center rounded-3xl bg-[var(--panel)] text-[1rem] text-[var(--muted)] no-underline transition-[border-radius,background-color,color] hover:rounded-xl hover:bg-[rgba(49,255,128,0.14)] hover:text-[var(--green-soft)]"
      href={href}
    >
      {children}
    </a>
  )
}

function SidebarLink({
  active,
  icon,
  label,
  to
}: {
  active: boolean
  icon: ReactNode
  label: string
  to: string
}) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={`${sidebarChannelClassName} ${active ? sidebarChannelActiveClassName : ''}`}
      to={to}
    >
      <span className="text-[var(--dim)] [&_svg]:size-4">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )
}

function DefaultDetails() {
  return (
    <section>
      <p className={sidebarLabelClassName}>Online — 1</p>
      <div className="flex items-center gap-3 rounded-lg px-2 py-2 [font-family:var(--font-ui)]">
        <span className="relative flex size-9 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-strong)] text-[0.66rem] font-bold text-[var(--green-soft)]">
          0r
          <span className="online-spectrum absolute right-[-2px] bottom-[-2px] size-3 rounded-full border-2 border-[var(--panel)]" />
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-[0.8rem] text-[var(--green-soft)]">
            {authorName}
          </strong>
          <span className="block truncate text-[0.66rem] text-[var(--muted)]">
            art / code / notes
          </span>
        </span>
      </div>
    </section>
  )
}

export const sidebarLabelClassName =
  'm-0 px-2 pb-1 text-[0.66rem] font-bold tracking-[0.04em] text-[var(--dim)] uppercase [font-family:var(--font-ui)]'

export const sidebarChannelClassName =
  'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[0.82rem] font-medium text-[var(--muted)] no-underline transition-[background-color,color] [font-family:var(--font-ui)] hover:bg-[var(--hover)] hover:text-[var(--text)]'

export const sidebarChannelActiveClassName =
  'bg-[linear-gradient(90deg,rgba(49,255,128,0.16),rgba(112,247,255,0.06))] !font-semibold !text-[var(--text-strong)] shadow-[inset_2px_0_0_var(--green),0_0_18px_rgba(49,255,128,0.07)]'

export const mobileChannelClassName =
  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-transparent bg-transparent px-2.5 text-[0.78rem] font-semibold text-[var(--muted)] no-underline transition-[border-color,background-color,color] [font-family:var(--font-ui)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
