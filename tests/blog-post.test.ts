import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  BlogPostValidationError,
  parseBlogPost,
  parseBlogPosts,
  sortBlogPostsNewestFirst
} from '../app/lib/blog-post'

const validFrontmatter = [
  '---',
  'title: "A post"',
  'date: "2026-05-15"',
  'description: "A description"',
  'tags: ["React", "Diary"]',
  'draft: false',
  '---',
  'Post body.'
].join('\n')

describe('blog post parser', () => {
  it('parses published and draft posts with LF and CRLF', () => {
    const published = parseBlogPost(validFrontmatter, 'content/blog/published.md')
    const draft = parseBlogPost(
      validFrontmatter.replace('draft: false', 'draft: true').replaceAll('\n', '\r\n'),
      'content/blog/draft.md'
    )

    expect(published).toMatchObject({
      slug: 'published',
      title: 'A post',
      date: '2026-05-15',
      description: 'A description',
      tags: ['React', 'Diary'],
      draft: false,
      body: 'Post body.'
    })
    expect(draft).toMatchObject({ slug: 'draft', draft: true, body: 'Post body.' })
  })

  it('reports missing frontmatter separately from YAML errors', () => {
    expectValidationError('No frontmatter', 'frontmatter block is required')
    expectValidationError('---\ntitle: [\n---\nBody', 'YAML:')
  })

  it.each([
    'title',
    'date',
    'description',
    'tags',
    'draft'
  ])('reports a missing %s field with the path and field name', (field) => {
    const source = validFrontmatter.replace(new RegExp(`^${field}:.*\\n`, 'm'), '')
    expectValidationError(source, `content/blog/example.md: ${field}:`)
  })

  it('rejects invalid dates and impossible calendar dates', () => {
    expectValidationError(validFrontmatter.replace('2026-05-15', '15/05/2026'), 'YYYY-MM-DD')
    expectValidationError(validFrontmatter.replace('2026-05-15', '2026-02-30'), 'real calendar')
  })

  it('rejects invalid tags, string booleans, unknown fields, and empty published bodies', () => {
    expectValidationError(
      validFrontmatter.replace('["React", "Diary"]', '["React", 1]'),
      'contain only strings'
    )
    expectValidationError(
      validFrontmatter.replace('["React", "Diary"]', '["React", "React"]'),
      'duplicate tag'
    )
    expectValidationError(validFrontmatter.replace('draft: false', 'draft: "false"'), 'draft:')
    expectValidationError(
      validFrontmatter.replace('draft: false', 'extra: true\ndraft: false'),
      'extra:'
    )
    expectValidationError(validFrontmatter.replace('Post body.', '  '), 'body:')
  })

  it('collects errors from every file and rejects duplicate slugs', () => {
    expect(() =>
      parseBlogPosts([
        { path: 'content/blog/one.md', source: 'invalid' },
        { path: 'content/elsewhere/one.md', source: validFrontmatter },
        { path: 'content/blog/one.md', source: validFrontmatter }
      ])
    ).toThrow(/content\/blog\/one\.md[\s\S]*content\/blog\/one\.md|duplicate slug/)
  })

  it('preserves every current public slug in newest-first order', async () => {
    const filenames = (await readdir('content/blog')).filter((filename) => filename.endsWith('.md'))
    const posts = parseBlogPosts(
      await Promise.all(
        filenames.map(async (filename) => ({
          path: `content/blog/${filename}`,
          source: await readFile(`content/blog/${filename}`, 'utf8')
        }))
      )
    )

    expect(
      sortBlogPostsNewestFirst(posts.filter((post) => !post.draft)).map((post) => post.slug)
    ).toEqual([
      'why-not-just-try-yourself',
      'still-dont-know-best-way-to-count-documents-in-documentdb',
      'migration-to-cloudflare',
      'chaos-zero-nightmare-is-good',
      'react-router-renewal',
      'gpt-english-email-tips',
      'langchain-typescript-chatgpt-search',
      'gpt4-tetris-prompt',
      'sveltekit-third-party-script-chatgpt',
      'sveltekit-third-party-script',
      'resume-writing-notes',
      'sveltekit-vercel-renewal',
      'perspective-drawing-introduction',
      'css-centering-five-ways',
      'lambdatest-e2e-platform',
      'dialogflow-actions-builder-simulator-version',
      'cypress-form-whoops-no-test',
      'frontend-engineer-or-javascript-engineer',
      'max-width-parent-layout',
      'css-currentcolor',
      'glassmorphism-site-lessons',
      'rpg-attack-logic',
      'glassmorphism-lessons',
      'firestore-like-button-data-structure',
      'svelte-multiple-script-tags',
      'online-english-conversation',
      'firebase-multiple-project-initialize',
      'localization-writing-structure',
      'firebase-contentful-markdown-blog',
      'svelte-express-ssr',
      'better-output-structure',
      'dialogflow-actions-builder-migration',
      'better-output-ten-tips',
      'google-tag-manager-overview',
      'actions-builder-transactions-migration',
      'multiple-pwa-service-workers-domain',
      'google-assistant-actions-lessons',
      'ssml-speakable-characters',
      'vui-idle-hack-and-slash-rpg',
      'google-assistant-vui-design',
      'vue-lightsout-game',
      'nightmarejs-phantomjs-puppeteer-performance'
    ])
  })
})

function expectValidationError(source: string, message: string) {
  try {
    parseBlogPost(source, 'content/blog/example.md')
    throw new Error('Expected parsing to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(BlogPostValidationError)
    expect((error as Error).message).toContain(message)
  }
}
