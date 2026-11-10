import {
  clampView,
  type IslandView,
  nearestZoom,
  panView,
  screenToWorld,
  stepZoom,
  zoomViewAt
} from './island-camera'
import type { SceneSize } from './scene-math'

type Point = { x: number; y: number }
// Both DOM and React pointer events fit this shape.
type PointerLike = {
  pointerId: number
  pointerType: string
  button: number
  clientX: number
  clientY: number
  type: string
  target: EventTarget | null
  preventDefault: () => void
}

export type IslandInputBindings = {
  surface: () => HTMLElement | null
  view: () => IslandView
  size: () => SceneSize
  setView: (view: IslandView) => void
  ready: () => boolean
  editing: () => boolean
  // Hand tool or held Space: the primary button pans even while editing.
  panning: () => boolean
  hover: (point: Point | null) => void
  strokeStart: (point: Point) => void
  strokeMove: (point: Point) => void
  strokeEnd: (cancel: boolean) => void
  tap: (point: Point) => void
  setDragging: (dragging: boolean) => void
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; start: Point; view: IslandView; moved: boolean; id: number }
  | { kind: 'stroke'; id: number }
  | { kind: 'pinch'; distance: number; mid: Point; view: IslandView }

// Editing: one finger or the left button edits; two fingers, the right/middle
// button, Space or the hand tool move the camera. Viewing: any drag pans.
export function createIslandInput(bind: IslandInputBindings) {
  const pointers = new Map<number, Point>()
  let gesture: Gesture = { kind: 'none' }
  let wheelDelta = 0

  function local(event: { clientX: number; clientY: number }): Point {
    const rect = bind.surface()?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }
  function pinchState(): Gesture {
    const [a, b] = [...pointers.values()]
    return {
      kind: 'pinch',
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      view: bind.view()
    }
  }
  function end(cancel = false) {
    if (gesture.kind === 'stroke') bind.strokeEnd(cancel)
    if (gesture.kind !== 'none') bind.setDragging(false)
    gesture = { kind: 'none' }
  }

  return {
    pointerDown(event: PointerLike) {
      if (!bind.ready()) return
      const target = event.target as Element | null
      // Residents, the bubble and toolbars handle their own clicks.
      if (target?.closest('button, a, [data-island-ui]')) return
      const point = local(event)
      pointers.set(event.pointerId, point)
      bind.surface()?.setPointerCapture?.(event.pointerId)
      if (pointers.size === 2) {
        // A second finger turns a just-started edit into a camera gesture.
        if (gesture.kind === 'stroke') bind.strokeEnd(true)
        bind.hover(null)
        gesture = pinchState()
        bind.setDragging(true)
        return
      }
      if (pointers.size > 2) return
      const camera = event.button === 1 || event.button === 2 || bind.panning() || !bind.editing()
      if (!camera && event.button === 0) {
        gesture = { kind: 'stroke', id: event.pointerId }
        bind.strokeStart(point)
        return
      }
      event.preventDefault()
      gesture = { kind: 'pan', start: point, view: bind.view(), moved: false, id: event.pointerId }
    },
    pointerMove(event: PointerLike) {
      const point = local(event)
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point)
      if (gesture.kind === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const distance = Math.hypot(b.x - a.x, b.y - a.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const zoom = nearestZoom(gesture.view.zoom * (distance / gesture.distance))
        const zoomed = zoomViewAt(gesture.view, bind.size(), zoom, gesture.mid)
        bind.setView(panView(zoomed, bind.size(), mid.x - gesture.mid.x, mid.y - gesture.mid.y))
        return
      }
      if (gesture.kind === 'pan' && gesture.id === event.pointerId) {
        const dx = point.x - gesture.start.x
        const dy = point.y - gesture.start.y
        if (!gesture.moved && Math.hypot(dx, dy) < 4) return
        if (!gesture.moved) bind.setDragging(true)
        gesture.moved = true
        bind.setView(panView(gesture.view, bind.size(), dx, dy))
        return
      }
      if (gesture.kind === 'stroke' && gesture.id === event.pointerId) {
        bind.strokeMove(point)
        return
      }
      if (gesture.kind === 'none' && event.pointerType !== 'touch' && bind.editing())
        bind.hover(bind.panning() ? null : point)
    },
    pointerUp(event: PointerLike) {
      if (!pointers.has(event.pointerId)) return
      const point = local(event)
      pointers.delete(event.pointerId)
      if (gesture.kind === 'pinch') {
        if (pointers.size === 0) end()
        else if (pointers.size === 1) {
          // Keep panning with the finger that stayed down.
          const [id, rest] = [...pointers.entries()][0]
          gesture = { kind: 'pan', start: rest, view: bind.view(), moved: true, id }
        }
        return
      }
      if (gesture.kind === 'pan' && !gesture.moved && event.type === 'pointerup') bind.tap(point)
      end()
      if (event.pointerType !== 'touch' && bind.editing()) bind.hover(point)
    },
    pointerCancel(event: PointerLike) {
      pointers.delete(event.pointerId)
      // A cancelled touch (e.g. the browser took over) undoes the partial stroke.
      if (pointers.size === 0) end(true)
    },
    pointerLeave(event: PointerLike) {
      if (event.pointerType !== 'touch' && gesture.kind === 'none') bind.hover(null)
    },
    wheel(event: WheelEvent) {
      if (!bind.ready()) return
      event.preventDefault()
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
      wheelDelta += event.deltaY * scale
      const threshold = event.ctrlKey ? 24 : 60
      if (Math.abs(wheelDelta) < threshold) return
      const direction = wheelDelta < 0 ? 1 : -1
      wheelDelta = 0
      const view = bind.view()
      const zoom = stepZoom(view.zoom, direction)
      if (zoom !== view.zoom) bind.setView(zoomViewAt(view, bind.size(), zoom, local(event)))
    },
    cancel() {
      pointers.clear()
      end(true)
    },
    worldAt(point: Point) {
      return screenToWorld(bind.view(), bind.size(), point)
    },
    clamp(view: IslandView) {
      return clampView(view, bind.size())
    }
  }
}
export type IslandInput = ReturnType<typeof createIslandInput>
