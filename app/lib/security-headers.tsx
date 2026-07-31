import { createContext, type ReactNode, useContext } from 'react'

const CspNonceContext = createContext('')

export function CspNonceProvider({ children, nonce }: { children?: ReactNode; nonce: string }) {
  return <CspNonceContext.Provider value={nonce}>{children}</CspNonceContext.Provider>
}

export function useCspNonce() {
  return useContext(CspNonceContext)
}

export function createHtmlSecurityHeaders(nonce: string) {
  return {
    ...commonSecurityHeaders,
    'Content-Security-Policy': createContentSecurityPolicy(nonce)
  }
}

function createContentSecurityPolicy(nonce: string) {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, 'https://pagead2.googlesyndication.com']
  const connectSrc = ["'self'", 'https://ep1.adtrafficquality.google']

  if (import.meta.env.DEV) {
    scriptSrc.push("'unsafe-eval'")
    connectSrc.push(
      'http://localhost:*',
      'ws://localhost:*',
      'http://127.0.0.1:*',
      'ws://127.0.0.1:*'
    )
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    `connect-src ${connectSrc.join(' ')}`,
    "frame-src 'self' https://googleads.g.doubleclick.net https://*.adtrafficquality.google https://www.google.com",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; ')
}

const commonSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000'
} as const
