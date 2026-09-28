import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { createClientOnlyFn } from '@tanstack/react-start'
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { type BlogPostSummary, sortBlogPostsNewestFirst } from '#/lib/blog-post'
import {
  type BoardSize,
  type BoardView,
  boardSession,
  clampBoardView,
  filterStickerPosts,
  fitBoard,
  initialBoardView,
  layoutStickers,
  type Sticker,
  zoomBoardAt
} from '#/lib/sticker-board'
import type { createStickerScene } from '#/lib/sticker-three.client'
import { SiteHeader } from './site-header'

const loadRenderer = createClientOnlyFn(() => import('#/lib/sticker-three.client'))
type Point = { x: number; y: number }

export function StickerBoard({ posts }: { posts: BlogPostSummary[] }) {
  const { topic = '', q = '' } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const newestSlug = useMemo(() => sortBlogPostsNewestFirst(posts)[0]?.slug, [posts])
  const visiblePosts = useMemo(() => filterStickerPosts(posts, topic, q), [posts, topic, q])
  const layout = useMemo(() => layoutStickers(visiblePosts), [visiblePosts])
  const key = JSON.stringify([topic, q])
  const [size, setSize] = useState<BoardSize>({ width: 0, height: 0 })
  const [view, setView] = useState<BoardView>({ x: 0, y: 0, zoom: 1 })
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [hovered, setHovered] = useState(-1)
  const [dragging, setDragging] = useState(false)
  const surface = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<ReturnType<typeof createStickerScene> | null>(null)
  const currentView = useRef(view)
  const pointers = useRef(new Map<number, Point>())
  const origin = useRef<Point | null>(null)
  const didDrag = useRef(false)
  const initializedKey = useRef<string | null>(null)
  const latest = useRef({ size, layout, key, topic, q })
  latest.current = { size, layout, key, topic, q }

  function updateView(next: BoardView) {
    const state = latest.current
    const clamped = clampBoardView(next, state.size, state.layout)
    currentView.current = clamped
    setView(clamped)
    boardSession.view = clamped
    boardSession.key = state.key
    boardSession.search = { topic: state.topic || undefined, q: state.q || undefined }
  }

  useEffect(() => {
    if (!surface.current) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    )
    observer.observe(surface.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!size.width) return
    const isNewFilter = initializedKey.current !== null && initializedKey.current !== key
    const restored =
      initializedKey.current === null && boardSession.key === key ? boardSession.view : undefined
    const next =
      restored ??
      (initializedKey.current === key
        ? currentView.current
        : isNewFilter && (topic || q)
          ? fitBoard(size, layout)
          : initialBoardView(size, layout))
    initializedKey.current = key
    const clamped = clampBoardView(next, size, layout)
    currentView.current = clamped
    setView(clamped)
    boardSession.view = clamped
    boardSession.key = key
    boardSession.search = { topic: topic || undefined, q: q || undefined }
  }, [key, size, layout, topic, q])

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setFailed(false)
    async function initialize() {
      try {
        const module = await loadRenderer()
        // Load the actual Japanese glyphs used by these articles before rasterizing.
        const characters = [
          ...new Set(layout.stickers.flatMap((item) => Array.from(item.post.title)))
        ].join('')
        await document.fonts.load('400 31px "WDXL Lubrifont JP N"', characters)
        await document.fonts.load('600 9px "IBM Plex Mono"', '0123456789.')
        if (cancelled || !canvas.current) return
        renderer.current = module.createStickerScene(
          canvas.current,
          layout.stickers,
          () => {
            setReady(false)
            setFailed(true)
          },
          { eyes: true }
        )
        renderer.current.update(currentView.current, latest.current.size, -1)
        setReady(true)
      } catch (error) {
        if (!cancelled) {
          console.error('Sticker renderer unavailable', error)
          setFailed(true)
        }
      }
    }
    void initialize()
    return () => {
      cancelled = true
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [layout])

  useEffect(() => {
    renderer.current?.update(view, size, hovered)
  }, [view, size, hovered])

  useEffect(() => {
    const element = surface.current
    if (!element || !ready) return
    function wheel(event: WheelEvent) {
      event.preventDefault()
      const rect = element?.getBoundingClientRect()
      if (!rect) return
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? latest.current.size.height : 1)
      const next = zoomBoardAt(
        currentView.current,
        Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002),
        { x: event.clientX - rect.left, y: event.clientY - rect.top }
      )
      const state = latest.current
      const clamped = clampBoardView(next, state.size, state.layout)
      currentView.current = clamped
      boardSession.view = clamped
      setView(clamped)
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
    if (pointers.current.size === 0) {
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
    const next = point(event)
    pointers.current.set(event.pointerId, next)
    if (origin.current && Math.hypot(next.x - origin.current.x, next.y - origin.current.y) > 6)
      didDrag.current = true
    if (!didDrag.current || !before) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    setHovered(-1)
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
    } else {
      updateView({
        ...currentView.current,
        x: currentView.current.x + next.x - before.x,
        y: currentView.current.y + next.y - before.y
      })
    }
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (!pointers.current.size) {
      setDragging(false)
      origin.current = null
    }
  }

  function focusSticker(sticker: Sticker, index: number) {
    if (!ready) return
    setHovered(index)
    const current = currentView.current
    const x = current.x + sticker.x * current.zoom
    const y = current.y + sticker.y * current.zoom
    const halfWidth = (sticker.width * current.zoom) / 2 + 20
    const halfHeight = (sticker.height * current.zoom) / 2 + 20
    if (
      x - halfWidth < 0 ||
      x + halfWidth > size.width ||
      y - halfHeight < 85 ||
      y + halfHeight > size.height - 65
    ) {
      updateView({
        ...current,
        x: size.width / 2 - sticker.x * current.zoom,
        y: size.height / 2 - sticker.y * current.zoom
      })
    }
  }

  const tags = [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) =>
    a.localeCompare(b, 'ja')
  )
  const clear = () => navigate({ search: {}, replace: true })

  return (
    <main className="sticker-page">
      <h1 className="sr-only">記事のステッカーボード</h1>
      <SiteHeader>
        <form
          className="sticker-search"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            void navigate({
              search: {
                topic: topic || undefined,
                q: String(form.get('q') ?? '').trim() || undefined
              },
              replace: true
            })
          }}
        >
          <label htmlFor="sticker-search">記事を探す</label>
          <div>
            <input
              id="sticker-search"
              name="q"
              type="search"
              placeholder="タイトル、キーワード…"
              defaultValue={q}
              key={q}
            />
            <button type="submit" aria-label="検索">
              ↗
            </button>
          </div>
          <label htmlFor="sticker-topic">タグ</label>
          <select
            id="sticker-topic"
            value={topic}
            onChange={(event) =>
              void navigate({
                search: { q: q || undefined, topic: event.target.value || undefined },
                replace: true
              })
            }
          >
            <option value="">すべての記事</option>
            {topic && !tags.includes(topic) && <option value={topic}>{topic}</option>}
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </form>
      </SiteHeader>
      <div
        ref={surface}
        className={`sticker-surface${ready ? ' is-ready' : ''}${dragging ? ' is-dragging' : ''}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onLostPointerCapture={(event) => {
          // Ignore capture transfers from a sticker to the board during touch drags.
          if (event.target === event.currentTarget && pointers.current.has(event.pointerId))
            pointerUp(event)
        }}
        onClickCapture={(event) => {
          if (ready && didDrag.current && event.detail !== 0) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        <canvas ref={canvas} className="sticker-canvas" aria-hidden="true" tabIndex={-1} />
        {!ready && !failed && visiblePosts.length > 0 && (
          <div className="sticker-loading" role="status">
            <span className="sr-only">ステッカーを読み込んでいます</span>
            <div className="sticker-loading__icon" aria-hidden="true">
              <span className="sticker-loading__eyes" />
              <span className="sticker-loading__dots">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}
        <div
          className="sticker-links"
          hidden={!ready && !failed}
          style={
            ready
              ? { transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }
              : undefined
          }
        >
          {layout.stickers.map((sticker, index) => (
            <Link
              key={sticker.post.slug}
              className="sticker-link"
              to="/blog/$slug"
              params={{ slug: sticker.post.slug }}
              preload={false}
              draggable={false}
              style={
                ready
                  ? {
                      left: sticker.x - sticker.width / 2,
                      top: sticker.y - sticker.height / 2,
                      width: sticker.width,
                      height: sticker.height,
                      transform: `rotate(${sticker.angle}rad)`
                    }
                  : undefined
              }
              onPointerEnter={() => {
                if (!pointers.current.size) setHovered(index)
              }}
              onPointerLeave={() => setHovered(-1)}
              onFocus={(event) => {
                if (event.currentTarget.matches(':focus-visible')) focusSticker(sticker, index)
              }}
              onBlur={() => setHovered(-1)}
            >
              <span>{sticker.post.title}</span>
              <time dateTime={sticker.post.date}>{sticker.post.date}</time>
              {sticker.post.slug === newestSlug &&
                ['top', 'right', 'bottom', 'left'].map((position) => (
                  <svg
                    key={position}
                    className={`sticker-sparkle sticker-sparkle--${position}`}
                    viewBox="0 0 32 32"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M16 0 20 12 32 16 20 20 16 32 12 20 0 16 12 12Z" />
                  </svg>
                ))}
            </Link>
          ))}
        </div>
      </div>
      {!visiblePosts.length && (
        <div className="sticker-empty" role="status">
          <p>該当する記事がありません。</p>
          <button type="button" onClick={clear}>
            すべての記事に戻る
          </button>
        </div>
      )}
      <footer className="board-footer">
        <div className="board-caption">
          <span className="board-caption__dot" />
          <span>{String(visiblePosts.length).padStart(2, '0')} stickers</span>
          <span className="board-instruction">
            {ready
              ? 'drag to explore · scroll to zoom'
              : failed
                ? '記事一覧'
                : 'art, code & little experiments'}
          </span>
          {(topic || q) && (
            <button type="button" onClick={clear} aria-label="絞り込みを解除">
              {topic || q} ×
            </button>
          )}
        </div>
        {ready && (
          <fieldset className="board-controls" aria-label="ボードの表示操作">
            <button
              type="button"
              aria-label="縮小"
              onClick={() =>
                updateView(zoomBoardAt(view, 1 / 1.25, { x: size.width / 2, y: size.height / 2 }))
              }
            >
              −
            </button>
            <span aria-live="off">{Math.round(view.zoom * 100)}%</span>
            <button
              type="button"
              aria-label="拡大"
              onClick={() =>
                updateView(zoomBoardAt(view, 1.25, { x: size.width / 2, y: size.height / 2 }))
              }
            >
              +
            </button>
            <button
              type="button"
              aria-label="全体表示"
              onClick={() => updateView(fitBoard(size, layout))}
            >
              ⛶
            </button>
            <button
              type="button"
              aria-label="初期位置に戻る"
              onClick={() => updateView(initialBoardView(size, layout))}
            >
              ↺
            </button>
          </fieldset>
        )}
      </footer>
    </main>
  )
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
