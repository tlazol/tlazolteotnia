export type RuntimeDependencies = {
  db: D1Database
  reactionCookieSecret: string
  reactionRateLimiter: RateLimit
}

export type RequestContext = RuntimeDependencies & { nonce: string }
