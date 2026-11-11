import {
  Outlet,
  useLocation,
  useMatch,
  useMatchRoute,
  useNavigate,
  useRouter
} from '@tanstack/react-router'
import {
  type MouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { type BlogPostSummary, sortBlogPostsNewestFirst } from '#/lib/blog-post'
import { panView, stepZoom, tileAt, zoomViewAt } from '#/lib/island-camera'
import type { EditOptions } from '#/lib/island-edit'
import { createIslandInput } from '#/lib/island-input'
import type { ResidentScreen } from '#/lib/island-three.client'
import { GRASS, ISLAND_COLUMNS, ISLAND_ROWS } from '#/lib/island-world'
import { shouldClosePostByHistoryBack, shouldOpenPostModal } from '#/lib/post-modal'
import { PixelIcon } from './island-icons'
import { IslandToolbar, toolShortcuts } from './island-toolbar'
import { PostModal } from './post-modal'
import { SiteHeader } from './site-header'
import { TownArticleList } from './town-article-list'
import { placeTownBubble, TownBubble } from './town-bubble'
import { TownLoading } from './town-loading'
import { type CursorInfo, useIsland } from './use-island'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

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
  const newestSlug = sorted[0]?.slug
  const openedPost = openSlug ? sorted.find((post) => post.slug === openSlug) : undefined

  const [editorOpen, setEditorOpen] = useState(false)
  const editorToggle = useRef<HTMLButtonElement>(null)
  const [options, setOptions] = useState<EditOptions>({
    tool: 'land',
    ground: GRASS,
    decor: 'tree',
    brush: 1
  })
  const [panTool, setPanTool] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [activeSlug, setActiveSlug] = useState<string | null>(() => openSlug ?? newestSlug ?? null)
  const [cursor, setCursor] = useState<CursorInfo>(null)
  const [coarse, setCoarse] = useState(false)
  const menuToggle = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const tooltip = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const keyboardTile = useRef<{ x: number; y: number } | null>(null)
  const latestPositions = useRef<ResidentScreen[]>([])
  const pendingBubbleFocus = useRef<string | null>(null)

  const latest = useRef({ editorOpen, options, panTool, spaceHeld, activeSlug, openSlug })
  latest.current = { editorOpen, options, panTool, spaceHeld, activeSlug, openSlug }

  const positionOverlay = useCallback((positions: ResidentScreen[], closeOffscreen = false) => {
    latestPositions.current = positions
    const { activeSlug: active, editorOpen: currentEditorOpen } = latest.current
    const surfaceElement = scene.surface.current
    const width = surfaceElement?.clientWidth ?? 0
    const height = surfaceElement?.clientHeight ?? 0
    for (const position of positions) {
      const button = buttons.current.get(position.slug)
      const boxWidth = Math.max(36, position.width * 0.8)
      const boxHeight = Math.max(44, position.height)
      const left = position.x - boxWidth / 2
      const top = position.y - boxHeight + 2
      const inView = left + boxWidth > 0 && top + boxHeight > 0 && left < width && top < height
      if (button) {
        button.dataset.swimming = String(position.swimming)
        button.dataset.dragging = String(position.dragging)
        button.style.width = `${boxWidth}px`
        button.style.height = `${boxHeight}px`
        button.style.transform = `translate(${left}px, ${top}px)`
        const visible = inView && !currentEditorOpen
        button.style.visibility = visible ? 'visible' : 'hidden'
        button.tabIndex = visible ? 0 : -1
      }
      if (position.slug === active && bubble.current) {
        const element = bubble.current
        const placement = placeTownBubble(
          { x: position.x, y: position.y - position.height - 4, bottom: position.y + 6 },
          { width: element.offsetWidth, height: element.offsetHeight },
          { width, height }
        )
        element.style.left = `${placement.left}px`
        element.style.top = `${placement.top}px`
        element.style.setProperty('--tail-x', `${placement.tail}px`)
        element.dataset.side = placement.above ? 'above' : 'below'
        element.style.visibility = inView ? 'visible' : 'hidden'
        // Only fresh renderer positions can dismiss a bubble after a camera move.
        if (!inView && closeOffscreen && !latest.current.openSlug) {
          pendingBubbleFocus.current = null
          setActiveSlug((slug) => (slug === position.slug ? null : slug))
        }
        if (inView && pendingBubbleFocus.current === position.slug) {
          const link = element.querySelector('a')
          link?.focus({ preventScroll: true })
          if (document.activeElement === link) pendingBubbleFocus.current = null
        }
      }
    }
  }, [])

  const scene = useIsland({
    posts: sorted,
    initialSlug: openSlug,
    onPositions: (positions) => positionOverlay(positions, true)
  })
  const { status, size, zoom, surface, canvas, renderer, view, setView, homeView, edits } = scene
  const ready = status === 'ready'
  const failed = status === 'failed'
  const loading = status === 'loading'
  const editing = editorOpen && ready
  const activePost = sorted.find((post) => post.slug === activeSlug)

  useEffect(() => {
    if (!openSlug || !ready) return
    pendingBubbleFocus.current = null
    setEditorOpen(false)
    setActiveSlug(openSlug)
    setView(homeView(openSlug, view.current.zoom))
  }, [openSlug, ready, setView, homeView, view])

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const showCursor = useCallback((info: CursorInfo) => {
    setCursor((previous) =>
      previous?.reason === info?.reason && previous?.soft === info?.soft ? previous : info
    )
    if (tooltip.current && info) {
      tooltip.current.style.transform = `translate(${info.x + 16}px, ${info.y + 18}px)`
    }
  }, [])

  const [input] = useState(() =>
    createIslandInput({
      surface: () => scene.surface.current,
      view: () => scene.view.current,
      size: () => scene.sizeRef.current,
      setView: (next) => sceneRef.current.setView(next),
      ready: () => sceneRef.current.status === 'ready',
      editing: () => latest.current.editorOpen,
      panning: () => latest.current.panTool || latest.current.spaceHeld,
      hover: (point) => showCursor(sceneRef.current.preview(point, latest.current.options)),
      strokeStart: (point) =>
        showCursor(sceneRef.current.edits.begin(point, latest.current.options)),
      strokeMove: (point) => showCursor(sceneRef.current.edits.move(point, latest.current.options)),
      strokeEnd: (cancel) => sceneRef.current.edits.end(cancel),
      tap: () => {
        if (!latest.current.editorOpen) setActiveSlug(null)
      },
      residentStart: (slug, point) =>
        sceneRef.current.renderer.current?.beginResidentDrag(slug, point),
      residentMove: (point) => {
        setActiveSlug(null)
        sceneRef.current.renderer.current?.moveResidentDrag(point)
      },
      residentEnd: (cancel) => sceneRef.current.renderer.current?.endResidentDrag(cancel),
      setDragging
    })
  )
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  useEffect(() => {
    const element = surface.current
    if (!element || !ready) return
    element.addEventListener('wheel', input.wheel, { passive: false })
    window.addEventListener('blur', input.cancel)
    return () => {
      element.removeEventListener('wheel', input.wheel)
      window.removeEventListener('blur', input.cancel)
      input.cancel()
    }
  }, [ready, surface, input])

  useEffect(() => {
    renderer.current?.setEditing(editing)
    // Show or hide the residents' hit areas right away, not on the next frame.
    positionOverlay(latestPositions.current)
    if (!editing) {
      setCursor(null)
      keyboardTile.current = null
    }
  }, [editing, renderer, status, positionOverlay])

  useEffect(() => {
    renderer.current?.select(activeSlug)
    positionOverlay(latestPositions.current)
  }, [activeSlug, renderer, status, positionOverlay])

  useEffect(() => {
    if (!bubble.current) return
    const observer = new ResizeObserver(() => positionOverlay(latestPositions.current))
    observer.observe(bubble.current)
    return () => observer.disconnect()
  }, [activeSlug, positionOverlay, status])

  function selectResident(slug: string, viaKeyboard = false) {
    pendingBubbleFocus.current = viaKeyboard ? slug : null
    if (activeSlug !== slug) setView(homeView(slug, view.current.zoom))
    setActiveSlug((active) => (active === slug ? null : slug))
  }
  function closeBubble() {
    const slug = activeSlug
    setActiveSlug(null)
    if (slug) buttons.current.get(slug)?.focus({ preventScroll: true })
  }
  function toggleEditor(open: boolean) {
    input.cancel()
    setEditorOpen(open)
    setPanTool(false)
    setSpaceHeld(false)
    if (open) setActiveSlug(null)
    else editorToggle.current?.focus({ preventScroll: true })
  }
  function zoomBy(direction: 1 | -1) {
    const next = stepZoom(view.current.zoom, direction)
    setView(zoomViewAt(view.current, size, next, { x: size.width / 2, y: size.height / 2 }))
  }
  function goHome() {
    setView(homeView(newestSlug))
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (openSlug || document.querySelector('dialog[open]') || isTyping(event.target)) return
      const { editorOpen: currentEditorOpen } = latest.current
      if (event.key === 'Escape') {
        input.cancel()
        if (activeSlug) closeBubble()
        else if (currentEditorOpen) toggleEditor(false)
        return
      }
      if (!currentEditorOpen || !ready) return
      const mod = event.metaKey || event.ctrlKey
      if (mod || event.altKey) return
      const tool = toolShortcuts[event.key]
      if (tool) {
        setPanTool(false)
        setOptions((current) => ({ ...current, tool }))
      } else if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        setSpaceHeld(true)
      }
    }
    function keyup(event: KeyboardEvent) {
      if (event.key === ' ') setSpaceHeld(false)
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('keyup', keyup)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('keyup', keyup)
    }
  })

  // Arrow keys move the map, or the edit cursor while editing; Enter applies the tool.
  function surfaceKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !ready) return
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }
    const arrow = arrows[event.key]
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomBy(1)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      zoomBy(-1)
    } else if (event.key === 'Home' || event.key === '0') {
      event.preventDefault()
      goHome()
    } else if (arrow && !editing) {
      event.preventDefault()
      setView(panView(view.current, size, -arrow[0] * 64, -arrow[1] * 64))
    } else if (arrow && editing) {
      event.preventDefault()
      const center =
        keyboardTile.current ??
        tileAt(view.current, size, { x: size.width / 2, y: size.height / 2 })
      const next = keyboardTile.current
        ? {
            x: Math.max(0, Math.min(ISLAND_COLUMNS - 1, center.x + arrow[0])),
            y: Math.max(0, Math.min(ISLAND_ROWS - 1, center.y + arrow[1]))
          }
        : center
      keyboardTile.current = next
      updateKeyboardCursor(next)
    } else if (editing && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      const tile =
        keyboardTile.current ??
        tileAt(view.current, size, { x: size.width / 2, y: size.height / 2 })
      keyboardTile.current = tile
      edits.applyAt(tile, options)
      updateKeyboardCursor(tile)
    }
  }
  function updateKeyboardCursor(tile: { x: number; y: number }) {
    // Keep the keyboard cursor on screen.
    const v = view.current
    const px = (tile.x + 0.5) * 16
    const py = (tile.y + 0.5) * 16
    const halfW = size.width / 2 / v.zoom - 48
    const halfH = size.height / 2 / v.zoom - 80
    if (Math.abs(px - v.x) > halfW || Math.abs(py - v.y) > halfH) setView({ ...v, x: px, y: py })
    const screen = {
      x: (px - view.current.x) * view.current.zoom + size.width / 2,
      y: (py - view.current.y) * view.current.zoom + size.height / 2
    }
    showCursor(scene.preview(screen, options))
  }

  // Posts opened from the island close by going back, so they do not stack history entries.
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

  const blockedReason = cursor?.reason && !cursor.soft ? cursor.reason : null

  return (
    <main
      className={`sticker-page town-page island-page${loading ? ' is-loading' : ''}${editing ? ' is-editing' : ''}`}
    >
      <h1 className="sr-only">記事の住人がいる島</h1>
      <SiteHeader revealMenu={failed} toggleRef={menuToggle}>
        <TownArticleList
          posts={sorted}
          newestSlug={newestSlug}
          failed={failed}
          openPost={openPost}
        />
      </SiteHeader>
      <div
        ref={surface}
        className={`sticker-surface island-surface${ready ? ' is-ready' : ''}${dragging ? ' is-dragging' : ''}${panTool || spaceHeld ? ' is-pan-tool' : ''}`}
        data-tool={editing ? options.tool : undefined}
        tabIndex={ready ? 0 : -1}
        role="application"
        aria-roledescription="島の地図"
        aria-label={
          editing
            ? `島の編集。矢印キーで編集位置を動かし、Enterで${options.tool === 'land' ? '土地を足す・塗り替えます' : '選んだツールを使います'}。`
            : '島の地図。矢印キーで移動、+ と − で拡大縮小、0 で最初の位置に戻ります。'
        }
        onKeyDown={surfaceKeyDown}
        onPointerDown={input.pointerDown}
        onPointerMove={input.pointerMove}
        onPointerUp={input.pointerUp}
        onPointerCancel={input.pointerCancel}
        onPointerLeave={input.pointerLeave}
        onClickCapture={(event) => {
          if (input.consumeResidentClick()) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onContextMenu={(event) => {
          if (editing) event.preventDefault()
        }}
        onBlur={() => {
          if (keyboardTile.current) {
            keyboardTile.current = null
            renderer.current?.setCursor(null)
            setCursor(null)
          }
        }}
      >
        <canvas
          ref={canvas}
          className="sticker-canvas island-canvas"
          aria-hidden="true"
          tabIndex={-1}
        />
        <TownLoading status={status} />
        {ready &&
          sorted.map((post) => (
            <button
              key={post.slug}
              ref={(element) => {
                if (element) buttons.current.set(post.slug, element)
                else buttons.current.delete(post.slug)
              }}
              className={`island-resident${post.slug === newestSlug ? ' is-new' : ''}`}
              type="button"
              data-resident={post.slug}
              title="クリックで話しかける・ドラッグで移動"
              aria-label={`${post.title}（住人に話しかける）`}
              aria-expanded={activeSlug === post.slug}
              aria-controls={activeSlug === post.slug ? 'town-bubble' : undefined}
              onClick={(event) => selectResident(post.slug, event.detail === 0)}
              onPointerEnter={() => renderer.current?.focus(post.slug)}
              onPointerLeave={(event) => {
                if (!event.currentTarget.matches(':focus-visible')) renderer.current?.focus(null)
              }}
              onFocus={(event) => {
                if (event.currentTarget.matches(':focus-visible'))
                  renderer.current?.focus(post.slug)
              }}
              onBlur={() => renderer.current?.focus(null)}
            >
              {post.slug === newestSlug && (
                <span className="island-resident__new" aria-hidden="true">
                  NEW
                </span>
              )}
            </button>
          ))}
        {ready && activePost && !editing && (
          <TownBubble
            post={activePost}
            newestSlug={newestSlug}
            bubble={bubble}
            onClose={closeBubble}
            openPost={openPost}
          />
        )}
        {editing && !coarse && (
          <div
            ref={tooltip}
            className={`island-tooltip${blockedReason ? ' is-visible' : ''}`}
            aria-hidden="true"
          >
            {blockedReason}
          </div>
        )}
      </div>
      <div className={`island-drawer${editing ? ' is-open' : ''}`}>
        <div className="island-editor-toggle">
          <button
            ref={editorToggle}
            type="button"
            disabled={!ready}
            aria-expanded={editing}
            aria-controls="island-toolbar"
            aria-label={editing ? '島クリエイトを終える' : '島クリエイト'}
            title={editing ? '島クリエイトを終える' : '島クリエイト'}
            onClick={() => toggleEditor(!editorOpen)}
          >
            <PixelIcon name="shovel" />
            <span>島クリエイト</span>
          </button>
        </div>
        {ready && (
          <IslandToolbar
            open={editing}
            options={options}
            onOptions={setOptions}
            panTool={panTool}
            onPanTool={setPanTool}
          />
        )}
      </div>
      {ready && (
        <fieldset className="board-controls island-camera" aria-label="表示の操作">
          <button type="button" aria-label="縮小" title="縮小（−）" onClick={() => zoomBy(-1)}>
            <PixelIcon name="minus" />
          </button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="拡大" title="拡大（+）" onClick={() => zoomBy(1)}>
            <PixelIcon name="plus" />
          </button>
        </fieldset>
      )}
      {openSlug && (
        <PostModal
          key={openSlug}
          slug={openSlug}
          title={openedPost?.title ?? '記事'}
          onClose={closePost}
          fallbackFocus={() => bubble.current?.querySelector('a') ?? menuToggle.current}
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
