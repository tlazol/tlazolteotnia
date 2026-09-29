import { createFileRoute } from '@tanstack/react-router'
import { ArticleContent } from '#/components/article-content'
import { BackToBoard } from '#/components/back-to-board'
import { SiteHeader } from '#/components/site-header'
import { getPostData } from '#/lib/blog.functions'
import type { BlogPost as BlogPostData } from '#/lib/blog-post'
import { getPostAccent } from '#/lib/post-accent'
import { requireRouteData } from '#/lib/route-helpers'
import {
  copyrightCurrentYear,
  getBlogPostOgImageUrl,
  getBlogPostUrl,
  getCopyrightText,
  siteName
} from '#/lib/site'

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) =>
    requireRouteData(await getPostData({ data: { slug: params.slug } })),
  head: ({ loaderData }) => ({ meta: getPostMeta(loaderData?.post) }),
  component: BlogPost
})

function getPostMeta(post?: BlogPostData) {
  const title = post ? `${post.title} | ${siteName}` : 'Post not found'
  const description = post?.description ?? `A note from ${siteName}.`
  const postUrl = post ? getBlogPostUrl(post.slug) : undefined
  const imageUrl = post ? getBlogPostOgImageUrl(post.slug) : undefined
  const imageAlt = post ? `${post.title} | ${siteName}` : undefined
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'article' },
    ...(postUrl ? [{ property: 'og:url', content: postUrl }] : []),
    ...(imageUrl && imageAlt
      ? [
          { property: 'og:image', content: imageUrl },
          { property: 'og:image:type', content: 'image/png' },
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' },
          { property: 'og:image:alt', content: imageAlt }
        ]
      : []),
    { name: 'twitter:card', content: post ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...(imageUrl && imageAlt
      ? [
          { name: 'twitter:image', content: imageUrl },
          { name: 'twitter:image:alt', content: imageAlt }
        ]
      : [])
  ]
}

function BlogPost() {
  const { post, reactions } = Route.useLoaderData()
  return (
    <>
      <SiteHeader />
      <main className="article-page" data-post-accent={getPostAccent(post.slug)}>
        <BackToBoard />
        <ArticleContent key={post.slug} post={post} reactions={reactions} />
        <footer className="article-footer">
          <BackToBoard />
          <small>{getCopyrightText(copyrightCurrentYear)}</small>
        </footer>
      </main>
    </>
  )
}
