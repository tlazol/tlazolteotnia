import {
  clampView,
  type IslandView,
  nearestZoom,
  type Point,
  panView,
  rotateView,
  screenToWorld,
  stepZoom,
  zoomViewAt
} from './island-camera'
import type { SceneSize } from './scene-math'

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
  firstPerson: () => boolean
  lookAround: (dx: number, dy: number) => void
  eyeZoom: () => number
  setEyeZoom: (zoom: number) => void
  editing: () => boolean
  // Whether a new stroke may start now (connected, quota left, nothing pending).
  // When it may not, the primary button moves the camera instead.
  canStroke?: () => boolean
  // Hand tool or held Space: the primary button pans even while editing.
  panning: () => boolean
  hover: (point: Point | null) => void
  strokeStart: (point: Point) => void
  strokeMove: (point: Point) => void
  strokeEnd: (cancel: boolean) => void
  tap: (point: Point) => void
  setDragging: (dragging: boolean) => void
  residentStart?: (slug: string, point: Point) => void
  residentMove?: (point: Point) => void
  residentEnd?: (cancel: boolean) => void
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'eyeTap'; start: Point }
  | { kind: 'look' }
  | { kind: 'eyePinch'; distance: number; zoom: number }
  | { kind: 'trackpadPinch'; zoom: number }
  | { kind: 'pan'; start: Point; view: IslandView; moved: boolean; id: number }
  | { kind: 'rotate'; start: Point; view: IslandView; id: number }
  | { kind: 'resident'; start: Point; moved: boolean; id: number }
  | { kind: 'stroke'; id: number }
  | { kind: 'pinch'; distance: number; angle: number; anchor: Point; view: IslandView }

// A right drag or two-finger twist orbits the camera. A pinch can also pan and zoom.
export function createIslandInput(bind: IslandInputBindings) {
  const pointers = new Map<number, Point>()
  let gesture: Gesture = { kind: 'none' }
  let wheelDelta = 0
  let suppressClick = false

  function local(event: { clientX: number; clientY: number }): Point {
    const rect = bind.surface()?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }
  function pinchState(): Gesture {
    const [a, b] = [...pointers.values()]
    const view = bind.view()
    return {
      kind: 'pinch',
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      anchor: screenToWorld(view, bind.size(), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
      view
    }
  }
  function fingerDistance() {
    const [a, b] = pointers.values()
    return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
  }
  function releaseEyePointer(id: number) {
    if (!pointers.delete(id)) return
    if (pointers.size) gesture = { kind: 'look' }
    else end()
  }
  function end(cancel = false) {
    if (gesture.kind === 'stroke') bind.strokeEnd(cancel)
    if (gesture.kind === 'resident') {
      suppressClick = gesture.moved
      bind.residentEnd?.(cancel || !gesture.moved)
    }
    if (gesture.kind !== 'none') bind.setDragging(false)
    gesture = { kind: 'none' }
  }

  return {
    pointerDown(event: PointerLike) {
      if (!bind.ready()) return
      const target = event.target as Element | null
      const resident = target?.closest<HTMLElement>('[data-resident]')
      if (!resident && target?.closest('button, a, [data-island-ui]')) return
      suppressClick = false
      const point = local(event)
      if (bind.firstPerson()) {
        if (event.button !== 0 || !['none', 'eyeTap', 'look'].includes(gesture.kind)) return
        event.preventDefault()
        bind.surface()?.setPointerCapture?.(event.pointerId)
        pointers.set(event.pointerId, point)
        gesture =
          pointers.size === 1
            ? { kind: 'eyeTap', start: point }
            : { kind: 'eyePinch', distance: fingerDistance(), zoom: bind.eyeZoom() }
        bind.setDragging(true)
        return
      }
      pointers.set(event.pointerId, point)
      ;(resident ?? bind.surface())?.setPointerCapture?.(event.pointerId)
      if (pointers.size === 2) {
        // A second finger turns a just-started edit into a camera gesture.
        end(true)
        suppressClick = true
        bind.hover(null)
        gesture = pinchState()
        bind.setDragging(true)
        return
      }
      if (pointers.size > 2) return
      if (event.button === 2) {
        event.preventDefault()
        bind.hover(null)
        gesture = { kind: 'rotate', start: point, view: bind.view(), id: event.pointerId }
        bind.setDragging(true)
        return
      }
      if (
        resident &&
        !bind.editing() &&
        !bind.panning() &&
        event.button === 0 &&
        bind.residentStart
      ) {
        gesture = { kind: 'resident', start: point, moved: false, id: event.pointerId }
        bind.residentStart(
          resident.dataset.resident ?? '',
          screenToWorld(bind.view(), bind.size(), point)
        )
        return
      }
      const camera =
        event.button === 1 ||
        bind.panning() ||
        !bind.editing() ||
        (bind.canStroke ? !bind.canStroke() : false)
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
      const previous = pointers.get(event.pointerId)
      if (previous) pointers.set(event.pointerId, point)
      if (gesture.kind === 'eyeTap') {
        if (!previous) return
        const dx = point.x - gesture.start.x
        const dy = point.y - gesture.start.y
        if (Math.hypot(dx, dy) >= 4) {
          gesture = { kind: 'look' }
          bind.lookAround(dx, dy)
        }
        return
      }
      if (gesture.kind === 'look' || gesture.kind === 'eyePinch') {
        if (!previous) return
        if (gesture.kind === 'look') bind.lookAround(point.x - previous.x, point.y - previous.y)
        else bind.setEyeZoom(gesture.zoom * (fingerDistance() / gesture.distance))
        return
      }
      if (gesture.kind === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const distance = Math.hypot(b.x - a.x, b.y - a.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const zoom = nearestZoom(gesture.view.zoom * (distance / gesture.distance))
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        const next = rotateView({ ...gesture.view, zoom }, (angle - gesture.angle) / (Math.PI / 2))
        const size = bind.size()
        const underMid = screenToWorld(next, size, mid)
        bind.setView(
          clampView(
            {
              ...next,
              x: next.x + gesture.anchor.x - underMid.x,
              y: next.y + gesture.anchor.y - underMid.y
            },
            size
          )
        )
        return
      }
      if (gesture.kind === 'rotate' && gesture.id === event.pointerId) {
        // Dragging across the viewport makes one full orbit.
        bind.setView(
          rotateView(gesture.view, (4 * (gesture.start.x - point.x)) / bind.size().width)
        )
        return
      }
      if (gesture.kind === 'resident' && gesture.id === event.pointerId) {
        if (!gesture.moved && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) < 4)
          return
        if (!gesture.moved) bind.setDragging(true)
        gesture.moved = true
        bind.residentMove?.(screenToWorld(bind.view(), bind.size(), point))
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
      if (gesture.kind === 'eyeTap') {
        if (!pointers.has(event.pointerId)) return
        const point = local(event)
        const start = gesture.start
        releaseEyePointer(event.pointerId)
        if (Math.hypot(point.x - start.x, point.y - start.y) < 4) bind.tap(point)
        return
      }
      if (gesture.kind === 'look' || gesture.kind === 'eyePinch') {
        releaseEyePointer(event.pointerId)
        return
      }
      if (!pointers.has(event.pointerId)) return
      const point = local(event)
      pointers.delete(event.pointerId)
      if (gesture.kind === 'pinch') {
        suppressClick = true
        if (pointers.size === 0) end()
        else if (pointers.size >= 2) gesture = pinchState()
        else if (pointers.size === 1) {
          // Keep panning with the finger that stayed down.
          const [id, rest] = [...pointers.entries()][0]
          gesture = { kind: 'pan', start: rest, view: bind.view(), moved: true, id }
        }
        return
      }
      if (gesture.kind === 'resident' && gesture.moved)
        bind.residentMove?.(screenToWorld(bind.view(), bind.size(), point))
      if (gesture.kind === 'pan' && !gesture.moved && event.type === 'pointerup') bind.tap(point)
      if (gesture.kind === 'pan' && gesture.moved) suppressClick = true
      end()
      if (event.pointerType !== 'touch' && bind.editing()) bind.hover(point)
    },
    pointerCancel(event: PointerLike) {
      if (gesture.kind === 'eyeTap' || gesture.kind === 'look' || gesture.kind === 'eyePinch') {
        releaseEyePointer(event.pointerId)
        return
      }
      pointers.delete(event.pointerId)
      // A cancelled touch (e.g. the browser took over) undoes the partial stroke.
      end(true)
      pointers.clear()
    },
    pointerLeave(event: PointerLike) {
      if (event.pointerType !== 'touch' && gesture.kind === 'none') bind.hover(null)
    },
    wheel(event: WheelEvent) {
      if (!bind.ready()) return
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
      if (bind.firstPerson()) {
        if (!event.ctrlKey) return
        event.preventDefault()
        if (gesture.kind === 'none')
          bind.setEyeZoom(bind.eyeZoom() * Math.exp((-event.deltaY * scale) / 100))
        return
      }
      event.preventDefault()
      if (gesture.kind === 'resident' || gesture.kind === 'rotate' || gesture.kind === 'pinch')
        return
      wheelDelta += event.deltaY * scale
      const threshold = event.ctrlKey ? 24 : 60
      if (Math.abs(wheelDelta) < threshold) return
      const direction = wheelDelta < 0 ? 1 : -1
      wheelDelta = 0
      const view = bind.view()
      const zoom = stepZoom(view.zoom, direction)
      if (zoom !== view.zoom) bind.setView(zoomViewAt(view, bind.size(), zoom, local(event)))
    },
    // Safari also reports trackpad pinches as gesture events, without touch pointers.
    trackpadGesture(event: Event) {
      if (!bind.ready() || !bind.firstPerson()) return
      event.preventDefault()
      if (event.type === 'gesturestart' && gesture.kind === 'none')
        gesture = { kind: 'trackpadPinch', zoom: bind.eyeZoom() }
      if (gesture.kind !== 'trackpadPinch') return
      if (event.type === 'gestureend') gesture = { kind: 'none' }
      else if (
        event.type === 'gesturechange' &&
        'scale' in event &&
        typeof event.scale === 'number'
      )
        bind.setEyeZoom(gesture.zoom * event.scale)
    },
    consumeResidentClick() {
      const suppressed = suppressClick
      suppressClick = false
      return suppressed
    },
    cancel() {
      pointers.clear()
      end(true)
    }
  }
}
