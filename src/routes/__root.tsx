import { createRootRoute, HeadContent, Outlet, Scripts, useRouter } from '@tanstack/react-router'
import { siteName } from '#/lib/site'
import { bodyClassName, headingResetClassName, siteShellClassName } from '#/lib/styles'
import appCss from '../app.css?url'
import stickersCss from '../stickers.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: stickersCss },
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'alternate', type: 'application/rss+xml', href: '/rss.xml', title: `${siteName} RSS` },
      {
        rel: 'alternate',
        type: 'application/atom+xml',
        href: '/atom.xml',
        title: `${siteName} Atom`
      },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700;900&family=Space+Grotesk:wght@600;700&display=swap'
      }
    ]
  }),
  component: Outlet,
  shellComponent: RootDocument,
  errorComponent: AppError,
  notFoundComponent: AppNotFound
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body className={bodyClassName}>
        <div className="app-content">{children}</div>
        <Scripts />
      </body>
    </html>
  )
}

function AppNotFound() {
  return <ErrorPage message="404" details="The requested page could not be found." />
}

function AppError({ error }: { error: Error }) {
  const router = useRouter()
  return (
    <ErrorPage
      message="Oops!"
      details={import.meta.env.DEV ? error.message : 'An unexpected error occurred.'}
      retry={() => router.invalidate()}
    />
  )
}

function ErrorPage({
  message,
  details,
  retry
}: {
  message: string
  details: string
  retry?: () => void
}) {
  return (
    <main className={`${siteShellClassName} flex min-h-svh flex-col justify-center`}>
      <h1
        className={`${headingResetClassName} text-[clamp(2.4rem,18vw,7rem)] text-[var(--danger)]`}
      >
        {message}
      </h1>
      <p className="text-[var(--muted)]">{details}</p>
      {retry && (
        <button type="button" onClick={retry}>
          Retry
        </button>
      )}
    </main>
  )
}
