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
let documents: Record<BlogFeedFormat, string> | undefined

export function createBlogFeedResponse(format: BlogFeedFormat) {
  documents ??= buildBlogFeedDocuments()

  return new Response(documents[format], {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': `application/${format}+xml; charset=utf-8`
    }
  })
}

function buildBlogFeedDocuments(): Record<BlogFeedFormat, string> {
  const posts = getBlogFeedPosts()
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
