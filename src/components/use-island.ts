import { createClientOnlyFn } from '@tanstack/react-start'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BlogPostSummary } from '#/lib/blog-post'
import {
  clampView,
  defaultZoom,
  type IslandView,
  islandSession,
  tileAt,
  viewOn
} from '#/lib/island-camera'
import type { ConnectionState, EditOutcome, IslandConnection } from '#/lib/island-connection.client'
import {
  applyEdits,
  brushIndices,
  cloneIsland,
  collectStrokeTargets,
  commandOf,
  type EditOptions,
  type IslandCommand,
  overlayPreview,
  planBrush,
  planStroke,
  type TileEdit,
  tilesAlong
} from '#/lib/island-edit'
import {
  createResidents,
  designResidents,
  footOf,
  type Resident,
  settleResidents
} from '#/lib/island-residents'
import type { IslandRenderer, ResidentScreen } from '#/lib/island-three.client'
import { type IslandWorld, layoutResidentHomes } from '#/lib/island-world'
import type { SceneSize } from '#/lib/scene-math'

const loadRenderer = createClientOnlyFn(() => import('#/lib/island-three.client'))
const loadConnection = createClientOnlyFn(() => import('#/lib/island-connection.client'))

export type IslandStatus = 'loading' | 'ready' | 'failed'
export type CursorInfo = { reason: string | null; soft: boolean; x: number; y: number } | null

// A stroke being drawn, or sent and waiting for the island's answer.
type Stroke = { command: IslandCommand; targets: number[]; limit: number; sent: boolean }

export function useIsland({
  posts,
  initialSlug,
  onPositions,
  onOutcome
}: {
  // Newest first.
  posts: BlogPostSummary[]
  initialSlug: string | null
  onPositions: (positions: ResidentScreen[], view: IslandView) => void
  onOutcome?: (outcome: EditOutcome) => void
}) {
  const [status, setStatus] = useState<IslandStatus>('loading')
  const [size, setSize] = useState<SceneSize>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(2)
  const [shared, setShared] = useState<ConnectionState | null>(null)
  // Bumped when an island first arrives (live or read-only), to start drawing.
  const [islandKey, setIslandKey] = useState(0)
  const surface = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<IslandRenderer | null>(null)
  // The island as the server last confirmed it, and the copy that is drawn:
  // confirmed plus this visitor's unsent or unanswered stroke.
  const confirmed = useRef<IslandWorld | null>(null)
  const drawn = useRef<IslandWorld | null>(null)
  const preview = useRef<TileEdit[]>([])
  const stroke = useRef<Stroke | null>(null)
  const connection = useRef<IslandConnection | null>(null)
  const residents = useRef<Resident[]>([])
  const view = useRef<IslandView>({ x: 0, y: 0, zoom: 2 })
  const sizeRef = useRef(size)
  sizeRef.current = size
  const positionsCallback = useRef(onPositions)
  positionsCallback.current = onPositions
  const outcomeCallback = useRef(onOutcome)
  outcomeCallback.current = onOutcome
  const lastStrokeTile = useRef<{ x: number; y: number } | null>(null)
  // The tile an edit just finished on: its "nothing to do here" is not news.
  const settledTile = useRef<{ x: number; y: number } | null>(null)
  const initialTarget = useRef(initialSlug)
  const latestPosts = useRef(posts)
  latestPosts.current = posts
  // Rebuild only when the set of posts really changes, not on every loader refresh.
  const postsKey = posts.map((post) => `${post.slug}@${post.date}`).join('|')

  const setView = useCallback((next: IslandView) => {
    const clamped = clampView(next, sizeRef.current)
    view.current = clamped
    islandSession.view = clamped
    setZoom(clamped.zoom)
    renderer.current?.setView(clamped, sizeRef.current)
  }, [])

  const homeView = useCallback((slug?: string | null, zoom = defaultZoom(sizeRef.current)) => {
    const target =
      residents.current.find((resident) => resident.slug === slug) ?? residents.current[0]
    const foot = target
      ? { x: target.x + target.offsetX, y: target.y + target.offsetY }
      : footOf({ x: 40, y: 30 })
    return viewOn({ x: foot.x, y: foot.y - 12 }, sizeRef.current, zoom)
  }, [])

  useEffect(() => {
    const element = surface.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Keep the same world point centered when the viewport changes size.
  const hadSize = useRef(false)
  useEffect(() => {
    if (!size.width || !size.height) return
    if (!hadSize.current) {
      hadSize.current = true
      setView(islandSession.view ?? homeView(initialTarget.current))
    } else setView(view.current)
  }, [size, setView, homeView])

  // Redraws the preview over the confirmed island at the touched tiles.
  const redraw = useCallback((touched: Iterable<number>) => {
    const base = confirmed.current
    const target = drawn.current
    if (!base || !target) return
    const current = stroke.current
    const next = current ? planStroke(base, current.command, current.targets) : []
    const indices = new Set(touched)
    for (const edit of preview.current) indices.add(edit.index)
    preview.current = next
    renderer.current?.updateTiles(overlayPreview(target, base, indices, next))
  }, [])

  // The shared island: one connection for the page's lifetime, kept across
  // post modals and resident rebuilds.
  useEffect(() => {
    let cancelled = false
    let live: IslandConnection | null = null
    const visibility = () => {
      if (document.visibilityState === 'visible') live?.resume()
    }
    void loadConnection().then((module) => {
      if (cancelled) return
      live = module.createBrowserIslandConnection({
        island: (world) => {
          const first = !confirmed.current
          if (first) {
            confirmed.current = world
            drawn.current = cloneIsland(world)
            preview.current = []
            setIslandKey((key) => key + 1)
            return
          }
          const base = confirmed.current
          if (!base) return
          const changed: number[] = []
          for (let i = 0; i < base.ground.length; i++)
            if (base.ground[i] !== world.ground[i] || base.decor[i] !== world.decor[i])
              changed.push(i)
          base.ground.set(world.ground)
          base.decor.set(world.decor)
          redraw(changed)
        },
        patch: (edits) => {
          const base = confirmed.current
          if (!base) return
          applyEdits(base, edits)
          redraw(edits.map((edit) => edit.index))
        },
        state: (next) => {
          // A disconnect also ends a stroke still being drawn. It has no
          // pending request, so the connection will not report an outcome for it.
          if (next.phase === 'waiting' && stroke.current && !stroke.current.sent) {
            stroke.current = null
            lastStrokeTile.current = null
            settledTile.current = null
            redraw([])
            renderer.current?.setCursor(null)
          }
          setShared(next)
        },
        outcome: (outcome) => {
          // Answered or unknown: the stroke leaves; the confirmed island stays.
          if (stroke.current?.sent) {
            stroke.current = null
            redraw([])
          }
          outcomeCallback.current?.(outcome)
        }
      })
      connection.current = live
      setShared(live.state())
      live.start()
      // Development only: lets browser checks compare what each visitor holds.
      if (import.meta.env.DEV) {
        const world = (target: IslandWorld | null) =>
          target
            ? `${Array.from(target.ground).join('')}|${Array.from(target.decor).join(',')}`
            : null
        ;(window as unknown as Record<string, unknown>).__islandDebug = {
          confirmed: () => world(confirmed.current),
          drawn: () => world(drawn.current),
          state: () => live?.state()
        }
      }
      document.addEventListener('visibilitychange', visibility)
    })
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', visibility)
      live?.stop()
      connection.current = null
    }
  }, [redraw])

  // Nothing could be loaded in time: let the page fall back to the article list.
  useEffect(() => {
    if (shared?.initialFailed && !drawn.current) setStatus('failed')
  }, [shared?.initialFailed])

  useEffect(() => {
    const world = drawn.current
    if (!world) return
    let cancelled = false
    setStatus('loading')
    const currentPosts = latestPosts.current
    const slugs = currentPosts.map((post) => post.slug)
    residents.current = createResidents(slugs, layoutResidentHomes(slugs.length))
    settleResidents(world, residents.current)
    const designs = designResidents(currentPosts)
    if (hadSize.current && !islandSession.view) setView(homeView(initialTarget.current))
    function fail() {
      if (cancelled) return
      renderer.current?.dispose()
      renderer.current = null
      setStatus('failed')
    }
    void loadRenderer()
      .then((module) => {
        if (cancelled || !canvas.current) return
        renderer.current = module.createIslandRenderer(canvas.current, {
          world,
          residents: residents.current,
          designs,
          onFrame: (positions, nextView) => {
            view.current = nextView
            islandSession.view = nextView
            positionsCallback.current(positions, nextView)
          },
          onFailure: fail
        })
        renderer.current.setView(view.current, sizeRef.current)
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Island renderer unavailable', error)
        fail()
      })
    return () => {
      cancelled = true
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [postsKey, islandKey, setView, homeView])

  const editBlocked = useCallback(() => {
    const live = connection.current
    if (!live || !confirmed.current || stroke.current?.sent) return true
    return live.editBlock() !== null || !live.canSendSoon()
  }, [])

  // Shows what the current tool would do at a screen point, and why not.
  const previewAt = useCallback(
    (point: { x: number; y: number } | null, options: EditOptions): CursorInfo => {
      if (!point || !drawn.current) {
        renderer.current?.setCursor(null)
        return null
      }
      const tile = tileAt(view.current, sizeRef.current, point)
      const plan = planBrush(drawn.current, tile.x, tile.y, options)
      const settled = settledTile.current
      if (settled && (settled.x !== tile.x || settled.y !== tile.y)) settledTile.current = null
      const soft = plan.soft || (settledTile.current !== null && !plan.edits.length)
      renderer.current?.setCursor({ tiles: plan.tiles, soft, center: tile })
      return { reason: plan.reason, soft, ...point }
    },
    []
  )

  // Adds the tiles under a pointer path to the stroke, up to its limit.
  const extend = useCallback(
    (tiles: Array<{ x: number; y: number }>, options: EditOptions) => {
      const base = confirmed.current
      const current = stroke.current
      const world = drawn.current
      if (!base || !current || !world) return { reason: null, soft: false }
      let reason: string | null = null
      let soft = false
      for (const step of tiles) {
        const before = current.targets.length
        collectStrokeTargets(
          base,
          current.command,
          current.targets,
          brushIndices(base, step.x, step.y, options),
          current.limit
        )
        if (current.targets.length > before) continue
        const plan = planBrush(world, step.x, step.y, options)
        if (plan.reason && !plan.soft) reason = plan.reason
        else if (plan.reason && !reason) {
          reason = plan.reason
          soft = true
        }
      }
      redraw([])
      return { reason, soft }
    },
    [redraw]
  )

  const strokeTo = useCallback(
    (point: { x: number; y: number }, options: EditOptions) => {
      if (!stroke.current || stroke.current.sent || !drawn.current) return null
      const tile = tileAt(view.current, sizeRef.current, point)
      const path = lastStrokeTile.current
        ? tilesAlong(lastStrokeTile.current, tile).slice(1)
        : [tile]
      lastStrokeTile.current = tile
      const { reason, soft } = extend(path, options)
      const after = planBrush(drawn.current, tile.x, tile.y, options)
      renderer.current?.setCursor({ tiles: after.tiles, soft: true, center: tile })
      return { reason, soft, ...point }
    },
    [extend]
  )

  const startStroke = useCallback(
    (options: EditOptions) => {
      const live = connection.current
      if (!live || editBlocked()) return false
      stroke.current = {
        command: commandOf(options),
        targets: [],
        limit: live.strokeLimit(),
        sent: false
      }
      return true
    },
    [editBlocked]
  )

  // Sends the finished stroke as one batch, or drops it.
  const finish = useCallback(() => {
    const current = stroke.current
    const live = connection.current
    if (!current || current.sent) return false
    if (current.targets.length && live?.sendEdit(current.command, current.targets)) {
      current.sent = true
      return true
    }
    stroke.current = null
    redraw([])
    return false
  }, [redraw])

  const edits = {
    begin(point: { x: number; y: number }, options: EditOptions) {
      lastStrokeTile.current = null
      if (!startStroke(options)) return null
      return strokeTo(point, options)
    },
    move: strokeTo,
    end(cancel: boolean) {
      const tile = lastStrokeTile.current
      lastStrokeTile.current = null
      settledTile.current = null
      if (!stroke.current || stroke.current.sent) return
      if (cancel) {
        // Only this visitor's unsent preview goes; the confirmed island stays.
        stroke.current = null
        redraw([])
      } else if (finish()) settledTile.current = tile
    },
    // Applies the tool once at a tile, for keyboard editing.
    applyAt(tile: { x: number; y: number }, options: EditOptions) {
      const world = drawn.current
      if (!world) return null
      const plan = planBrush(world, tile.x, tile.y, options)
      if (!startStroke(options)) return plan
      extend([tile], options)
      finish()
      return plan
    }
  }

  return {
    status,
    size,
    zoom,
    shared,
    surface,
    canvas,
    renderer,
    view,
    sizeRef,
    setView,
    homeView,
    preview: previewAt,
    editBlocked,
    edits
  }
}
export type IslandScene = ReturnType<typeof useIsland>
