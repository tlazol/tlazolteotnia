import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/blog')({
  beforeLoad: ({ location }) => {
    const legacyRedirect = getLegacyBlogRedirect(location.pathname)
    if (legacyRedirect) throw legacyRedirect
  },
  component: Outlet
})

export function getLegacyBlogRedirect(pathname: string) {
  if (pathname === '/blog' || pathname === '/blog/') {
    return redirect({ to: '/', statusCode: 301 })
  }
  return undefined
}
