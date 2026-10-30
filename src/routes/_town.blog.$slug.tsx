import { createFileRoute } from '@tanstack/react-router'
import { ArticleContent } from '#/components/article-content'
import { getPostData } from '#/lib/blog.functions'
import type { BlogPost as BlogPostData } from '#/lib/blog-post'
import { requireRouteData } from '#/lib/route-helpers'
import { getBlogPostOgImageUrl, getBlogPostUrl, siteName } from '#/lib/site'

// Rendered inside the town's post modal by the _town layout.
export const Route = createFileRoute('/_town/blog/$slug')({
  loader: async ({ params }) =>
    requireRouteData(await getPostData({ data: { slug: params.slug } })),
  head: ({ loaderData }) => ({ meta: getPostMeta(loaderData?.post) }),
  component: BlogPost,
  errorComponent: BlogPostError
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
  return <ArticleContent key={post.slug} post={post} reactions={reactions} />
}

function BlogPostError() {
  return (
    <p className="post-modal__status" role="alert">
      記事を読み込めませんでした。時間をおいてもう一度お試しください。
    </p>
  )
}
