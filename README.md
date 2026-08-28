# Tlazolteotnia

Personal site built with TanStack Start and deployed to Cloudflare Workers.

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

## Production

Cloudflare configuration, the D1 binding, custom domain, and migrations live in `wrangler.jsonc`. Provision the production secret before deploying:

```bash
npx wrangler secret put REACTION_COOKIE_SECRET
npm run deploy
```
