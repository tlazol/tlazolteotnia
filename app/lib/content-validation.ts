import { marked, type Tokens } from 'marked'
import type { BlogPostRecord } from '~/lib/blog-post'
import { siteOrigin } from '~/lib/site'

export type ContentValidationIssue = {
  path: string
  reference: string
  message: string
}

export type ContentValidationInput = {
  posts: BlogPostRecord[]
  publicImagePaths: Set<string>
  ogImageSlugs: Set<string>
}

const allowedProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function validateContent({
  posts,
  publicImagePaths,
  ogImageSlugs
}: ContentValidationInput): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = []
  const publishedSlugs = new Set(posts.filter((post) => !post.draft).map((post) => post.slug))
  const draftSlugs = new Set(posts.filter((post) => post.draft).map((post) => post.slug))

  for (const post of posts) {
    marked.walkTokens(marked.lexer(post.body), (token) => {
      if (token.type === 'link') {
        validateLink(token as Tokens.Link, post, publishedSlugs, draftSlugs, issues)
      }

      if (token.type === 'image') {
        validateImage(token as Tokens.Image, post, publicImagePaths, issues)
      }
    })
  }

  for (const slug of publishedSlugs) {
    if (!ogImageSlugs.has(slug)) {
      issues.push({
        path: `content/blog/${slug}.md`,
        reference: `/images/og/${slug}.png`,
        message: 'OG image is missing'
      })
    }
  }

  for (const slug of ogImageSlugs) {
    if (draftSlugs.has(slug)) {
      issues.push({
        path: `public/images/og/${slug}.png`,
        reference: slug,
        message: 'draft posts must not have OG images'
      })
    } else if (!publishedSlugs.has(slug)) {
      issues.push({
        path: `public/images/og/${slug}.png`,
        reference: slug,
        message: 'OG image has no published post'
      })
    }
  }

  return deduplicateAndSortIssues(issues)
}

export function formatContentValidationIssue(issue: ContentValidationIssue) {
  return `${issue.path}: ${issue.reference}: ${issue.message}`
}

function validateLink(
  token: Tokens.Link,
  post: BlogPostRecord,
  publishedSlugs: Set<string>,
  draftSlugs: Set<string>,
  issues: ContentValidationIssue[]
) {
  const url = parseUrl(token.href)

  if (!url) {
    issues.push(invalidReference(post, token.href, 'invalid link URL'))
    return
  }

  if (!allowedProtocols.has(url.protocol)) {
    issues.push(invalidReference(post, token.href, `link protocol is not allowed: ${url.protocol}`))
    return
  }

  if (!token.href.startsWith('/blog/')) {
    return
  }

  const slug = decodeURIComponent(url.pathname.slice('/blog/'.length)).replace(/\/$/, '')

  if (draftSlugs.has(slug)) {
    issues.push(invalidReference(post, token.href, 'link points to a draft post'))
  } else if (!publishedSlugs.has(slug)) {
    issues.push(invalidReference(post, token.href, 'linked public post does not exist'))
  }
}

function validateImage(
  token: Tokens.Image,
  post: BlogPostRecord,
  publicImagePaths: Set<string>,
  issues: ContentValidationIssue[]
) {
  const url = parseUrl(token.href)

  if (!url) {
    issues.push(invalidReference(post, token.href, 'invalid image URL'))
    return
  }

  if (!allowedProtocols.has(url.protocol)) {
    issues.push(
      invalidReference(post, token.href, `image protocol is not allowed: ${url.protocol}`)
    )
    return
  }

  if (token.href.startsWith('/images/') && !publicImagePaths.has(url.pathname)) {
    issues.push(invalidReference(post, token.href, 'local image does not exist'))
  }
}

function parseUrl(reference: string) {
  try {
    return new URL(reference, siteOrigin)
  } catch {
    return null
  }
}

function invalidReference(post: BlogPostRecord, reference: string, message: string) {
  return { path: post.sourcePath, reference, message }
}

function deduplicateAndSortIssues(issues: ContentValidationIssue[]) {
  const uniqueIssues = new Map<string, ContentValidationIssue>()

  for (const issue of issues) {
    uniqueIssues.set(`${issue.path}\0${issue.reference}\0${issue.message}`, issue)
  }

  return [...uniqueIssues.values()].sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.reference.localeCompare(b.reference) ||
      a.message.localeCompare(b.message)
  )
}
