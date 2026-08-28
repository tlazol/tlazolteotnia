export type RuntimeDependencies = {
  db: D1Database
  reactionCountsCache: Cache | null
  reactionCookieSecret: string
  waitUntil: ExecutionContext['waitUntil'] | null
}

export type RequestContext = RuntimeDependencies & { nonce: string }
