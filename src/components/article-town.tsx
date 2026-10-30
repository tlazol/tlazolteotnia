import {
  Outlet,
  useLocation,
  useMatch,
  useMatchRoute,
  useNavigate,
  useRouter
} from '@tanstack/react-router'
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { type BlogPostSummary, sortBlogPostsNewestFirst } from '#/lib/blog-post'
import { shouldClosePostByHistoryBack, shouldOpenPostModal } from '#/lib/post-modal'
import { fitTown, initialTownView, layoutTownArticles } from '#/lib/town-posts'
import { zoomTownAt } from '#/lib/town-view'
import { PostModal } from './post-modal'
import { SiteHeader } from './site-header'
import { TownArticleList } from './town-article-list'
import { TownBubble } from './town-bubble'
import { TownCameraControls } from './town-camera-controls'
import { useTownInput } from './use-town-input'
import { useTownRenderer } from './use-town-renderer'

export function ArticleTown({ posts }: { posts: BlogPostSummary[] }) {
  const router = useRouter()
  const matchRoute = useMatchRoute()
  // A pending match opens the modal immediately while the post loader runs.
  const postParams =
    matchRoute({ to: '/blog/$slug', pending: true, includeSearch: false }) ||
    matchRoute({ to: '/blog/$slug', includeSearch: false })
  const openSlug = postParams ? postParams.slug : null
  const loadedSlug = useMatch({
    from: '/_town/blog/$slug',
    shouldThrow: false,
    select: (match) => match.params.slug
  })
  const navigate = useNavigate({ from: '/' })
  const sorted = useMemo(() => sortBlogPostsNewestFirst(posts), [posts])
  const openedPost = openSlug ? sorted.find((post) => post.slug === openSlug) : undefined
  const articles = useMemo(() => layoutTownArticles(sorted), [sorted])

  const [rotateMode, setRotateMode] = useState(false)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const listToggle = useRef<HTMLButtonElement>(null)
  const listHeading = useRef<HTMLHeadingElement>(null)
  const scene = useTownRenderer(articles, activeSlug, setActiveSlug, openSlug)
  const {
    status,
    surface,
    canvas,
    bubble,
    buttons,
    renderer,
    size,
    zoom,
    currentView,
    updateView
  } = scene
  const ready = status === 'ready'
  const failed = status === 'failed'
  const loading = status === 'loading'
  const listVisible = failed || (ready && listOpen)
  const activePost = sorted.find((post) => post.slug === activeSlug)
  function selectResident(slug: string) {
    renderer.current?.follow(slug)
    setActiveSlug((active) => (active === slug ? null : slug))
  }
  const { input, dragging, draggedSlug } = useTownInput(
    scene,
    rotateMode,
    setActiveSlug,
    selectResident
  )
  function closeBubble() {
    setActiveSlug(null)
    if (activeSlug) buttons.current.get(activeSlug)?.focus({ preventScroll: true })
  }
  function closeList() {
    setListOpen(false)
    listToggle.current?.focus()
  }
  useEffect(() => {
    if (listOpen) listHeading.current?.focus()
  }, [listOpen])
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || openSlug || document.querySelector('dialog[open]')) return
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
  }, [activeSlug, openSlug, listOpen, buttons])
  // Posts opened from the town close by going back, so they do not stack history entries.
  const historyIndex = useLocation({ select: (location) => location.state.__TSR_index })
  const townHistoryIndex = useRef<number | null>(null)
  useEffect(() => {
    if (!openSlug) townHistoryIndex.current = historyIndex
  }, [openSlug, historyIndex])
  function openPost(event: MouseEvent<HTMLAnchorElement>) {
    // Safari does not focus links on click; the modal restores focus to this link.
    if (shouldOpenPostModal(event)) event.currentTarget.focus({ preventScroll: true })
  }
  function closePost() {
    const index = router.history.location.state.__TSR_index
    if (shouldClosePostByHistoryBack(townHistoryIndex.current, index)) router.history.back()
    else void navigate({ to: '/', search: {} })
  }

  return (
    <main className="sticker-page town-page">
      <h1 className="sr-only">記事のある街</h1>
      <SiteHeader />
      <div
        ref={surface}
        data-camera-mode={rotateMode ? 'rotate' : 'pan'}
        className={`sticker-surface${ready ? ' is-ready' : ''}${dragging ? ' is-dragging' : ''}`}
        onPointerDown={input.pointerDown}
        onPointerMove={input.pointerMove}
        onPointerUp={input.pointerUp}
        onPointerCancel={input.pointerUp}
        onLostPointerCapture={input.lostPointerCapture}
        onClickCapture={input.clickCapture}
      >
        <canvas ref={canvas} className="sticker-canvas" aria-hidden="true" tabIndex={-1} />
        {loading && (
          <div className="town-loading" role="status">
            <span className="town-loading__spinner" aria-hidden="true" />
            <p>街を読み込んでいます…</p>
          </div>
        )}
        {ready &&
          sorted.map((post) => (
            <button
              key={post.slug}
              ref={(element) => {
                if (element) buttons.current.set(post.slug, element)
                else buttons.current.delete(post.slug)
              }}
              className={`town-person${post.slug === sorted[0]?.slug ? ' is-new' : ''}${post.slug === draggedSlug ? ' is-lifted' : ''}`}
              type="button"
              data-slug={post.slug}
              aria-label={`${post.title} の住人に話しかける`}
              aria-expanded={activeSlug === post.slug}
              aria-controls={activeSlug === post.slug ? 'town-bubble' : undefined}
              onClick={() => selectResident(post.slug)}
              onPointerEnter={() => {
                input.enterResident(post.slug)
              }}
              onPointerLeave={(event) => {
                input.leaveResident(post.slug)
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
          <TownBubble
            post={activePost}
            newestSlug={sorted[0]?.slug}
            bubble={bubble}
            onClose={closeBubble}
            openPost={openPost}
          />
        )}
      </div>
      <TownArticleList
        posts={sorted}
        newestSlug={sorted[0]?.slug}
        loading={loading}
        ready={ready}
        failed={failed}
        listVisible={listVisible}
        listToggle={listToggle}
        listHeading={listHeading}
        onToggle={() => setListOpen(!listOpen)}
        onClose={closeList}
        openPost={openPost}
      />
      <footer className="board-footer town-footer">
        <div className="board-caption">
          <span className="board-caption__dot" />
          <span>{String(sorted.length).padStart(2, '0')} 記事</span>
        </div>
        {ready && (
          <TownCameraControls
            rotateMode={rotateMode}
            zoom={zoom}
            onToggleRotate={() => setRotateMode(!rotateMode)}
            onZoom={(factor) => {
              renderer.current?.follow(null)
              updateView(
                zoomTownAt(currentView.current, factor, { x: size.width / 2, y: size.height / 2 })
              )
            }}
            onFit={() => {
              renderer.current?.follow(null)
              updateView(fitTown(size, currentView.current.rotation))
            }}
            onReset={() => {
              renderer.current?.follow(articles[0]?.slug ?? null)
              updateView(initialTownView(size, articles[0]))
            }}
          />
        )}
      </footer>
      {openSlug && (
        <PostModal
          key={openSlug}
          slug={openSlug}
          title={openedPost?.title ?? '記事'}
          onClose={closePost}
          fallbackFocus={() => bubble.current?.querySelector('a') ?? listToggle.current}
        >
          {loadedSlug === openSlug ? (
            <Outlet />
          ) : (
            <p className="post-modal__status" role="status">
              記事を読み込んでいます…
            </p>
          )}
        </PostModal>
      )}
    </main>
  )
}
