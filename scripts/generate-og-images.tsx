import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { parse as parseYaml } from 'yaml'
import { siteName } from '../app/lib/site'

const imageWidth = 1200
const imageHeight = 630
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(scriptDirectory, '..')
const contentDirectory = path.join(projectDirectory, 'content/blog')
const outputDirectory = path.join(projectDirectory, 'public/images/og')
const fontPath = path.join(scriptDirectory, 'assets/NotoSansCJKjp-Bold.otf')

type BlogPost = {
  slug: string
  title: string
  draft: boolean
}

type BlogFrontmatter = {
  title?: unknown
  draft?: unknown
}

async function main() {
  const requestedSlugs = process.argv.slice(2)

  if (requestedSlugs.length > 1) {
    throw new Error('Usage: npm run generate:og -- [slug]')
  }

  const posts = await readPosts()
  const requestedSlug = requestedSlugs[0]
  const targetPosts = requestedSlug
    ? [findRequestedPost(posts, requestedSlug)]
    : posts.filter(notDraft)
  const font = await readFile(fontPath)

  await mkdir(outputDirectory, { recursive: true })

  for (const post of targetPosts) {
    const svg = await renderSvg(post.title, font)
    const png = new Resvg(svg, {
      fitTo: { mode: 'original' },
      font: { loadSystemFonts: false }
    })
      .render()
      .asPng()
    const outputPath = path.join(outputDirectory, `${post.slug}.png`)

    await writeFile(outputPath, png)
    console.log(`Generated ${path.relative(projectDirectory, outputPath)}`)
  }
}

async function readPosts(): Promise<BlogPost[]> {
  const entries = await readdir(contentDirectory, { withFileTypes: true })
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()

  return Promise.all(filenames.map(readPost))
}

async function readPost(filename: string): Promise<BlogPost> {
  const source = await readFile(path.join(contentDirectory, filename), 'utf8')
  const frontmatter = parseFrontmatter(source, filename)
  const slug = filename.replace(/\.md$/, '')

  return {
    slug,
    title:
      typeof frontmatter.title === 'string' && frontmatter.title.trim() ? frontmatter.title : slug,
    draft: frontmatter.draft === true
  }
}

function parseFrontmatter(source: string, filename: string): BlogFrontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)

  if (!match) {
    throw new Error(`Frontmatter not found in content/blog/${filename}`)
  }

  const frontmatter = parseYaml(match[1])

  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error(`Invalid frontmatter in content/blog/${filename}`)
  }

  return frontmatter as BlogFrontmatter
}

function findRequestedPost(posts: BlogPost[], slug: string) {
  const post = posts.find((candidate) => candidate.slug === slug)

  if (!post) {
    throw new Error(`Post not found: ${slug}`)
  }

  if (post.draft) {
    throw new Error(`Post is a draft: ${slug}`)
  }

  return post
}

function notDraft(post: BlogPost) {
  return !post.draft
}

function getTitleFontSize(title: string) {
  const length = [...title].length

  if (length <= 32) {
    return 76
  }

  if (length <= 52) {
    return 64
  }

  return 52
}

async function renderSvg(title: string, font: Buffer) {
  const titleFontSize = getTitleFontSize(title)
  const signalColors = ['#2dacf9', '#ff3c32', '#fa73da', '#ffdf5f', '#31ff80']

  return satori(
    <div
      style={{
        width: imageWidth,
        height: imageHeight,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: '#020403',
        color: '#d8e8dd',
        fontFamily: 'Noto Sans JP',
        fontWeight: 700
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 32,
          right: 32,
          bottom: 32,
          left: 32,
          display: 'flex',
          border: '1px solid #163923',
          background: '#07100b'
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 58,
          bottom: 58,
          left: 58,
          width: 10,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {signalColors.map((color) => (
          <div key={color} style={{ display: 'flex', height: '20%', background: color }} />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 58,
          right: 58,
          left: 88,
          height: 1,
          display: 'flex',
          background: '#163923'
        }}
      />

      <div
        style={{
          position: 'absolute',
          right: 58,
          bottom: 58,
          left: 88,
          height: 1,
          display: 'flex',
          background: '#163923'
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 100,
          right: 116,
          bottom: 150,
          left: 142,
          display: 'flex',
          alignItems: 'center',
          color: '#9cffbf',
          fontSize: titleFontSize,
          lineHeight: 1.18,
          letterSpacing: '-0.035em',
          overflowWrap: 'anywhere'
        }}
      >
        {title}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 92,
          left: 142,
          display: 'flex',
          alignItems: 'center',
          color: '#89a194',
          fontSize: 25,
          letterSpacing: '0.08em'
        }}
      >
        <span style={{ marginRight: 12, color: '#ffdf5f' }}>$</span>
        {siteName}
      </div>
    </div>,
    {
      width: imageWidth,
      height: imageHeight,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: font,
          weight: 700,
          style: 'normal'
        }
      ]
    }
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
