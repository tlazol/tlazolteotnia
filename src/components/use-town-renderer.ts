import { createClientOnlyFn } from '@tanstack/react-start'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BlogPostSummary } from '#/lib/blog-post'
import type { SceneSize } from '#/lib/scene-math'
import type { createArticleTown, ResidentScreenPosition } from '#/lib/town-articles.client'
import { clampTownView, initialTownView, placeTownBubble, type TownArticle } from '#/lib/town-posts'
import { type TownView, townSession } from '#/lib/town-view'

const loadRenderer = createClientOnlyFn(() => import('#/lib/town-articles.client'))

export function useTownRenderer(
  articles: TownArticle[],
  visiblePosts: BlogPostSummary[],
  activeSlug: string | null,
  onInitialActive: (slug: string | null) => void
) {
  const [size, setSize] = useState<SceneSize>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const surface = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const renderer = useRef<ReturnType<typeof createArticleTown> | null>(null)
  const currentView = useRef<TownView>({ x: 0, y: 0, zoom: 1 })
  const previousSize = useRef<SceneSize | null>(null)
  const restoredView = useRef(townSession.view)
  const pendingBubbleFocus = useRef<string | null>(null)
  const lastPositions = useRef<ResidentScreenPosition[]>([])
  const latest = useRef({ size, activeSlug, visiblePosts, onInitialActive })
  latest.current = { size, activeSlug, visiblePosts, onInitialActive }
  const updateView = useCallback((next: TownView) => {
    const clamped = clampTownView(next, latest.current.size)
    currentView.current = clamped
    renderer.current?.update(clamped, latest.current.size)
    setZoom(clamped.zoom)
    townSession.view = clamped
  }, [])
  const positionOverlay = useCallback(
    (positions: ResidentScreenPosition[], nextView?: TownView) => {
      if (nextView) {
        currentView.current = nextView
        townSession.view = nextView
      }
      lastPositions.current = positions
      const state = latest.current
      for (const position of positions) {
        const visible = position.visible || (position.slug === state.activeSlug && position.inView)
        const button = buttons.current.get(position.slug)
        if (button) {
          const zoom = currentView.current.zoom
          const width = Math.max(44, position.width * zoom)
          const bodyHeight = position.bodyHeight * zoom
          const height = Math.max(44, bodyHeight + 20 * zoom)
          const top = position.y - 10 * zoom - (height - bodyHeight - 20 * zoom) / 2
          button.style.width = `${width}px`
          button.style.height = `${height}px`
          button.style.setProperty('--foot-y', `${position.y + position.footY * zoom - top}px`)
          button.style.transform = `translate(${position.x - width / 2}px, ${top}px)`
          button.style.visibility = visible ? 'visible' : 'hidden'
          button.dataset.dropAllowed = String(position.dropAllowed)
          button.tabIndex = visible ? 0 : -1
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
          element.style.visibility = visible ? 'visible' : 'hidden'
          if (visible && pendingBubbleFocus.current === position.slug) {
            const link = element.querySelector('a')
            link?.focus({ preventScroll: true })
            if (document.activeElement === link) pendingBubbleFocus.current = null
          }
        }
      }
    },
    []
  )
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
      : restoredView.current
        ? restoredView.current
        : initialTownView(size, articles[0])
    previousSize.current = size
    updateView(next)
  }, [size, articles, updateView])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    function fail() {
      if (cancelled) return
      renderer.current?.dispose()
      renderer.current = null
      setStatus('failed')
    }
    void loadRenderer()
      .then((module) => {
        if (cancelled || !canvas.current) return
        renderer.current = module.createArticleTown(canvas.current, articles, positionOverlay, fail)
        if (restoredView.current) renderer.current.follow(null)
        renderer.current.filter(latest.current.visiblePosts.map((post) => post.slug))
        renderer.current.update(currentView.current, latest.current.size)
        // update can fail synchronously and dispose the renderer through fail().
        if (!renderer.current) return
        setStatus('ready')
        latest.current.onInitialActive(
          latest.current.visiblePosts.find((post) => post.slug === articles[0]?.slug)?.slug ?? null
        )
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Town renderer unavailable', error)
          fail()
        }
      })
    return () => {
      cancelled = true
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [articles, positionOverlay])

  useEffect(() => {
    pendingBubbleFocus.current = activeSlug
    renderer.current?.select(activeSlug)
    positionOverlay(lastPositions.current)
  }, [activeSlug, positionOverlay, status])
  useEffect(() => {
    if (!bubble.current) return
    const observer = new ResizeObserver(() => positionOverlay(lastPositions.current))
    observer.observe(bubble.current)
    return () => observer.disconnect()
  }, [activeSlug, positionOverlay, status])

  return { size, zoom, status, surface, canvas, bubble, buttons, renderer, currentView, updateView }
}
