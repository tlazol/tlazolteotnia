import { createFileRoute, getRouteApi, notFound } from '@tanstack/react-router'
import { ArticleContent } from '#/components/article-content'
import { getPostData } from '#/lib/blog.functions'
import { isValidSlug } from '#/lib/blog-slug'
import { getRelatedPosts } from '#/lib/related-posts'
import { requireRouteData } from '#/lib/route-helpers'
import { getPostHead } from '#/lib/seo'

// Rendered inside the town's post modal by the _town layout.
export const Route = createFileRoute('/_town/blog/$slug')({
  loader: async ({ params }) => {
    // Malformed slugs can never match a post, so treat them as missing too.
    if (!isValidSlug(params.slug)) throw notFound()
    return requireRouteData(await getPostData({ data: { slug: params.slug } }))
  },
  head: ({ loaderData }) => getPostHead(loaderData?.post),
  component: BlogPost,
  errorComponent: BlogPostError
})

function BlogPost() {
  const { post } = Route.useLoaderData()
  const { posts } = getRouteApi('/_town').useLoaderData()
  return <ArticleContent key={post.slug} post={post} relatedPosts={getRelatedPosts(post, posts)} />
}

function BlogPostError() {
  return (
    <p className="post-modal__status" role="alert">
      記事を読み込めませんでした。時間をおいてもう一度お試しください。
    </p>
  )
}
