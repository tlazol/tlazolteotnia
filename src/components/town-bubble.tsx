import { Link } from '@tanstack/react-router'
import type { MouseEvent, Ref } from 'react'
import type { BlogPostSummary } from '#/lib/blog-post'
import type { SceneSize } from '#/lib/scene-math'

// Above the resident's head when it fits, otherwise below its feet; always on screen.
export function placeTownBubble(
  point: { x: number; y: number; bottom: number },
  bubble: SceneSize,
  viewport: SceneSize
) {
  const left = Math.max(
    12,
    Math.min(viewport.width - bubble.width - 12, point.x - bubble.width / 2)
  )
  const above = point.y - bubble.height - 18 >= 76
  const top = Math.max(
    76,
    Math.min(
      viewport.height - bubble.height - 90,
      above ? point.y - bubble.height - 18 : point.bottom + 18
    )
  )
  return { left, top, above, tail: Math.max(22, Math.min(bubble.width - 22, point.x - left)) }
}

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
  openPost: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <div ref={bubble} id="town-bubble" className="town-bubble" data-side="above" data-island-ui>
      <div className="town-bubble__meta">
        <time dateTime={post.date}>{post.date.replaceAll('-', '.')}</time>
        {post.slug === newestSlug && <span>NEW</span>}
        <button type="button" aria-label="吹き出しを閉じる" onClick={onClose}>
          ×
        </button>
      </div>
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        preload={false}
        aria-haspopup="dialog"
        onClick={openPost}
      >
        <span className="town-bubble__title">{post.title}</span>
        <span className="town-bubble__description">{post.description}</span>
        <span className="town-bubble__read">
          記事を読む <span aria-hidden="true">↗</span>
        </span>
      </Link>
    </div>
  )
}
