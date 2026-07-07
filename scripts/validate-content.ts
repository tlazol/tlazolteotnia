import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BlogPostValidationError, parseBlogPosts } from '../app/lib/blog-post'
import { formatContentValidationIssue, validateContent } from '../app/lib/content-validation'

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentDirectory = path.join(projectDirectory, 'content/blog')
const imagesDirectory = path.join(projectDirectory, 'public/images')
const ogDirectory = path.join(imagesDirectory, 'og')

export async function validateProjectContent() {
  const filenames = (await readdir(contentDirectory))
    .filter((filename) => filename.endsWith('.md'))
    .sort()
  const sources = await Promise.all(
    filenames.map(async (filename) => ({
      path: `content/blog/${filename}`,
      source: await readFile(path.join(contentDirectory, filename), 'utf8')
    }))
  )
  const posts = parseBlogPosts(sources)
  const publicImagePaths = new Set(
    (await readdir(imagesDirectory, { recursive: true }))
      .filter((filename) => typeof filename === 'string')
      .map((filename) => `/images/${filename.split(path.sep).join('/')}`)
  )
  const ogImageSlugs = new Set(
    (await readdir(ogDirectory))
      .filter((filename) => filename.endsWith('.png'))
      .map((filename) => filename.slice(0, -'.png'.length))
  )
  const issues = validateContent({ posts, publicImagePaths, ogImageSlugs })

  if (issues.length > 0) {
    throw new Error(issues.map(formatContentValidationIssue).join('\n'))
  }

  return posts
}

validateProjectContent()
  .then((posts) => {
    console.log(`Validated ${posts.length} blog posts.`)
  })
  .catch((error: unknown) => {
    if (error instanceof BlogPostValidationError) {
      console.error(error.message)
    } else {
      console.error(error instanceof Error ? error.message : error)
    }

    process.exitCode = 1
  })
