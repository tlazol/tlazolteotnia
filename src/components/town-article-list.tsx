import { Link } from '@tanstack/react-router'
import type { MouseEvent } from 'react'
import type { BlogPostSummary } from '#/lib/blog-post'

export function TownArticleList({
  posts,
  newestSlug,
  failed,
  openPost
}: {
  posts: BlogPostSummary[]
  newestSlug?: string
  failed: boolean
  openPost: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <section className="town-list" aria-labelledby="town-list-heading">
      <h2 id="town-list-heading">
        記事一覧 <small>{posts.length}</small>
      </h2>
      {failed && (
        <p role="status" className="town-list__status">
          島を表示できないため、記事一覧を表示しています。
        </p>
      )}
      <div className="town-list__posts">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to="/blog/$slug"
            params={{ slug: post.slug }}
            preload={false}
            aria-haspopup="dialog"
            onClick={openPost}
          >
            <span>{post.title}</span>
            {post.slug === newestSlug && <small>New</small>}
          </Link>
        ))}
        {!posts.length && <p role="status">記事がありません。</p>}
      </div>
    </section>
  )
}
