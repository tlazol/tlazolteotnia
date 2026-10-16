import { useEffect, useRef, useState } from 'react'
import { createTownInput, type TownInputBindings } from '#/lib/town-input'
import type { useTownRenderer } from './use-town-renderer'

export function useTownInput(
  scene: ReturnType<typeof useTownRenderer>,
  rotateMode: boolean,
  setActiveSlug: (slug: string | null) => void,
  selectResident: (slug: string) => void
) {
  const [dragging, setDragging] = useState(false)
  const [draggedSlug, setDraggedSlug] = useState<string | null>(null)
  const latest = useRef({ scene, rotateMode, setActiveSlug, selectResident })
  latest.current = { scene, rotateMode, setActiveSlug, selectResident }
  const [input] = useState(() =>
    createTownInput({
      renderer: () => latest.current.scene.renderer.current,
      surface: () => latest.current.scene.surface.current,
      view: () => latest.current.scene.currentView.current,
      size: () => latest.current.scene.size,
      ready: () => latest.current.scene.status === 'ready',
      rotateMode: () => latest.current.rotateMode,
      updateView: (view) => latest.current.scene.updateView(view),
      setActiveSlug: (slug) => latest.current.setActiveSlug(slug),
      selectResident: (slug) => latest.current.selectResident(slug),
      setDragging,
      setDraggedSlug
    } satisfies TownInputBindings)
  )
  useEffect(() => {
    window.addEventListener('blur', input.cancelGesture)
    return () => {
      window.removeEventListener('blur', input.cancelGesture)
      input.cancelGesture()
    }
  }, [input])
  useEffect(() => {
    const element = scene.surface.current
    if (!element || scene.status !== 'ready') {
      input.cancelGesture()
      return
    }
    element.addEventListener('wheel', input.wheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', input.wheel)
      input.cancelGesture()
    }
  }, [scene.status, scene.surface, input])
  return { input, dragging, draggedSlug }
}
