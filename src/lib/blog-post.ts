import { parse as parseYaml } from 'yaml'

export type BlogPost = {
  slug: string
  title: string
  date: string
  description: string
  tags: string[]
  body: string
}

export type BlogPostSummary = Omit<BlogPost, 'body'>

export type BlogPostRecord = BlogPost & {
  draft: boolean
  sourcePath: string
}

export type BlogSource = {
  path: string
  source: string
}

type ValidationIssueKind = 'frontmatter' | 'yaml'

export type BlogPostValidationIssue = {
  path: string
  field: string
  kind: ValidationIssueKind
  message: string
}

export class BlogPostValidationError extends Error {
  readonly issues: BlogPostValidationIssue[]

  constructor(issues: BlogPostValidationIssue[]) {
    const sortedIssues = [...issues].sort(
      (a, b) =>
        a.path.localeCompare(b.path) ||
        a.field.localeCompare(b.field) ||
        a.message.localeCompare(b.message)
    )

    super(sortedIssues.map(formatBlogPostValidationIssue).join('\n'))
    this.name = 'BlogPostValidationError'
    this.issues = sortedIssues
  }
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const allowedFrontmatterFields = new Set(['title', 'date', 'description', 'tags', 'draft'])

export function parseBlogPost(source: string, sourcePath: string): BlogPostRecord {
  const issues: BlogPostValidationIssue[] = []
  const slug = getSlug(sourcePath)
  const match = frontmatterPattern.exec(source)

  if (!match) {
    throw new BlogPostValidationError([
      issue(sourcePath, 'frontmatter', 'frontmatter block is required')
    ])
  }

  let frontmatter: unknown

  try {
    frontmatter = parseYaml(match[1])
  } catch (error) {
    throw new BlogPostValidationError([
      issue(
        sourcePath,
        'frontmatter',
        error instanceof Error ? error.message.split('\n')[0] : 'invalid YAML',
        'yaml'
      )
    ])
  }

  if (!isRecord(frontmatter)) {
    throw new BlogPostValidationError([issue(sourcePath, 'frontmatter', 'must be a YAML mapping')])
  }

  for (const field of Object.keys(frontmatter)) {
    if (!allowedFrontmatterFields.has(field)) {
      issues.push(issue(sourcePath, field, 'unknown frontmatter field'))
    }
  }

  const title = requiredNonBlankString(frontmatter.title, sourcePath, 'title', issues)
  const date = requiredDate(frontmatter.date, sourcePath, issues)
  const description = requiredNonBlankString(
    frontmatter.description,
    sourcePath,
    'description',
    issues
  )
  const tags = requiredTags(frontmatter.tags, sourcePath, issues)
  const draft = requiredBoolean(frontmatter.draft, sourcePath, 'draft', issues)
  const body = source.slice(match[0].length)

  if (!slug) {
    issues.push(issue(sourcePath, 'slug', 'Markdown filename must produce a non-empty slug'))
  }

  if (draft === false && !body.trim()) {
    issues.push(issue(sourcePath, 'body', 'published post body must not be empty'))
  }

  if (issues.length > 0) {
    throw new BlogPostValidationError(issues)
  }

  return {
    slug,
    title: title as string,
    date: date as string,
    description: description as string,
    tags: tags as string[],
    draft: draft as boolean,
    body,
    sourcePath
  }
}

export function parseBlogPosts(sources: BlogSource[]): BlogPostRecord[] {
  const posts: BlogPostRecord[] = []
  const issues: BlogPostValidationIssue[] = []

  for (const { path, source } of sources) {
    try {
      posts.push(parseBlogPost(source, path))
    } catch (error) {
      if (error instanceof BlogPostValidationError) {
        issues.push(...error.issues)
      } else {
        throw error
      }
    }
  }

  const postsBySlug = new Map<string, BlogPostRecord[]>()

  for (const post of posts) {
    const matchingPosts = postsBySlug.get(post.slug) ?? []
    matchingPosts.push(post)
    postsBySlug.set(post.slug, matchingPosts)
  }

  for (const [slug, matchingPosts] of postsBySlug) {
    if (matchingPosts.length < 2) {
      continue
    }

    for (const post of matchingPosts) {
      issues.push(issue(post.sourcePath, 'slug', `duplicate slug: ${slug}`))
    }
  }

  if (issues.length > 0) {
    throw new BlogPostValidationError(issues)
  }

  return posts
}

export function toPublicBlogPost(post: BlogPostRecord): BlogPost {
  const { draft: _draft, sourcePath: _sourcePath, ...publicPost } = post
  return publicPost
}

export function sortBlogPostsNewestFirst<Post extends { date: string }>(posts: Post[]) {
  return [...posts].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

export function formatBlogPostValidationIssue(issue: BlogPostValidationIssue) {
  const label = issue.kind === 'yaml' ? 'YAML' : issue.field
  return `${issue.path}: ${label}: ${issue.message}`
}

function requiredNonBlankString(
  value: unknown,
  path: string,
  field: string,
  issues: BlogPostValidationIssue[]
) {
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(issue(path, field, 'must be a non-blank string'))
    return undefined
  }

  return value
}

function requiredDate(value: unknown, path: string, issues: BlogPostValidationIssue[]) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    issues.push(issue(path, 'date', 'must use YYYY-MM-DD format'))
    return undefined
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    issues.push(issue(path, 'date', 'must be a real calendar date'))
    return undefined
  }

  return value
}

function requiredTags(value: unknown, path: string, issues: BlogPostValidationIssue[]) {
  if (!Array.isArray(value)) {
    issues.push(issue(path, 'tags', 'must be an array of strings'))
    return undefined
  }

  const tags: string[] = []
  const seen = new Set<string>()

  for (const tag of value) {
    if (typeof tag !== 'string') {
      issues.push(issue(path, 'tags', 'must contain only strings'))
      continue
    }

    if (!tag.trim()) {
      issues.push(issue(path, 'tags', 'must not contain blank tags'))
      continue
    }

    if (seen.has(tag)) {
      issues.push(issue(path, 'tags', `duplicate tag: ${tag}`))
      continue
    }

    seen.add(tag)
    tags.push(tag)
  }

  return tags
}

function requiredBoolean(
  value: unknown,
  path: string,
  field: string,
  issues: BlogPostValidationIssue[]
) {
  if (typeof value !== 'boolean') {
    issues.push(issue(path, field, 'must be a boolean'))
    return undefined
  }

  return value
}

function getSlug(sourcePath: string) {
  return sourcePath.split('/').at(-1)?.replace(/\.md$/, '') ?? ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(
  path: string,
  field: string,
  message: string,
  kind: ValidationIssueKind = 'frontmatter'
): BlogPostValidationIssue {
  return { path, field, kind, message }
}
