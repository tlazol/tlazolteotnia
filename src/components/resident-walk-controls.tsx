import { useCallback, useEffect, useRef, useState } from 'react'
import type { IslandRenderer } from '#/lib/island-three.client'

const directions = [
  { label: '前進', symbol: '↑', x: 0, y: -1, keys: ['ArrowUp', 'KeyW'] },
  { label: '左に移動', symbol: '←', x: -1, y: 0, keys: ['ArrowLeft', 'KeyA'] },
  { label: '後退', symbol: '↓', x: 0, y: 1, keys: ['ArrowDown', 'KeyS'] },
  { label: '右に移動', symbol: '→', x: 1, y: 0, keys: ['ArrowRight', 'KeyD'] }
]
type Direction = (typeof directions)[number]
const autoResumeMs = 4000

export function ResidentWalkControls({ renderer }: { renderer: IslandRenderer }) {
  const [manual, setManual] = useState(false)
  const held = useRef(new Map<string, Direction>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const resume = useCallback(() => {
    held.current.clear()
    clearTimeout(timer.current)
    renderer.setWalkInput(null)
    setManual(false)
  }, [renderer])

  const update = useCallback(
    (source: string, direction?: Direction) => {
      if (direction) held.current.set(source, direction)
      else if (!held.current.delete(source)) return
      clearTimeout(timer.current)
      let x = 0
      let y = 0
      for (const dir of new Set(held.current.values())) {
        x += dir.x
        y += dir.y
      }
      renderer.setWalkInput({ x, y })
      setManual(true)
      if (!held.current.size) timer.current = setTimeout(resume, autoResumeMs)
    },
    [renderer, resume]
  )

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.isComposing ||
        (event.target instanceof Element &&
          event.target.closest('header, dialog, input, textarea, select, [contenteditable="true"]'))
      )
        return
      const dir = directions.find(({ keys }) => keys.includes(event.code))
      if (!dir) return
      event.preventDefault()
      if (!event.repeat) update(event.code, dir)
    }
    function keyup(event: KeyboardEvent) {
      update(event.code)
    }
    function visibility() {
      if (document.hidden) resume()
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', resume)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', resume)
      document.removeEventListener('visibilitychange', visibility)
      clearTimeout(timer.current)
      renderer.setWalkInput(null)
    }
  }, [renderer, resume, update])

  return (
    <fieldset className="resident-walk" aria-label="住民の移動">
      <div role="status">{manual ? '手動移動' : '自動移動'}</div>
      <div className="resident-walk__pad">
        {directions.map((dir) => (
          <button
            key={dir.label}
            type="button"
            aria-label={dir.label}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.currentTarget.setPointerCapture(event.pointerId)
              update(String(event.pointerId), dir)
            }}
            onLostPointerCapture={(event) => update(String(event.pointerId))}
            onClick={(event) => {
              if (event.detail !== 0) return
              update('click', dir)
              update('click')
            }}
          >
            {dir.symbol}
          </button>
        ))}
      </div>
      <small>WASD / 矢印キー</small>
    </fieldset>
  )
}
