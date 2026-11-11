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
import { createIslandStroke, type EditOptions, planBrush, tilesAlong } from '#/lib/island-edit'
import {
  createResidents,
  designResidents,
  footOf,
  type Resident,
  settleResidents
} from '#/lib/island-residents'
import type { IslandRenderer, ResidentScreen } from '#/lib/island-three.client'
import {
  createDefaultIsland,
  type IslandWorld,
  layoutResidentHomes,
  loadIsland,
  saveIsland
} from '#/lib/island-world'
import type { SceneSize } from '#/lib/scene-math'

const loadRenderer = createClientOnlyFn(() => import('#/lib/island-three.client'))

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export type IslandStatus = 'loading' | 'ready' | 'failed'
export type CursorInfo = { reason: string | null; soft: boolean; x: number; y: number } | null

export function useIsland({
  posts,
  initialSlug,
  onPositions
}: {
  // Newest first.
  posts: BlogPostSummary[]
  initialSlug: string | null
  onPositions: (positions: ResidentScreen[], view: IslandView) => void
}) {
  const [status, setStatus] = useState<IslandStatus>('loading')
  const [size, setSize] = useState<SceneSize>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(2)
  const [revision, setRevision] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle')
  const surface = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<IslandRenderer | null>(null)
  const world = useRef<IslandWorld | null>(null)
  const stroke = useRef(createIslandStroke())
  const residents = useRef<Resident[]>([])
  const view = useRef<IslandView>({ x: 0, y: 0, zoom: 2 })
  const sizeRef = useRef(size)
  sizeRef.current = size
  const positionsCallback = useRef(onPositions)
  positionsCallback.current = onPositions
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

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const { world: loaded } = loadIsland(storage())
    world.current = loaded
    stroke.current = createIslandStroke()
    const currentPosts = latestPosts.current
    const slugs = currentPosts.map((post) => post.slug)
    residents.current = createResidents(slugs, layoutResidentHomes(slugs.length))
    settleResidents(loaded, residents.current)
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
          world: loaded,
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
  }, [postsKey, setView, homeView])

  const persist = useCallback(() => {
    if (!world.current) return
    setSaveState(saveIsland(world.current, storage()) ? 'saved' : 'failed')
    setRevision((value) => value + 1)
  }, [])

  const occupied = useCallback(
    (x: number, y: number) => renderer.current?.occupied(x, y) ?? false,
    []
  )

  // Shows what the current tool would do at a screen point, and why not.
  const preview = useCallback(
    (point: { x: number; y: number } | null, options: EditOptions): CursorInfo => {
      if (!point || !world.current) {
        renderer.current?.setCursor(null)
        return null
      }
      const tile = tileAt(view.current, sizeRef.current, point)
      const plan = planBrush(world.current, tile.x, tile.y, options, occupied)
      const settled = settledTile.current
      if (settled && (settled.x !== tile.x || settled.y !== tile.y)) settledTile.current = null
      const soft = plan.soft || (settledTile.current !== null && !plan.edits.length)
      renderer.current?.setCursor({ tiles: plan.tiles, soft, center: tile })
      return { reason: plan.reason, soft, ...point }
    },
    [occupied]
  )

  const strokeTo = useCallback(
    (point: { x: number; y: number }, options: EditOptions) => {
      const current = world.current
      if (!current) return null
      const tile = tileAt(view.current, sizeRef.current, point)
      const path = lastStrokeTile.current
        ? tilesAlong(lastStrokeTile.current, tile).slice(1)
        : [tile]
      lastStrokeTile.current = tile
      let reason: string | null = null
      let soft = false
      for (const step of path) {
        const plan = planBrush(current, step.x, step.y, options, occupied)
        const changed = stroke.current.apply(current, plan.edits)
        renderer.current?.updateTiles(changed)
        if (plan.reason && !plan.soft) reason = plan.reason
        else if (plan.reason && !reason) {
          reason = plan.reason
          soft = true
        }
      }
      const after = planBrush(current, tile.x, tile.y, options, occupied)
      renderer.current?.setCursor({ tiles: after.tiles, soft: true, center: tile })
      return { reason, soft, ...point }
    },
    [occupied]
  )

  const edits = {
    begin(point: { x: number; y: number }, options: EditOptions) {
      stroke.current.begin()
      lastStrokeTile.current = null
      return strokeTo(point, options)
    },
    move: strokeTo,
    end(cancel: boolean) {
      const tile = lastStrokeTile.current
      lastStrokeTile.current = null
      settledTile.current = null
      if (!world.current) return
      if (cancel) renderer.current?.updateTiles(stroke.current.cancel(world.current))
      else if (stroke.current.commit()) {
        settledTile.current = tile
        persist()
      }
    },
    // Applies the tool once at a tile, for keyboard editing.
    applyAt(tile: { x: number; y: number }, options: EditOptions) {
      const current = world.current
      if (!current) return null
      stroke.current.begin()
      const plan = planBrush(current, tile.x, tile.y, options, occupied)
      renderer.current?.updateTiles(stroke.current.apply(current, plan.edits))
      if (stroke.current.commit()) persist()
      return plan
    },
    reset() {
      if (!world.current) return
      const target = createDefaultIsland()
      const current = world.current
      const changed = Array.from(current.ground.keys()).filter(
        (index) =>
          current.ground[index] !== target.ground[index] ||
          current.decor[index] !== target.decor[index]
      )
      current.ground.set(target.ground)
      current.decor.set(target.decor)
      renderer.current?.updateTiles(changed)
      persist()
    }
  }

  return {
    status,
    size,
    zoom,
    revision,
    saveState,
    surface,
    canvas,
    renderer,
    view,
    sizeRef,
    setView,
    homeView,
    preview,
    edits
  }
}
export type IslandScene = ReturnType<typeof useIsland>
