// Writes src/routeTree.gen.ts as the TanStack Start Vite plugin does, so the
// file stays the same whichever of the two wrote it last. The router CLI would
// leave out the footer Start adds: the Register declaration that types the
// router for `@tanstack/react-start`. Start reads tsr.config.json too and
// appends its footer to its own, so the footer lives here instead.
import { Generator, getConfig } from '@tanstack/router-generator'

const startFooter = `import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}`

const root = process.cwd()
try {
  await new Generator({
    config: getConfig({ target: 'react', routeTreeFileFooter: [startFooter] }, root),
    root
  }).run()
} catch (error) {
  console.error(error)
  process.exit(1)
}
