# Security Review

Date: 2026-07-07

## Current architecture

- The site runs on React Router and Cloudflare Workers.
- Blog routes are `/blog` and `/blog/:slug`.
- OG images are generated ahead of deployment into `public/images/og/<slug>.png`; there is no
  dynamic OG-image route.
- Markdown sources are parsed by the shared `app/lib/blog-post.ts` module in both the web build and
  OG generator.

## Confirmed protections

- Markdown block and inline HTML tokens are discarded.
- Markdown links and images allow only `http:`, `https:`, `mailto:`, and `tel:` protocols.
- HTML responses use a per-request CSP nonce and include content-type, referrer, permissions, and
  transport-security headers.
- `npm run validate:content` checks frontmatter, public internal links, local image references, and
  OG-image presence without accessing external URLs.
- `npm run og:check` regenerates images in a temporary directory and detects stale or orphaned
  static OG images.

## Verification

Run these commands before deployment:

```console
npm run check
npm run build
npm run deploy:dry-run
```

The shared checks cover Markdown security behavior, URL handling, content validation, and generated
OG-image consistency. Cloudflare deployment writes happen only in `npm run deploy`.
