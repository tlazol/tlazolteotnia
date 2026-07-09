import { type ReactNode, useState } from 'react'
import {
  FaBars,
  FaChevronDown,
  FaHashtag,
  FaHouse,
  FaPalette,
  FaUserGroup,
  FaXmark,
  FaXTwitter
} from 'react-icons/fa6'
import { Link } from 'react-router'
import { artStationUrl, authorAccount, authorName, siteName, xUrl } from '~/lib/site'

export type TopicChannel = {
  active: boolean
  count: number
  label: string
  onSelect: () => void
}

type CommunityLayoutProps = {
  activeSection: 'home' | 'blog'
  channelLabel: string
  channelMeta: string
  children: ReactNode
  rightSidebar?: ReactNode
  statusLabel?: string
  topics?: TopicChannel[]
}

export function CommunityLayout({
  activeSection,
  channelLabel,
  channelMeta,
  children,
  rightSidebar,
  statusLabel = 'signal live',
  topics = []
}: CommunityLayoutProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(true)

  return (
    <main
      className={`grid min-h-svh w-full grid-cols-1 overflow-x-clip ${
        showDetails
          ? 'min-[900px]:grid-cols-[72px_236px_minmax(0,1fr)] min-[1240px]:grid-cols-[72px_236px_minmax(0,1fr)_280px]'
          : 'min-[900px]:grid-cols-[72px_236px_minmax(0,1fr)]'
      }`}
    >
      <ServerRail />

      <aside
        className="hidden min-h-svh border-r border-[rgba(49,255,128,0.14)] bg-[var(--sidebar)] shadow-[6px_0_30px_rgba(49,255,128,0.04)] min-[900px]:block"
        aria-label="Channel navigation"
      >
        <div className="sticky top-0 flex h-svh flex-col">
          <div className="neon-edge flex min-h-14 items-center justify-between gap-2 px-4 shadow-[0_1px_0_rgba(0,0,0,0.34)]">
            <Link
              className="truncate text-[0.96rem] font-bold tracking-[-0.02em] text-[var(--text-strong)] no-underline [font-family:var(--font-display)]"
              to="/"
            >
              {siteName}
            </Link>
            <FaChevronDown className="size-3 text-[var(--pink)]" aria-hidden="true" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-4">
            <ChannelNavigation activeSection={activeSection} topics={topics} />
          </div>

          <div className="flex items-center gap-2 bg-[var(--rail)] px-2.5 py-2">
            <Avatar label="0r" />
            <span className="min-w-0 [font-family:var(--font-ui)]">
              <strong className="block truncate text-[0.72rem] leading-tight text-[var(--text-strong)]">
                {authorAccount}
              </strong>
              <span className="block truncate text-[0.62rem] leading-tight text-[var(--green-soft)]">
                Online · creating
              </span>
            </span>
          </div>
        </div>
      </aside>

      <section className="community-chat relative min-w-0 bg-[var(--chat)]">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-4 border-b border-[var(--line)] px-3 backdrop-blur-xl [background:color-mix(in_srgb,var(--chat)_90%,transparent)] min-[680px]:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              aria-controls="mobile-channel-navigation"
              aria-expanded={mobileNavigationOpen}
              aria-label={mobileNavigationOpen ? 'Close channel navigation' : 'Open channels'}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--cyan)] min-[900px]:hidden"
              onClick={() => setMobileNavigationOpen((open) => !open)}
              type="button"
            >
              {mobileNavigationOpen ? (
                <FaXmark aria-hidden="true" />
              ) : (
                <FaBars aria-hidden="true" />
              )}
            </button>
            <FaHashtag className="size-5 shrink-0 text-[var(--green)]" aria-hidden="true" />
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
              aria-label={showDetails ? 'Hide details' : 'Show details'}
              aria-pressed={showDetails}
              className={`hidden size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent transition-colors min-[1240px]:flex ${
                showDetails
                  ? 'text-[var(--cyan)]'
                  : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text-strong)]'
              }`}
              onClick={() => setShowDetails((visible) => !visible)}
              type="button"
            >
              <FaUserGroup aria-hidden="true" />
            </button>
          </div>
        </header>

        {mobileNavigationOpen && (
          <>
            <button
              aria-label="Close channel navigation"
              className="fixed inset-0 top-14 z-30 cursor-default border-0 bg-[rgba(0,2,1,0.74)] backdrop-blur-[2px] min-[900px]:hidden"
              onClick={() => setMobileNavigationOpen(false)}
              type="button"
            />
            <nav
              className="fixed top-14 bottom-0 left-0 z-40 w-[min(84vw,320px)] overflow-y-auto border-r border-[rgba(49,255,128,0.18)] bg-[var(--sidebar)] px-3 py-4 shadow-[20px_0_60px_rgba(0,0,0,0.5)] min-[900px]:hidden"
              id="mobile-channel-navigation"
              aria-label="Mobile channels"
            >
              <ChannelNavigation
                activeSection={activeSection}
                onNavigate={() => setMobileNavigationOpen(false)}
                topics={topics}
              />
            </nav>
          </>
        )}

        <div className="relative z-10">{children}</div>
      </section>

      {showDetails && (
        <aside
          className="hidden min-w-0 border-l border-[rgba(112,247,255,0.12)] bg-[var(--sidebar)] px-4 pt-5 min-[1240px]:block"
          aria-label="Channel details"
        >
          <div className="sticky top-5">{rightSidebar ?? <DefaultDetails />}</div>
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
          className="server-orb relative flex size-12 items-center justify-center rounded-2xl text-[0.76rem] font-bold tracking-[-0.08em] text-[var(--green-soft)] no-underline transition-[border-radius,transform] hover:scale-105 hover:rounded-xl"
          to="/"
        >
          <span className="relative z-10 flex size-[42px] items-center justify-center rounded-[13px] bg-[var(--panel-strong)]">
            0r
          </span>
        </Link>
        <span className="my-1 h-px w-8 bg-[var(--line)]" aria-hidden="true" />
        <RailLink href={artStationUrl} label="ArtStation">
          <FaPalette aria-hidden="true" />
        </RailLink>
        <RailLink href={xUrl} label="X / Twitter">
          <FaXTwitter aria-hidden="true" />
        </RailLink>
        <span
          className="mt-auto mb-2 size-2 rounded-full bg-[var(--pink)] shadow-[0_0_12px_var(--pink)]"
          aria-hidden="true"
        />
      </nav>
    </aside>
  )
}

function RailLink({ children, href, label }: { children: ReactNode; href: string; label: string }) {
  return (
    <a
      aria-label={label}
      className="flex size-12 items-center justify-center rounded-3xl bg-[var(--panel)] text-[1rem] text-[var(--muted)] no-underline transition-[border-radius,background-color,color,transform] hover:-translate-y-0.5 hover:rounded-xl hover:bg-[rgba(250,115,218,0.14)] hover:text-[var(--pink)]"
      href={href}
    >
      {children}
    </a>
  )
}

function ChannelNavigation({
  activeSection,
  onNavigate,
  topics
}: {
  activeSection: 'home' | 'blog'
  onNavigate?: () => void
  topics: TopicChannel[]
}) {
  return (
    <>
      <p className={sidebarLabelClassName}>Start here</p>
      <div className="mb-5 grid gap-0.5">
        <ChannelLink
          active={activeSection === 'home'}
          icon={<FaHouse />}
          label="top"
          onClick={onNavigate}
          to="/"
        />
      </div>

      {topics.length > 0 && (
        <section aria-label="Topic channels">
          <p className={sidebarLabelClassName}>Browse topics</p>
          <div className="grid gap-0.5">
            {topics.map((topic) => (
              <button
                aria-pressed={topic.active}
                className={`${sidebarChannelClassName} w-full cursor-pointer border-0 ${
                  topic.active ? sidebarChannelActiveClassName : 'bg-transparent'
                }`}
                key={topic.label}
                onClick={() => {
                  topic.onSelect()
                  onNavigate?.()
                }}
                type="button"
              >
                <FaHashtag className="size-3.5 shrink-0 text-[var(--green)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left">{topic.label}</span>
                <span className="shrink-0 text-[0.62rem] text-[var(--dim)]">{topic.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function ChannelLink({
  active,
  icon,
  label,
  onClick,
  to
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick?: () => void
  to: string
}) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={`${sidebarChannelClassName} ${active ? sidebarChannelActiveClassName : ''}`}
      onClick={onClick}
      to={to}
    >
      <span className="text-[var(--dim)] [&_svg]:size-4">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )
}

function Avatar({ label }: { label: string }) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-[rgba(49,255,128,0.46)] bg-[var(--panel-strong)] text-[0.62rem] font-bold text-[var(--green-soft)]">
      {label}
      <span className="online-spectrum absolute right-[-2px] bottom-[-2px] size-3 rounded-full border-2 border-[var(--rail)]" />
    </span>
  )
}

function DefaultDetails() {
  return (
    <section>
      <p className={sidebarLabelClassName}>Online signals — 1</p>
      <div className="flex items-center gap-3 rounded-lg px-2 py-2 [font-family:var(--font-ui)]">
        <Avatar label="0r" />
        <span className="min-w-0">
          <strong className="block truncate text-[0.8rem] text-[var(--green-soft)]">
            {authorName}
          </strong>
          <span className="block truncate text-[0.66rem] text-[var(--muted)]">
            art / code / notes
          </span>
        </span>
      </div>
      <p className="mt-5 px-2 text-[0.62rem] leading-[1.7] text-[var(--dim)] [font-family:var(--font-mono)]">
        SIGNAL: STABLE
        <br />
        TOKYO / JST
      </p>
    </section>
  )
}

const sidebarLabelClassName =
  'm-0 px-2 pb-1 text-[0.66rem] font-bold tracking-[0.04em] text-[var(--dim)] uppercase [font-family:var(--font-ui)]'

const sidebarChannelClassName =
  'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[0.82rem] font-medium text-[var(--muted)] no-underline transition-[background-color,color,box-shadow] [font-family:var(--font-ui)] hover:bg-[var(--hover)] hover:text-[var(--text)]'

const sidebarChannelActiveClassName =
  'bg-[linear-gradient(90deg,rgba(49,255,128,0.16),rgba(112,247,255,0.06),rgba(250,115,218,0.05))] !font-semibold !text-[var(--text-strong)] shadow-[inset_2px_0_0_var(--green),0_0_18px_rgba(49,255,128,0.08)]'
