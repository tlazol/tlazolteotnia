export type RuntimeDependencies = {
  db: D1Database
  reactionCountsCache: Cache | null
  reactionCookieSecret: string
  reactionRateLimiter: RateLimit
  waitUntil: ExecutionContext['waitUntil'] | null
}

export type RequestContext = RuntimeDependencies & { nonce: string }
