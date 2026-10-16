import { Link } from '@tanstack/react-router'
import type { MouseEvent, Ref } from 'react'
import type { BlogPostSummary } from '#/lib/blog-post'

export function TownBubble({
  post,
  newestSlug,
  bubble,
  onClose,
  openPost
}: {
  post: BlogPostSummary
  newestSlug?: string
  bubble: Ref<HTMLDivElement>
  onClose: () => void
  openPost: (event: MouseEvent<HTMLAnchorElement>, post: BlogPostSummary) => void
}) {
  return (
    <div ref={bubble} id="town-bubble" className="town-bubble" data-side="above">
      <div className="town-bubble__meta">
        <time dateTime={post.date}>{post.date.replaceAll('-', '.')}</time>
        {post.slug === newestSlug && <span>New</span>}
        <button type="button" aria-label="吹き出しを閉じる" onClick={onClose}>
          ×
        </button>
      </div>
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        preload={false}
        aria-haspopup="dialog"
        onClick={(event) => openPost(event, post)}
      >
        <span className="town-bubble__title">{post.title}</span>
        <span className="town-bubble__read">
          記事を読む <span aria-hidden="true">↗</span>
        </span>
      </Link>
    </div>
  )
}
