import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type BlogPostRecord, parseBlogPosts } from '../app/lib/blog-post'
import { renderOgPng } from './og-image'

export { fillRowText, getTitleFontSize, makeRowTexts, renderOgPng, renderSvg } from './og-image'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(scriptDirectory, '..')
const contentDirectory = path.join(projectDirectory, 'content/blog')
const outputDirectory = path.join(projectDirectory, 'public/images/og')
const fontPath = path.join(scriptDirectory, 'assets/NotoSansCJKjp-Bold.otf')

async function main() {
  const arguments_ = process.argv.slice(2)
  const check = arguments_[0] === '--check'
  const requestedSlugs = check ? arguments_.slice(1) : arguments_

  if (requestedSlugs.length > 1 || (check && requestedSlugs.length > 0)) {
    throw new Error('Usage: npm run og -- [slug]\n       npm run og:check')
  }

  if (check) {
    await checkOgImages()
    return
  }

  await generateOgImages({ requestedSlug: requestedSlugs[0] })
}

export async function generateOgImages({
  requestedSlug,
  destinationDirectory = outputDirectory,
  log = true
}: {
  requestedSlug?: string
  destinationDirectory?: string
  log?: boolean
} = {}) {
  const posts = await readPosts()
  const targetPosts = selectPosts(posts, requestedSlug)
  const font = await readFile(fontPath)

  await mkdir(destinationDirectory, { recursive: true })

  for (const post of targetPosts) {
    const png = await renderOgPng(post.title, post.description, post.date, font)
    const outputPath = path.join(destinationDirectory, `${post.slug}.png`)

    await writeFile(outputPath, png)

    if (log) {
      console.log(`Generated ${path.relative(projectDirectory, outputPath)}`)
    }
  }

  return targetPosts.map((post) => post.slug)
}

export async function readPosts(): Promise<BlogPostRecord[]> {
  const entries = await readdir(contentDirectory, { withFileTypes: true })
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()

  return parseBlogPosts(
    await Promise.all(
      filenames.map(async (filename) => ({
        path: `content/blog/${filename}`,
        source: await readFile(path.join(contentDirectory, filename), 'utf8')
      }))
    )
  )
}

export function selectPosts(posts: BlogPostRecord[], requestedSlug?: string) {
  if (!requestedSlug) {
    return posts.filter(notDraft)
  }

  const post = posts.find((candidate) => candidate.slug === requestedSlug)

  if (!post) {
    throw new Error(`Post not found: ${requestedSlug}`)
  }

  if (post.draft) {
    throw new Error(`Post is a draft: ${requestedSlug}`)
  }

  return [post]
}

function notDraft(post: BlogPostRecord) {
  return !post.draft
}

export async function checkOgImages() {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'tlazol-og-'))

  try {
    const generatedSlugs = await generateOgImages({
      destinationDirectory: temporaryDirectory,
      log: false
    })
    const trackedSlugs = (await readdir(outputDirectory))
      .filter((filename) => filename.endsWith('.png'))
      .map((filename) => filename.slice(0, -'.png'.length))
      .sort()
    const generatedSlugSet = new Set(generatedSlugs)
    const errors: string[] = []

    for (const slug of generatedSlugs) {
      try {
        const [generated, tracked] = await Promise.all([
          readFile(path.join(temporaryDirectory, `${slug}.png`)),
          readFile(path.join(outputDirectory, `${slug}.png`))
        ])

        if (!generated.equals(tracked)) {
          errors.push(`${slug}: generated image differs from public/images/og/${slug}.png`)
        }
      } catch {
        errors.push(`${slug}: public/images/og/${slug}.png is missing`)
      }
    }

    for (const slug of trackedSlugs) {
      if (!generatedSlugSet.has(slug)) {
        errors.push(`${slug}: public/images/og/${slug}.png is orphaned`)
      }
    }

    if (errors.length > 0) {
      throw new Error(formatOgCheckError(errors))
    }

    console.log(`Verified ${generatedSlugs.length} OG images.`)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

export function formatOgCheckError(errors: string[]) {
  return `${[...errors].sort().join('\n')}\nRun \`npm run og\` to regenerate OG images.`
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
