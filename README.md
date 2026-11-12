# Tlazolteotnia

Personal site built with TanStack Start and deployed to Cloudflare Workers.

Use Node.js 22.22+, 24.x, or 26+ as specified in `package.json`.

## Local development

```bash
cp .dev.vars.example .dev.vars
npm install
npx wrangler d1 migrations apply tlazolteotnia --local
npm run dev
```

The application runs on `http://localhost:3000`. Set long random, different values for `REACTION_COOKIE_SECRET` and `ISLAND_COOKIE_SECRET` in `.dev.vars`; the file is ignored by Git. The shared island's Durable Object runs locally inside the dev server, with its storage under `.wrangler/` (separate from production).

## Verification

```bash
npm run check
npm run build
npm run deploy:dry-run
```

`check` runs formatting, linting, type checking, content validation, the Vitest suite, and the OG image consistency check.

The Vitest suite includes `tests/island-runtime.test.ts`, which starts the island Worker and its
Durable Object in workerd through Wrangler's test harness (`tests/runtime/`), so storage,
transactions, hibernation and WebSockets are exercised for real. Its test Worker adds a controllable
clock and fault injection; none of that is part of the deployed Worker.

After upgrading Biome, run `npx biome migrate --write`. After upgrading Wrangler or changing Worker bindings, run `npm run cf-typegen`. Run `npm run format` after these commands, then repeat the verification commands above.

## Production

Cloudflare configuration, the D1 binding, custom domain, and migrations live in `wrangler.jsonc`. Provision the production secret before deploying:

```bash
npx wrangler secret put REACTION_COOKIE_SECRET
npm run deploy
```

Reaction POSTs use the `REACTION_RATE_LIMITER` binding configured in `wrangler.jsonc`: 30 attempts
per minute per connection IP, shared across articles and independent of visitor cookies. Rejected
requests return HTTP 429 before parsing the form or accessing D1. If the limiter is unavailable,
writes return HTTP 503; reads remain available. Requests without `CF-Connecting-IP` share a fallback
bucket, including local development; forwarded headers are not used as an identity fallback.

These are approximate limits per Cloudflare location, not a global quota or a one-person-one-vote
guarantee. Visitors sharing an IP also share the limit. Keep the rate-limit namespace dedicated to
this site. See the [Cloudflare Rate Limiting binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Shared island

The island on the top page is edited by every visitor together. One SQLite-backed Durable Object
(`IslandRoom`, binding `ISLAND_ROOM`, fixed name `public-island`) owns the island, each visitor's
quota and the daily counters. No history is stored: only the latest island and current counters.
Browsers connect to `GET /api/island/ws` (WebSocket) after `POST /api/island/session` issues a
signed anonymous cookie; `GET /api/island` returns the latest island for reading when the
connection is unavailable. Code: `src/lib/island-*.ts`, `src/components/use-island.ts`.

Provision the island secret before the first deployment that includes it. Without it, sessions and
editing return HTTP 503 while the rest of the site keeps working:

```bash
npx wrangler secret put ISLAND_COOKIE_SECRET
```

The `migrations` entry `v1-island-room` in `wrangler.jsonc` creates the Durable Object class; the
tables inside it are created and versioned by the object itself (not D1 migrations).

| Limit | Value | Where |
| --- | --- | --- |
| Personal quota | 30 tiles, one more every 60 s (fixed requirement) | `src/lib/island-policy.ts` |
| Island-wide | 16,000 tiles per UTC day | `DAILY_TILE_LIMIT` |
| New visitor ids | 1,000 per UTC day; 32,000 rows in total | `NEW_ACTORS_PER_DAY`, `MAX_ACTOR_ROWS` |
| Upkeep writes | 2,000 rows per UTC day (cleanup, alarm, setup) | `ADMIN_ROW_BUDGET_PER_DAY` |
| Messages | 4 KiB, burst 4, 2 per second per connection | `MAX_MESSAGE_BYTES`, `MESSAGE_*` |
| Connections | 200 in total, 2 per visitor | `MAX_CONNECTIONS*` |
| Session / connect requests | 10 and 30 per minute per IP | `ISLAND_*_RATE_LIMITER` in `wrangler.jsonc` |

The island-wide limit comes from half of the Workers Free allowance of 100,000 SQLite rows written
per day: a committed edit writes 3 rows (measured with `rowsWritten`, covered by the runtime tests),
so 16,000 × 3 = 48,000 rows, leaving 2,000 for upkeep. If the measured rows per commit ever rise,
lower the limit to `floor(48,000 / rows)`.

For local checks, `.dev.vars` may set `ISLAND_DAILY_TILE_LIMIT`, `ISLAND_NEW_ACTORS_PER_DAY` or
`ISLAND_MAX_ACTOR_ROWS`. The room accepts only values stricter than the defaults, so a stray setting
can never loosen production. In development, `window.__islandDebug` exposes the client's island and
connection state for browser checks; it is removed from production builds.
