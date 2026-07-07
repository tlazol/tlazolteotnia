# Tlazol

Personal site for Daisuke Kobayashi / Tlazolteotnia, built with React Router.

## Content

Blog posts live in `content/blog` as Markdown files with frontmatter:

```md
---
title: "Post title"
date: "2026-05-15"
description: "Short description"
tags: ["React", "Diary"]
draft: false
---
```

Draft posts are hidden from the home page and direct blog routes.

The frontmatter fields shown above are all required. `title` and `description` must be non-blank
strings, `date` must be a real calendar date in `YYYY-MM-DD` format, `tags` must be an array of
unique non-blank strings, and `draft` must be a YAML boolean. Unknown fields are rejected. A
published post must also have a non-empty body.

To add a post:

1. Add `content/blog/<slug>.md`. The filename becomes the public `/blog/<slug>` URL.
2. Put referenced local images below `public/images` and link them as `/images/...`.
3. Generate its OG image with `npm run og -- <slug>`.
4. Run `npm run check` and `npm run build` before committing.

Run `npm run og` without a slug to regenerate every public OG image. `npm run og:check` renders
all images in a temporary directory and fails if a tracked image is missing, orphaned, or stale.

## Development

Install the dependencies:

```bash
npm install
```

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Tests

Tests use Vitest. Name test files `*.test.ts` or `*.test.tsx` and place them in `tests/`.

```bash
npm test
npm run test:watch
```

The home-page article preview intentionally uses local component state: opening it does not change
the URL or add browser history. A modified click continues to navigate normally to `/blog/:slug`.

## Checks

Run the complete non-writing validation suite and production build:

```bash
npm run check
npm run build
```

The complete suite runs formatting, linting, type checking, tests, content-reference validation,
and generated OG-image validation. Individual commands are also available:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run validate:content
npm run og:check
```

`npm run validate:content` checks frontmatter, public internal links, local images, and the one-to-one
relationship between public posts and OG images. External links are syntax-checked without network
requests. Use `npm run fix` for source formatting and safe lint fixes.

## Deployment

`npm run deploy:dry-run` runs the full check suite, builds once, and asks Wrangler to validate the
Cloudflare deployment without publishing. `npm run deploy` performs the same checks and build before
publishing. Hosted CI is not configured, so run `npm run check` and `npm run build` locally before
pushing changes.
