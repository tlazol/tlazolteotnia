import { Link } from '@tanstack/react-router'
import type { MouseEvent, Ref } from 'react'
import type { BlogPostSummary } from '#/lib/blog-post'

export function TownArticleList({
  posts,
  newestSlug,
  loading,
  ready,
  failed,
  listVisible,
  listToggle,
  listHeading,
  onToggle,
  onClose,
  openPost
}: {
  posts: BlogPostSummary[]
  newestSlug?: string
  loading: boolean
  ready: boolean
  failed: boolean
  listVisible: boolean
  listToggle: Ref<HTMLButtonElement>
  listHeading: Ref<HTMLHeadingElement>
  onToggle: () => void
  onClose: () => void
  openPost: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <>
      <button
        ref={listToggle}
        className="town-list-toggle"
        type="button"
        aria-expanded={listVisible}
        aria-controls="town-article-list"
        disabled={loading}
        onClick={onToggle}
      >
        <span aria-hidden="true">
          <svg viewBox="0 0 16 14" width="16" height="14" fill="currentColor">
            <path d="M0 0h7v2H0zM9 0h7v2H9zM0 6h7v2H0zM9 6h7v2H9zM0 12h7v2H0zM9 12h7v2H9z" />
          </svg>
        </span>
        記事一覧 <small>{posts.length}</small>
      </button>
      <section
        id="town-article-list"
        className="town-list"
        aria-labelledby="town-list-heading"
        hidden={!listVisible}
      >
        <div className="town-list__heading">
          <div>
            <span className="town-list__eyebrow">NOTES FROM THE TOWN</span>
            <h2 ref={listHeading} id="town-list-heading" tabIndex={-1}>
              記事一覧 <small>{posts.length}</small>
            </h2>
          </div>
          {ready && (
            <button type="button" aria-label="記事一覧を閉じる" onClick={onClose}>
              ×
            </button>
          )}
        </div>
        {failed && (
          <p role="status" className="town-list__status">
            街を表示できないため、記事一覧を表示しています。
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
              <div>
                <time dateTime={post.date}>{post.date.replaceAll('-', '.')}</time>
                {post.slug === newestSlug && <small>New</small>}
                <span aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
          {!posts.length && <p role="status">記事がありません。</p>}
        </div>
      </section>
    </>
  )
}
