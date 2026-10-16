import type { MouseEvent, PointerEvent } from 'react'
import type { SceneSize } from './scene-math'
import type { createArticleTown } from './town-articles.client'
import { gestureTownView, rotateTownAt, type TownView, zoomTownAt } from './town-view'

type Point = { x: number; y: number; pointerType: string }

export type TownInputBindings = {
  renderer: () => ReturnType<typeof createArticleTown> | null
  surface: () => HTMLDivElement | null
  view: () => TownView
  size: () => SceneSize
  ready: () => boolean
  rotateMode: () => boolean
  updateView: (view: TownView) => void
  setActiveSlug: (slug: string | null) => void
  setDragging: (dragging: boolean) => void
  setDraggedSlug: (slug: string | null) => void
  selectResident: (slug: string) => void
}

export function createTownInput(bindings: TownInputBindings) {
  const pointers = new Map<number, Point>()
  let origin: Point | null = null
  let didDrag = false
  let rotateDrag = false
  let residentDrag: { slug: string; pointerId: number; started: boolean } | null = null
  let releasedResident: string | null = null
  function point(event: PointerEvent) {
    const rect = bindings.surface()?.getBoundingClientRect()
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
      pointerType: event.pointerType
    }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!bindings.ready() || event.button !== 0 || pointers.size >= 2) return
    if (!pointers.size && event.target instanceof Element && event.target.closest('.town-bubble')) {
      didDrag = false
      return
    }
    if (!pointers.size) {
      didDrag = false
      origin = point(event)
      rotateDrag = event.pointerType !== 'touch' && bindings.rotateMode()
      const person = event.target instanceof Element ? event.target.closest('.town-person') : null
      const slug = rotateDrag ? null : person?.getAttribute('data-slug')
      if (slug) {
        residentDrag = { slug, pointerId: event.pointerId, started: false }
        bindings.renderer()?.focus(slug)
        event.currentTarget.setPointerCapture(event.pointerId)
      } else {
        bindings.renderer()?.follow(null)
        if (!person) event.currentTarget.setPointerCapture(event.pointerId)
      }
    }
    if (
      pointers.size &&
      (event.pointerType !== 'touch' || [...pointers.values()][0].pointerType !== 'touch')
    )
      return
    pointers.set(event.pointerId, point(event))
    if (pointers.size > 1) {
      bindings.renderer()?.endResidentDrag(true)
      residentDrag = null
      bindings.setDraggedSlug(null)
      bindings.renderer()?.follow(null)
      bindings.renderer()?.focus(null)
      for (const id of pointers.keys()) event.currentTarget.setPointerCapture(id)
      didDrag = true
      bindings.setDragging(true)
    }
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!bindings.ready() || !pointers.has(event.pointerId)) return
    const previous = [...pointers.values()]
    const before = pointers.get(event.pointerId)
    if (!before) return
    const next = point(event)
    pointers.set(event.pointerId, next)
    if (origin && Math.hypot(next.x - origin.x, next.y - origin.y) > 6) didDrag = true
    if (!didDrag) return
    event.currentTarget.setPointerCapture(event.pointerId)
    bindings.setDragging(true)
    const resident = residentDrag
    if (resident) {
      const start = resident.started ? before : (origin ?? before)
      if (!resident.started) {
        resident.started = true
        bindings.setActiveSlug(null)
        bindings.setDraggedSlug(resident.slug)
        bindings.renderer()?.beginResidentDrag(resident.slug)
      }
      bindings.renderer()?.moveResidentDrag(next.x - start.x, next.y - start.y)
      return
    }
    bindings.renderer()?.focus(null)
    if (pointers.size === 2) {
      const after = [...pointers.values()]
      bindings.updateView(
        gestureTownView(bindings.view(), [previous[0], previous[1]], [after[0], after[1]])
      )
    } else if (rotateDrag) {
      bindings.updateView(
        rotateTownAt(bindings.view(), ((next.x - before.x) / bindings.size().width) * Math.PI * 2, {
          x: bindings.size().width / 2,
          y: bindings.size().height / 2
        })
      )
    } else
      bindings.updateView({
        ...bindings.view(),
        x: bindings.view().x + next.x - before.x,
        y: bindings.view().y + next.y - before.y
      })
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.has(event.pointerId)) return
    if (event.type !== 'pointerup') {
      cancelGesture()
      return
    }
    const resident = residentDrag
    if (resident?.pointerId === event.pointerId) {
      if (resident.started) releasedResident = resident.slug
      bindings.renderer()?.endResidentDrag(event.type !== 'pointerup')
      bindings.renderer()?.focus(null)
      residentDrag = null
      bindings.setDraggedSlug(null)
      if (!resident.started && event.type === 'pointerup') {
        bindings.selectResident(resident.slug)
        // Pointer capture retargets the click to the surface; handle this tap here.
        didDrag = true
      }
    }
    if (!didDrag && !resident) bindings.setActiveSlug(null)
    pointers.delete(event.pointerId)
    origin = [...pointers.values()][0] ?? null
    if (pointers.size) rotateDrag = false
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (!pointers.size) {
      bindings.setDragging(false)
      origin = null
    }
  }
  function cancelGesture() {
    bindings.renderer()?.endResidentDrag(true)
    bindings.renderer()?.focus(null)
    residentDrag = null
    bindings.setDraggedSlug(null)
    const ids = [...pointers.keys()]
    pointers.clear()
    for (const id of ids) {
      const surface = bindings.surface()
      if (surface?.hasPointerCapture(id)) surface.releasePointerCapture(id)
    }
    origin = null
    rotateDrag = false
    didDrag = true
    bindings.setDragging(false)
  }
  function wheel(event: WheelEvent) {
    if (event.target instanceof Element && event.target.closest('.town-bubble')) return
    event.preventDefault()
    if (residentDrag) return
    const rect = bindings.surface()?.getBoundingClientRect()
    if (!rect) return
    const delta =
      event.deltaY *
      (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bindings.size().height : 1)
    bindings.renderer()?.follow(null)
    bindings.updateView(
      zoomTownAt(bindings.view(), Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      })
    )
  }

  return {
    pointerDown,
    pointerMove,
    pointerUp,
    cancelGesture,
    wheel,
    lostPointerCapture(event: PointerEvent<HTMLDivElement>) {
      if (event.target === event.currentTarget && pointers.has(event.pointerId)) pointerUp(event)
    },
    clickCapture(event: MouseEvent<HTMLDivElement>) {
      if (didDrag && event.detail !== 0) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    enterResident(slug: string) {
      if (!pointers.size && releasedResident !== slug) bindings.renderer()?.focus(slug)
    },
    leaveResident(slug: string) {
      if (releasedResident === slug) releasedResident = null
    }
  }
}
