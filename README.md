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
