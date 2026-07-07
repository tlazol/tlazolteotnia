# Client chunk measurement

Measured: 2026-07-07 with `npm run build`.

The generated React Router client manifest lists the home route imports without
`markdown-body-*.js`. The generated `home-*.js` route chunk contains a dynamic import for that
Markdown chunk, while the direct `/blog/:slug` route lists the same chunk as a static dependency.

Therefore the home page does not load the Markdown renderer initially and loads it when the first
article modal opens. The modal's lazy import remains intentional. Vite's
`INEFFECTIVE_DYNAMIC_IMPORT` warning applies to the SSR bundle, where the article route also imports
the renderer statically; it does not describe the client route split.

Runtime verification with `playwright-cli` against `http://localhost:5173/` confirmed that the
initial home page had no `markdown-body` resource entry. Opening the first article modal added
`/app/components/markdown-body.tsx` while keeping the page URL at `/`.
