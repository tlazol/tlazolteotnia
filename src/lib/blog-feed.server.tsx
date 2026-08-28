import { Feed } from 'feed'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownBody } from '#/components/markdown-body'
import { getBlogFeedPosts } from '#/lib/blog.server'
import {
  authorName,
  copyrightCurrentYear,
  getAbsoluteUrl,
  getBlogPostUrl,
  getCopyrightText,
  siteName,
  siteOrigin
} from '#/lib/site'

export type BlogFeedFormat = 'atom' | 'rss'

const feedDescription = `Personal site and notes from ${authorName} / ${siteName}.`
const feedUrls = {
  atom: getAbsoluteUrl('/atom.xml'),
  rss: getAbsoluteUrl('/rss.xml')
}
let blogFeedDocumentsPromise: Promise<Record<BlogFeedFormat, string>> | null = null

export async function createBlogFeedResponse(format: BlogFeedFormat) {
  const documents = await getBlogFeedDocuments()

  return new Response(documents[format], {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': `application/${format}+xml; charset=utf-8`
    }
  })
}

async function getBlogFeedDocuments() {
  blogFeedDocumentsPromise ??= buildBlogFeedDocuments().catch((error) => {
    blogFeedDocumentsPromise = null
    throw error
  })

  return blogFeedDocumentsPromise
}

async function buildBlogFeedDocuments(): Promise<Record<BlogFeedFormat, string>> {
  const posts = await getBlogFeedPosts()
  const updated = toFeedDate(posts[0]?.date ?? '1970-01-01')
  const feed = new Feed({
    title: siteName,
    id: siteOrigin,
    link: siteOrigin,
    description: feedDescription,
    language: 'ja-JP',
    updated,
    generator: siteName,
    feedLinks: feedUrls,
    image: getAbsoluteUrl('/favicon.png'),
    favicon: getAbsoluteUrl('/favicon.ico'),
    copyright: getCopyrightText(copyrightCurrentYear),
    author: { name: authorName, link: siteOrigin }
  })

  for (const post of posts) {
    const postUrl = getBlogPostUrl(post.slug)
    const published = toFeedDate(post.date)

    feed.addItem({
      title: post.title,
      id: postUrl,
      link: postUrl,
      date: published,
      published,
      description: post.description,
      content: renderToStaticMarkup(<MarkdownBody body={post.body} baseUrl={postUrl} />),
      author: [{ name: authorName, link: siteOrigin }],
      category: post.tags.map((tag) => ({ name: tag, term: tag }))
    })
  }

  return { atom: feed.atom1(), rss: feed.rss2() }
}

function toFeedDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}
