import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { createClientOnlyFn } from '@tanstack/react-start'
import { type MouseEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { type BlogPostSummary, sortBlogPostsNewestFirst } from '#/lib/blog-post'
import { shouldOpenPostModal } from '#/lib/post-modal'
import {
  type BoardSize,
  type BoardView,
  boardSession,
  filterStickerPosts,
  zoomBoardAt
} from '#/lib/sticker-board'
import type { createArticleTown, ResidentScreenPosition } from '#/lib/town-articles.client'
import {
  clampTownView,
  fitTown,
  initialTownView,
  layoutTownArticles,
  placeTownBubble
} from '#/lib/town-posts'
import { PostModal } from './post-modal'
import { SiteHeader } from './site-header'

const loadRenderer = createClientOnlyFn(() => import('#/lib/town-articles.client'))
type Point = { x: number; y: number }

export function ArticleTown({ posts }: { posts: BlogPostSummary[] }) {
  const { topic = '', q = '' } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const sorted = useMemo(() => sortBlogPostsNewestFirst(posts), [posts])
  const articles = useMemo(() => layoutTownArticles(sorted), [sorted])
  const visiblePosts = useMemo(() => filterStickerPosts(sorted, topic, q), [sorted, topic, q])
  const [size, setSize] = useState<BoardSize>({ width: 0, height: 0 })
  const [view, setView] = useState<BoardView>({ x: 0, y: 0, zoom: 1 })
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<BlogPostSummary | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [query, setQuery] = useState(q)
  const activePost = visiblePosts.find((post) => post.slug === activeSlug)
  const surface = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const pendingBubbleFocus = useRef<string | null>(null)
  const listToggle = useRef<HTMLButtonElement>(null)
  const listHeading = useRef<HTMLHeadingElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const renderer = useRef<ReturnType<typeof createArticleTown> | null>(null)
  const currentView = useRef(view)
  const previousSize = useRef<BoardSize | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const origin = useRef<Point | null>(null)
  const didDrag = useRef(false)
  const lastPositions = useRef<ResidentScreenPosition[]>([])
  const latest = useRef({ size, activeSlug, topic, q, visiblePosts })
  latest.current = { size, activeSlug, topic, q, visiblePosts }

  function updateView(next: BoardView) {
    const clamped = clampTownView(next, latest.current.size)
    currentView.current = clamped
    setView(clamped)
    boardSession.view = clamped
    boardSession.key = 'town'
  }

  function positionOverlay(positions: ResidentScreenPosition[]) {
    lastPositions.current = positions
    const state = latest.current
    for (const position of positions) {
      const button = buttons.current.get(position.slug)
      if (button) {
        const zoom = currentView.current.zoom
        const width = Math.max(44, 28 * zoom)
        const bodyHeight = (46 / Math.SQRT2) * zoom
        const height = Math.max(44, bodyHeight + 20 * zoom)
        const top = position.y - 10 * zoom - (height - bodyHeight - 20 * zoom) / 2
        button.style.width = `${width}px`
        button.style.height = `${height}px`
        button.style.setProperty('--foot-y', `${position.y + bodyHeight - top}px`)
        button.style.transform = `translate(${position.x - width / 2}px, ${top}px)`
        button.style.visibility = position.visible ? 'visible' : 'hidden'
        button.tabIndex = position.visible ? 0 : -1
      }
      if (position.slug === state.activeSlug && bubble.current) {
        const element = bubble.current
        const placement = placeTownBubble(
          position,
          { width: element.offsetWidth, height: element.offsetHeight },
          state.size
        )
        element.style.left = `${placement.left}px`
        element.style.top = `${placement.top}px`
        element.style.setProperty('--tail-x', `${placement.tail}px`)
        element.dataset.side = placement.above ? 'above' : 'below'
        element.style.visibility = position.visible ? 'visible' : 'hidden'
        if (position.visible && pendingBubbleFocus.current === position.slug) {
          const link = element.querySelector('a')
          link?.focus({ preventScroll: true })
          if (document.activeElement === link) pendingBubbleFocus.current = null
        }
      }
    }
  }

  useEffect(() => {
    const element = surface.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!size.width) return
    const previous = previousSize.current
    const next = previous
      ? {
          ...currentView.current,
          x: currentView.current.x + (size.width - previous.width) / 2,
          y: currentView.current.y + (size.height - previous.height) / 2
        }
      : boardSession.key === 'town' && boardSession.view
        ? boardSession.view
        : initialTownView(size, articles[0])
    previousSize.current = size
    updateView(next)
  }, [size, articles])

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setFailed(false)
    void loadRenderer()
      .then((module) => {
        if (cancelled || !canvas.current) return
        renderer.current = module.createArticleTown(
          canvas.current,
          articles,
          positionOverlay,
          () => {
            setFailed(true)
            setReady(false)
          }
        )
        renderer.current.filter(latest.current.visiblePosts.map((post) => post.slug))
        renderer.current.update(currentView.current, latest.current.size)
        setReady(true)
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Town renderer unavailable', error)
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [articles])

  useEffect(() => {
    renderer.current?.update(view, size)
  }, [view, size, ready])
  useEffect(() => {
    renderer.current?.filter(visiblePosts.map((post) => post.slug))
    setActiveSlug(null)
    renderer.current?.focus(null)
    boardSession.search = { topic: topic || undefined, q: q || undefined }
    setQuery(q)
  }, [visiblePosts, topic, q])
  useEffect(() => {
    pendingBubbleFocus.current = activeSlug
    renderer.current?.select(activeSlug)
    positionOverlay(lastPositions.current)
  }, [activeSlug])
  useEffect(() => {
    if (listOpen) listHeading.current?.focus()
  }, [listOpen])
  useEffect(() => {
    if (!bubble.current) return
    const observer = new ResizeObserver(() => positionOverlay(lastPositions.current))
    observer.observe(bubble.current)
    return () => observer.disconnect()
  }, [activeSlug])
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || selectedPost || document.querySelector('dialog[open]')) return
      if (listOpen) {
        setListOpen(false)
        listToggle.current?.focus()
      } else if (activeSlug) {
        setActiveSlug(null)
        buttons.current.get(activeSlug)?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [activeSlug, selectedPost, listOpen])
  useEffect(() => {
    const element = surface.current
    if (!element || !ready) return
    function wheel(event: WheelEvent) {
      if (event.target instanceof Element && event.target.closest('.town-bubble')) return
      event.preventDefault()
      const rect = element?.getBoundingClientRect()
      if (!rect) return
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? latest.current.size.height : 1)
      updateView(
        zoomBoardAt(currentView.current, Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        })
      )
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [ready])

  function point(event: PointerEvent): Point {
    const rect = surface.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!ready || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('.town-bubble')) {
      didDrag.current = false
      return
    }
    if (!pointers.current.size) {
      didDrag.current = false
      origin.current = point(event)
    }
    pointers.current.set(event.pointerId, point(event))
    if (pointers.current.size > 1) {
      didDrag.current = true
      setDragging(true)
    }
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!ready || !pointers.current.has(event.pointerId)) return
    const previous = [...pointers.current.values()]
    const before = pointers.current.get(event.pointerId)
    if (!before) return
    const next = point(event)
    pointers.current.set(event.pointerId, next)
    if (origin.current && Math.hypot(next.x - origin.current.x, next.y - origin.current.y) > 6)
      didDrag.current = true
    if (!didDrag.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    renderer.current?.focus(null)
    if (pointers.current.size === 2) {
      const after = [...pointers.current.values()]
      const oldCenter = midpoint(previous[0], previous[1])
      const newCenter = midpoint(after[0], after[1])
      const oldDistance = Math.hypot(previous[0].x - previous[1].x, previous[0].y - previous[1].y)
      const newDistance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y)
      const zoomed = zoomBoardAt(
        currentView.current,
        newDistance / Math.max(1, oldDistance),
        oldCenter
      )
      updateView({
        ...zoomed,
        x: zoomed.x + newCenter.x - oldCenter.x,
        y: zoomed.y + newCenter.y - oldCenter.y
      })
    } else
      updateView({
        ...currentView.current,
        x: currentView.current.x + next.x - before.x,
        y: currentView.current.y + next.y - before.y
      })
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!didDrag.current && event.target === event.currentTarget) setActiveSlug(null)
    pointers.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (!pointers.current.size) {
      setDragging(false)
      origin.current = null
    }
  }
  function openPost(event: MouseEvent<HTMLAnchorElement>, post: BlogPostSummary) {
    if (!shouldOpenPostModal(event)) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    setSelectedPost(post)
  }

  return (
    <main className="sticker-page town-page">
      <h1 className="sr-only">記事のある街</h1>
      <SiteHeader />
      <div
        ref={surface}
        className={`sticker-surface${ready ? ' is-ready' : ''}${dragging ? ' is-dragging' : ''}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onLostPointerCapture={(event) => {
          if (event.target === event.currentTarget && pointers.current.has(event.pointerId))
            pointerUp(event)
        }}
        onClickCapture={(event) => {
          if (didDrag.current && event.detail !== 0) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        <canvas ref={canvas} className="sticker-canvas" aria-hidden="true" tabIndex={-1} />
        {ready &&
          visiblePosts.map((post) => (
            <button
              key={post.slug}
              ref={(element) => {
                if (element) buttons.current.set(post.slug, element)
                else buttons.current.delete(post.slug)
              }}
              className={`town-person${post.slug === sorted[0]?.slug ? ' is-new' : ''}`}
              type="button"
              data-slug={post.slug}
              aria-label={`${post.title} の住人に話しかける`}
              aria-expanded={activeSlug === post.slug}
              aria-controls={activeSlug === post.slug ? 'town-bubble' : undefined}
              onClick={() => setActiveSlug(activeSlug === post.slug ? null : post.slug)}
              onPointerEnter={() => {
                if (!pointers.current.size) renderer.current?.focus(post.slug)
              }}
              onPointerLeave={(event) => {
                if (!event.currentTarget.matches(':focus-visible')) renderer.current?.focus(null)
              }}
              onFocus={(event) => {
                if (event.currentTarget.matches(':focus-visible'))
                  renderer.current?.focus(post.slug)
              }}
              onBlur={() => renderer.current?.focus(null)}
            >
              <span className="town-person__ring" aria-hidden="true" />
              {post.slug === sorted[0]?.slug && (
                <span className="town-person__new" aria-hidden="true">
                  New
                </span>
              )}
            </button>
          ))}
        {ready && activePost && (
          <div ref={bubble} id="town-bubble" className="town-bubble" data-side="above">
            <div className="town-bubble__meta">
              <time dateTime={activePost.date}>{activePost.date.replaceAll('-', '.')}</time>
              {activePost.slug === sorted[0]?.slug && <span>New</span>}
              <button
                type="button"
                aria-label="吹き出しを閉じる"
                onClick={() => {
                  setActiveSlug(null)
                  buttons.current.get(activePost.slug)?.focus({ preventScroll: true })
                }}
              >
                ×
              </button>
            </div>
            <Link
              to="/blog/$slug"
              params={{ slug: activePost.slug }}
              preload={false}
              aria-haspopup="dialog"
              onClick={(event) => openPost(event, activePost)}
            >
              <span className="town-bubble__title">{activePost.title}</span>
              <span className="town-bubble__read">
                記事を読む <span aria-hidden="true">↗</span>
              </span>
            </Link>
          </div>
        )}
      </div>
      <button
        ref={listToggle}
        className="town-list-toggle"
        type="button"
        aria-expanded={listOpen || !ready}
        aria-controls="town-article-list"
        onClick={() => setListOpen(!listOpen)}
      >
        <span aria-hidden="true">☷</span> 記事一覧 <small>{visiblePosts.length}</small>
      </button>
      <section
        id="town-article-list"
        className="town-list"
        aria-labelledby="town-list-heading"
        hidden={ready && !listOpen}
      >
        <div className="town-list__heading">
          <div>
            <span className="town-list__eyebrow">NOTES FROM THE TOWN</span>
            <h2 ref={listHeading} id="town-list-heading" tabIndex={-1}>
              記事一覧 <small>{visiblePosts.length}</small>
            </h2>
          </div>
          {ready && (
            <button
              type="button"
              aria-label="記事一覧を閉じる"
              onClick={() => {
                setListOpen(false)
                listToggle.current?.focus()
              }}
            >
              ×
            </button>
          )}
        </div>
        {!ready && (
          <p role="status" className="town-list__status">
            {failed ? '街を表示できないため、記事一覧を表示しています。' : '街を読み込んでいます…'}
          </p>
        )}
        <form
          className="town-search"
          onSubmit={(event) => {
            event.preventDefault()
            void navigate({
              search: { topic: topic || undefined, q: query || undefined },
              replace: true
            })
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
                {post.slug === sorted[0]?.slug && <small>New</small>}
                <span aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
          {!visiblePosts.length && <p role="status">該当する記事がありません。</p>}
        </div>
      </section>
      {ready && !visiblePosts.length && !listOpen && (
        <div className="sticker-empty" role="status">
          <p>該当する記事がありません。</p>
          <Link to="/" search={{}} replace>
            すべての記事に戻る
          </Link>
        </div>
      )}
      <footer className="board-footer town-footer">
        <div className="board-caption">
          <span className="board-caption__dot" />
          <span>{String(visiblePosts.length).padStart(2, '0')} 記事</span>
          <span className="town-instruction">人をクリックして記事を読む</span>
          {(topic || q) && (
            <Link to="/" search={{}} replace aria-label="絞り込みを解除">
              解除 ×
            </Link>
          )}
        </div>
        {ready && (
          <fieldset className="board-controls" aria-label="街の表示操作">
            <button
              type="button"
              aria-label="縮小"
              onClick={() =>
                updateView(zoomBoardAt(view, 1 / 1.25, { x: size.width / 2, y: size.height / 2 }))
              }
            >
              −
            </button>
            <span>{Math.round(view.zoom * 100)}%</span>
            <button
              type="button"
              aria-label="拡大"
              onClick={() =>
                updateView(zoomBoardAt(view, 1.25, { x: size.width / 2, y: size.height / 2 }))
              }
            >
              +
            </button>
            <button type="button" aria-label="全体表示" onClick={() => updateView(fitTown(size))}>
              ⛶
            </button>
            <button
              type="button"
              aria-label="初期位置に戻る"
              onClick={() => updateView(initialTownView(size, articles[0]))}
            >
              ↺
            </button>
          </fieldset>
        )}
      </footer>
      {selectedPost && (
        <PostModal
          key={selectedPost.slug}
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </main>
  )
}
function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
