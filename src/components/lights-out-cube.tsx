import { createClientOnlyFn } from '@tanstack/react-start'
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import {
  getCellCoordinates,
  getCellIndex,
  getNeighbor,
  type LightsOutBoard,
  type LightsOutDirection
} from '#/lib/lights-out'
import type { LightsOutScene } from '#/lib/lights-out-three.client'

type LightsOutCubeProps = {
  board: LightsOutBoard
  cleared: boolean
  hintedCell: number | null
  onPress: (index: number) => void
}

type PointerStart = {
  index: number | null
  x: number
  y: number
}

const loadLightsOutThree = createClientOnlyFn(() => import('#/lib/lights-out-three.client'))

const keyDirections: Partial<Record<string, LightsOutDirection>> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left'
}

export function LightsOutCube({ board, cleared, hintedCell, onPress }: LightsOutCubeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<LightsOutScene | null>(null)
  const boardRef = useRef(board)
  const clearedRef = useRef(cleared)
  const hintedCellRef = useRef(hintedCell)
  const highlightedRef = useRef<number | null>(null)
  const activeCellRef = useRef(getCellIndex('front', 1, 1))
  const pointerStartRef = useRef<PointerStart | null>(null)
  const keyboardFocusedRef = useRef(false)
  const onPressRef = useRef(onPress)
  const [activeCell, setActiveCell] = useState(activeCellRef.current)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    boardRef.current = board
    clearedRef.current = cleared
    sceneRef.current?.update(boardRef.current, hintedCellRef.current)
  }, [board, cleared])

  useEffect(() => {
    onPressRef.current = onPress
  }, [onPress])

  useEffect(() => {
    hintedCellRef.current = hintedCell
    sceneRef.current?.update(boardRef.current, hintedCellRef.current)
    if (hintedCell === null) return

    activeCellRef.current = hintedCell
    setActiveCell(hintedCell)
    sceneRef.current?.focusFace(getCellCoordinates(hintedCell).face)
  }, [hintedCell])

  useEffect(() => {
    let disposed = false
    let scene: LightsOutScene | undefined
    setLoadState('loading')
    function fail(error: unknown) {
      if (disposed) return
      scene?.dispose()
      sceneRef.current = null
      console.error('Lights Out cube unavailable', error)
      setLoadState('error')
    }
    async function initialize() {
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        const { createLightsOutScene } = await loadLightsOutThree()
        if (disposed) return
        scene = createLightsOutScene(canvas, boardRef.current, fail)
        sceneRef.current = scene
        scene.update(boardRef.current, hintedCellRef.current)
        scene.highlight(highlightedRef.current)
        if (hintedCellRef.current !== null)
          scene.focusFace(getCellCoordinates(hintedCellRef.current).face)
        setLoadState('ready')
      } catch (error) {
        fail(error)
      }
    }
    void initialize()
    return () => {
      disposed = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [])

  const pickCell = useCallback(
    (clientX: number, clientY: number) => sceneRef.current?.pickCell(clientX, clientY) ?? null,
    []
  )

  const highlightCell = useCallback((index: number | null) => {
    highlightedRef.current = index
    sceneRef.current?.highlight(index)
  }, [])

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    keyboardFocusedRef.current = false
    const index = pickCell(event.clientX, event.clientY)
    if (index !== null) {
      activeCellRef.current = index
      setActiveCell(index)
    }
    pointerStartRef.current = {
      index,
      x: event.clientX,
      y: event.clientY
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType !== 'mouse' || event.buttons !== 0) return
    const index = pickCell(event.clientX, event.clientY)
    if (index !== null) activeCellRef.current = index
    highlightCell(index)
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start || clearedRef.current) return

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    const index = pickCell(event.clientX, event.clientY)
    if (distance < 7 && index !== null && index === start.index) onPressRef.current(index)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const direction = keyDirections[event.key]
    if (direction) {
      event.preventDefault()
      const previousFace = getCellCoordinates(activeCellRef.current).face
      activeCellRef.current = getNeighbor(activeCellRef.current, direction)
      setActiveCell(activeCellRef.current)
      highlightCell(activeCellRef.current)
      const nextFace = getCellCoordinates(activeCellRef.current).face
      if (nextFace !== previousFace) sceneRef.current?.focusFace(nextFace)
      return
    }

    if ((event.key === 'Enter' || event.key === ' ') && !clearedRef.current) {
      event.preventDefault()
      onPressRef.current(activeCellRef.current)
    }
  }

  const active = getCellCoordinates(activeCell)
  const hint = hintedCell === null ? null : getCellCoordinates(hintedCell)

  return (
    <div className="lights-out-cube-shell">
      <canvas
        aria-disabled={cleared}
        aria-label="3D Lights Out cube. Use arrow keys to select adjacent lights and Enter or Space to press."
        className="lights-out-cube"
        onBlur={() => {
          keyboardFocusedRef.current = false
          highlightCell(null)
        }}
        onFocus={() => {
          if (pointerStartRef.current) return
          keyboardFocusedRef.current = true
          highlightCell(activeCellRef.current)
        }}
        onKeyDown={handleKeyDown}
        onPointerCancel={() => {
          pointerStartRef.current = null
        }}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => {
          if (!keyboardFocusedRef.current) highlightCell(null)
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={canvasRef}
        tabIndex={0}
      />
      <p className="sr-only" aria-live="polite">
        {hint
          ? `Hint: press the ${hint.face} face, row ${hint.row + 1}, column ${hint.column + 1}.`
          : `Selected light: ${active.face} face, row ${active.row + 1}, column ${active.column + 1}, light ${board[activeCell] ? 'on' : 'off'}.`}
      </p>
      {loadState === 'loading' && (
        <p className="lights-out-cube__message" role="status">
          Initializing cube…
        </p>
      )}
      {loadState === 'error' && (
        <p className="lights-out-cube__message lights-out-cube__message--error" role="alert">
          3D view is unavailable in this browser.
        </p>
      )}
    </div>
  )
}

export function LightsOutCubeFallback() {
  return (
    <div className="lights-out-cube-shell lights-out-cube-shell--fallback" aria-hidden="true">
      <div className="lights-out-cube-placeholder" />
      <p className="lights-out-cube__message">Initializing cube…</p>
    </div>
  )
}
