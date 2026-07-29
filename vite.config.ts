import { readdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

const projectDirectory = path.dirname(fileURLToPath(import.meta.url))
const paintDirectory = path.join(projectDirectory, 'public', 'images', 'paint')
const virtualPaintImagesModule = 'virtual:paint-images'
const resolvedVirtualPaintImagesModule = `\0${virtualPaintImagesModule}`
const imageExtension = /\.(avif|gif|jpe?g|png|svg|webp)$/i

export async function discoverPaintImages(directory: string): Promise<string[]> {
  const files = await collectPaintImages(directory)

  return files
    .map((file) => path.relative(directory, file).split(path.sep).map(encodeURIComponent).join('/'))
    .sort()
    .map((file) => `/images/paint/${file}`)
}

export function assertPaintImages(images: readonly string[], directory: string) {
  if (images.length === 0) {
    throw new Error(`No paint images found in ${directory}`)
  }
}

async function collectPaintImages(directory: string): Promise<string[]> {
  let entries: Dirent<string>[]

  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return collectPaintImages(entryPath)
      }

      return entry.isFile() && imageExtension.test(entry.name) ? [entryPath] : []
    })
  )

  return files.flat()
}

function paintImagesPlugin(): Plugin {
  let isBuild = false

  return {
    name: 'paint-images',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    resolveId(id) {
      return id === virtualPaintImagesModule ? resolvedVirtualPaintImagesModule : undefined
    },
    async load(id) {
      if (id !== resolvedVirtualPaintImagesModule) {
        return undefined
      }

      return `export default Object.freeze(${JSON.stringify(await discoverPaintImages(paintDirectory))})`
    },
    async buildStart() {
      if (isBuild) {
        try {
          assertPaintImages(await discoverPaintImages(paintDirectory), paintDirectory)
        } catch (error) {
          this.error(error instanceof Error ? error.message : String(error))
        }
      }
    },
    configureServer(server) {
      server.watcher.add(paintDirectory)
      server.watcher.on('all', (_event, changedPath) => {
        if (
          changedPath === paintDirectory ||
          changedPath.startsWith(`${paintDirectory}${path.sep}`)
        ) {
          server.ws.send({ type: 'full-reload' })
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [
    paintImagesPlugin(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    reactRouter()
  ],
  resolve: {
    tsconfigPaths: true
  }
})
