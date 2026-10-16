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

The application runs on `http://localhost:3000`. Set a long random `REACTION_COOKIE_SECRET` in `.dev.vars`; the file is ignored by Git.

## Verification

```bash
npm run check
npm run build
npm run deploy:dry-run
```

`check` runs formatting, linting, type checking, content validation, the Vitest suite, and the OG image consistency check.

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
