import { describe, expect, it } from 'vitest'
import { createCspNonce, createHtmlSecurityHeaders } from '#/lib/security-headers'
import { requireRouteData } from '#/lib/route-helpers'
import { getLegacyBlogRedirect } from '#/routes/blog'

describe('TanStack route and server integration primitives', () => {
  it('redirects only the exact legacy blog URL with status 301', () => {
    expect(getLegacyBlogRedirect('/blog')).toMatchObject({ status: 301 })
    expect(getLegacyBlogRedirect('/blog/')).toMatchObject({ status: 301 })
    expect(getLegacyBlogRedirect('/blog/react-router-renewal')).toBeUndefined()
  })

  it('creates a different CSP nonce for each request', () => {
    const first = createCspNonce()
    const second = createCspNonce()
    expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(second).not.toBe(first)
  })

  it('turns missing route resources into TanStack 404 responses', () => {
    expect(requireRouteData('present')).toBe('present')
    let thrown: unknown
    try {
      requireRouteData(null)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({ isNotFound: true })
  })

  it('includes the nonce and all security headers in HTML responses', () => {
    const headers = createHtmlSecurityHeaders('request-nonce')
    expect(headers['Content-Security-Policy']).toContain("'nonce-request-nonce'")
    expect(headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000'
    })
  })
})
