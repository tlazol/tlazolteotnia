# Client chunk measurement

Measured on 2026-10-16 for the R6–R8 refactoring, using Node.js v24.17.0,
npm 12.0.2, Vite 8.3.4, and the repository's TanStack Start + Cloudflare Vite configuration.
The baseline was commit `e2f57cefcfca435596fcfc15623333d0c39832b4`.
No dependency or bundler configuration changes were made.

## Production build

Built before and after the changes with:

```sh
WRANGLER_LOG_PATH=/private/tmp/r678-wrangler.log npm run build
```

The generated `dist/server/assets/_tanstack-start-manifest_v-*.js` describes the client
preloads for each route. The measurement takes the union of `__root__` and `/` preloads,
deduplicates paths, and measures the corresponding JavaScript files in `dist/client`.
The server manifest supplies client asset paths; server bundle sizes are not counted.
The after column includes the same-day review fixes for Lights Out runtime failure handling;
that rebuild used `WRANGLER_LOG_PATH=/private/tmp/r678-review-wrangler.log npm run build`.

| Home route's initial JS preloads | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Uncompressed bytes | 579,521 | 426,861 | 152,660 |
| Sum of individually gzip-compressed files | 192,667 | 144,147 | 48,520 |

These are asset-size measurements of the complete R6–R8 changes, not measured HTTP transfer
sizes or load times. They exclude CSS, images, fonts, server data, and dynamic imports such as
the town renderer. Chunk count changes are a consequence of bundler partitioning.

Before the change, the home route's preload list included
`article-content-ChJlsvG-.js` (150,737 bytes, gzip 48,110 bytes), containing the article UI,
Markdown rendering, and syntax highlighting.
After the change, neither the root nor home preload list includes the article content chunks.
The home component chunk `routes-Cz-59LMp.js` dynamically imports
`article-content-CfVb7836.js`, which re-exports the shared implementation in
`article-content-BUv5zj00.js`. The `/blog/$slug` preload list still includes that shared
implementation for direct article access.

`PostModal` keeps its dialog, close button, focus handling, and article-page link available
while fetching article data and importing `ArticleContent` concurrently. Either failure shows
the existing error message and article-page link. The article detail route retains its static
component import and server-rendered body.

To reproduce the preload-size calculation after a build:

```sh
node --input-type=module <<'JS'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
const directory = 'dist/server/assets'
const name = readdirSync(directory).find(name => name.startsWith('_tanstack-start-manifest_v-'))
const { tsrStartManifest } = await import(pathToFileURL(resolve(directory, name)))
const { routes } = tsrStartManifest()
const files = [...new Set([...routes.__root__.preloads, ...routes['/'].preloads])]
const sizes = files.map(file => {
  const data = readFileSync(`dist/client${file}`)
  return { file, bytes: data.length, gzip: gzipSync(data).length }
})
console.table(sizes)
console.log(sizes.reduce((total, row) => ({
  bytes: total.bytes + row.bytes,
  gzip: total.gzip + row.gzip
}), { bytes: 0, gzip: 0 }))
JS
```

## Browser verification

Used `playwright-cli` against the existing development server at `http://localhost:3000/`,
with fresh browser contexts to exclude modules retained by HMR or an earlier article visit.

| Point in the visit | Article-related resource entries |
| --- | --- |
| Initial home load before refactoring | `article-content.tsx`, `markdown-body.tsx`, `code-block.tsx` |
| Initial home load after refactoring | None of those three modules |
| First modal open | All three modules loaded |
| Close and reopen | No additional fetch of those modules |

Also verified closing during a deliberately delayed module load, Escape and focus restoration,
modified-click navigation to the article page, and a deliberately failed module request with
an error message and article-page link. An HTTP fetch of the article detail page contains the
article body before client JavaScript runs. Development resource URLs establish when imports
occur; the production client preload manifest and generated dynamic import establish the
production split.

Session evidence: `/private/tmp/r678-before-build.log`, `/private/tmp/r678-after-build.log`,
`/private/tmp/r678-before-chunks.json`, `/private/tmp/r678-after-chunks.json`, and
`/private/tmp/r678-browser-articles.log`. The final review build and size calculation are recorded in
`/private/tmp/r678-review-build.log` and `/private/tmp/r678-review-chunks.json`.
These temporary files are local verification artifacts.
