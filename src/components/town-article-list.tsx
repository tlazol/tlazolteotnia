import { Link } from '@tanstack/react-router'
import type { MouseEvent, Ref } from 'react'
import { useEffect, useState } from 'react'
import type { BlogPostSummary } from '#/lib/blog-post'

export function TownArticleList({
  visiblePosts,
  newestSlug,
  topic,
  q,
  loading,
  ready,
  failed,
  listVisible,
  listToggle,
  listHeading,
  onToggle,
  onClose,
  onSearch,
  openPost
}: {
  visiblePosts: BlogPostSummary[]
  newestSlug?: string
  topic: string
  q: string
  loading: boolean
  ready: boolean
  failed: boolean
  listVisible: boolean
  listToggle: Ref<HTMLButtonElement>
  listHeading: Ref<HTMLHeadingElement>
  onToggle: () => void
  onClose: () => void
  onSearch: (query: string) => void
  openPost: (event: MouseEvent<HTMLAnchorElement>, post: BlogPostSummary) => void
}) {
  const [query, setQuery] = useState(q)
  useEffect(() => setQuery(q), [q])
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
        <span aria-hidden="true">☷</span> 記事一覧 <small>{visiblePosts.length}</small>
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
              記事一覧 <small>{visiblePosts.length}</small>
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
        <form
          className="town-search"
          onSubmit={(event) => {
            event.preventDefault()
            onSearch(query)
          }}
        >
          <input
            type="search"
            aria-label="記事を検索"
            placeholder="タイトルやキーワードで探す"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit">検索</button>
        </form>
        {(topic || q) && (
          <div className="town-list__filter">
            <span>{[topic, q].filter(Boolean).join(' / ')}</span>
            <Link to="/" search={{}} replace>
              絞り込みを解除 ×
            </Link>
          </div>
        )}
        <div className="town-list__posts">
          {visiblePosts.map((post) => (
            <Link
              key={post.slug}
              to="/blog/$slug"
              params={{ slug: post.slug }}
              preload={false}
              aria-haspopup="dialog"
              onClick={(event) => openPost(event, post)}
            >
              <span>{post.title}</span>
              <div>
                <time dateTime={post.date}>{post.date.replaceAll('-', '.')}</time>
                {post.slug === newestSlug && <small>New</small>}
                <span aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
          {!visiblePosts.length && <p role="status">該当する記事がありません。</p>}
        </div>
      </section>
    </>
  )
}
