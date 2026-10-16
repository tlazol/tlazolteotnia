import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { type BlogPostSummary, sortBlogPostsNewestFirst } from '#/lib/blog-post'
import { filterBlogPosts } from '#/lib/blog-tags'
import { shouldOpenPostModal } from '#/lib/post-modal'
import { fitTown, initialTownView, layoutTownArticles } from '#/lib/town-posts'
import { townSession, zoomTownAt } from '#/lib/town-view'
import { PostModal } from './post-modal'
import { SiteHeader } from './site-header'
import { TownArticleList } from './town-article-list'
import { TownBubble } from './town-bubble'
import { TownCameraControls } from './town-camera-controls'
import { useTownInput } from './use-town-input'
import { useTownRenderer } from './use-town-renderer'

export function ArticleTown({ posts }: { posts: BlogPostSummary[] }) {
  const { topic = '', q = '' } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const sorted = useMemo(() => sortBlogPostsNewestFirst(posts), [posts])
  const articles = useMemo(() => layoutTownArticles(sorted), [sorted])
  const visiblePosts = useMemo(() => filterBlogPosts(sorted, topic, q), [sorted, topic, q])

  const [rotateMode, setRotateMode] = useState(false)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<BlogPostSummary | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const listToggle = useRef<HTMLButtonElement>(null)
  const listHeading = useRef<HTMLHeadingElement>(null)
  const scene = useTownRenderer(articles, visiblePosts, activeSlug, setActiveSlug)
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
  const activePost = visiblePosts.find((post) => post.slug === activeSlug)
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
    renderer.current?.filter(visiblePosts.map((post) => post.slug))
    setActiveSlug(null)
    renderer.current?.focus(null)
    townSession.search = { topic: topic || undefined, q: q || undefined }
  }, [visiblePosts, topic, q, renderer])
  useEffect(() => {
    if (listOpen) listHeading.current?.focus()
  }, [listOpen])
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
  }, [activeSlug, selectedPost, listOpen, buttons])
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
          visiblePosts.map((post) => (
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
        visiblePosts={visiblePosts}
        newestSlug={sorted[0]?.slug}
        topic={topic}
        q={q}
        loading={loading}
        ready={ready}
        failed={failed}
        listVisible={listVisible}
        listToggle={listToggle}
        listHeading={listHeading}
        onToggle={() => setListOpen(!listOpen)}
        onClose={closeList}
        openPost={openPost}
        onSearch={(query) => {
          void navigate({
            search: { topic: topic || undefined, q: query || undefined },
            replace: true
          })
        }}
      />
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
          <span className="town-instruction town-instruction--mouse">
            {rotateMode ? '横ドラッグで回転' : '人をクリックで記事・ドラッグで移動'}
          </span>
          <span className="town-instruction town-instruction--touch">
            1本指で移動・2本指で回転／ズーム
          </span>
          {(topic || q) && (
            <Link to="/" search={{}} replace aria-label="絞り込みを解除">
              解除 ×
            </Link>
          )}
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
