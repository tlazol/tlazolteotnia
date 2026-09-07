import { createClientOnlyFn } from '@tanstack/react-start'
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import type {
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  WebGLRenderer
} from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  getAffectedCells,
  getCellCoordinates,
  getCellIndex,
  getNeighbor,
  LIGHTS_OUT_FACE_FRAMES,
  LIGHTS_OUT_FACE_SIZE,
  type LightsOutBoard,
  type LightsOutDirection,
  type LightsOutFace
} from '#/lib/lights-out'

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

type MeshStandardMaterialConstructor = typeof import('three')['MeshStandardMaterial']

const loadLightsOutThree = createClientOnlyFn(() => import('#/lib/lights-out-three.client'))

const keyDirections: Partial<Record<string, LightsOutDirection>> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left'
}
const baseCameraFov = 32

export function LightsOutCube({ board, cleared, hintedCell, onPress }: LightsOutCubeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const raycasterRef = useRef<Raycaster | null>(null)
  const pointerVectorRef = useRef<Vector2 | null>(null)
  const tilesRef = useRef<Mesh[]>([])
  const boardRef = useRef(board)
  const clearedRef = useRef(cleared)
  const hintedCellRef = useRef(hintedCell)
  const highlightedRef = useRef<Set<number>>(new Set())
  const activeCellRef = useRef(getCellIndex('front', 1, 1))
  const pointerStartRef = useRef<PointerStart | null>(null)
  const keyboardFocusedRef = useRef(false)
  const focusCellRef = useRef<(index: number) => void>(() => undefined)
  const updateTilesRef = useRef<() => void>(() => undefined)
  const onPressRef = useRef(onPress)
  const [activeCell, setActiveCell] = useState(activeCellRef.current)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    boardRef.current = board
    clearedRef.current = cleared
    updateTilesRef.current()
  }, [board, cleared])

  useEffect(() => {
    onPressRef.current = onPress
  }, [onPress])

  useEffect(() => {
    hintedCellRef.current = hintedCell
    updateTilesRef.current()
    if (hintedCell === null) return

    activeCellRef.current = hintedCell
    setActiveCell(hintedCell)
    focusCellRef.current(hintedCell)
  }, [hintedCell])

  useEffect(() => {
    let disposed = false
    let frame = 0
    let resizeObserver: ResizeObserver | undefined
    const disposables: { dispose: () => void }[] = []

    async function initialize() {
      const canvas = canvasRef.current
      if (!canvas) return

      try {
        const {
          AgXToneMapping,
          BoxGeometry,
          DirectionalLight,
          EdgesGeometry,
          HemisphereLight,
          LineBasicMaterial,
          LineSegments,
          MathUtils,
          Matrix4,
          Mesh,
          MeshStandardMaterial,
          OrbitControls,
          PerspectiveCamera,
          PointLight,
          Raycaster,
          RoundedBoxGeometry,
          Scene,
          SRGBColorSpace,
          Vector2,
          Vector3,
          WebGLRenderer
        } = await loadLightsOutThree()
        if (disposed) return

        const scene = new Scene()
        const camera = new PerspectiveCamera(baseCameraFov, 1, 0.1, 100)
        camera.position.set(5.6, 4.3, 7.2)
        camera.lookAt(0, 0, 0)
        cameraRef.current = camera

        const renderer = new WebGLRenderer({
          alpha: true,
          antialias: true,
          canvas,
          powerPreference: 'high-performance'
        })
        renderer.setClearColor(0x000000, 0)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.outputColorSpace = SRGBColorSpace
        renderer.toneMapping = AgXToneMapping
        renderer.toneMappingExposure = 0.76
        rendererRef.current = renderer

        const controls = new OrbitControls(camera, canvas)
        controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        controls.dampingFactor = 0.07
        controls.enablePan = false
        controls.minDistance = 6.4
        controls.maxDistance = 10.5
        controls.rotateSpeed = 0.72
        controls.zoomSpeed = 0.7
        controlsRef.current = controls

        scene.add(new HemisphereLight(0x405dff, 0x08000f, 0.25))
        const keyLight = new DirectionalLight(0xd05cff, 2.1)
        keyLight.position.set(-4, 7, 6)
        scene.add(keyLight)
        const rimLight = new PointLight(0xff2bd6, 1.8, 18)
        rimLight.position.set(-5, 2, -3)
        scene.add(rimLight)
        const fillLight = new PointLight(0x00f5ff, 1.15, 16)
        fillLight.position.set(5, 0, -4)
        scene.add(fillLight)

        const baseGeometry = new BoxGeometry(3.16, 3.16, 3.16)
        const baseMaterial = new MeshStandardMaterial({
          color: 0x03020c,
          metalness: 0.38,
          roughness: 0.64
        })
        const base = new Mesh(baseGeometry, baseMaterial)
        scene.add(base)
        disposables.push(baseGeometry, baseMaterial)

        const edgesGeometry = new EdgesGeometry(baseGeometry)
        const edgesMaterial = new LineBasicMaterial({
          color: 0x665cff,
          transparent: true,
          opacity: 0.68
        })
        scene.add(new LineSegments(edgesGeometry, edgesMaterial))
        disposables.push(edgesGeometry, edgesMaterial)

        const tileGeometry = new RoundedBoxGeometry(0.82, 0.82, 0.11, 3, 0.055)
        const materials = createTileMaterials(MeshStandardMaterial)
        disposables.push(tileGeometry, ...materials)

        for (const frameDefinition of LIGHTS_OUT_FACE_FRAMES) {
          const normal = new Vector3(...frameDefinition.normal)
          const right = new Vector3(...frameDefinition.right)
          const down = new Vector3(...frameDefinition.down)
          const up = down.clone().negate()
          const orientation = new Matrix4().makeBasis(right, up, normal)

          for (let row = 0; row < LIGHTS_OUT_FACE_SIZE; row += 1) {
            for (let column = 0; column < LIGHTS_OUT_FACE_SIZE; column += 1) {
              const index = getCellIndex(frameDefinition.face, row, column)
              const tile = new Mesh(tileGeometry, materials[0])
              tile.position
                .copy(normal)
                .multiplyScalar(1.635)
                .addScaledVector(right, (column - 1) * 0.91)
                .addScaledVector(down, (row - 1) * 0.91)
              tile.quaternion.setFromRotationMatrix(orientation)
              tile.userData.cellIndex = index
              scene.add(tile)
              tilesRef.current[index] = tile
            }
          }
        }

        raycasterRef.current = new Raycaster()
        pointerVectorRef.current = new Vector2()
        updateTilesRef.current = () => {
          const currentBoard = boardRef.current
          const highlighted = highlightedRef.current
          const currentHint = hintedCellRef.current
          for (let index = 0; index < tilesRef.current.length; index += 1) {
            const tile = tilesRef.current[index]
            if (!tile) continue
            const lit = Boolean(currentBoard[index])
            tile.material =
              currentHint === index
                ? materials[lit ? 5 : 4]
                : materials[lit ? (highlighted.has(index) ? 3 : 1) : highlighted.has(index) ? 2 : 0]
            tile.scale.setScalar(currentHint === index ? 1.12 : 1)
          }
        }
        updateTilesRef.current()
        focusCellRef.current = (index) => focusFace(getCellCoordinates(index).face)
        if (hintedCellRef.current !== null) focusCellRef.current(hintedCellRef.current)

        const resize = () => {
          const { width, height } = canvas.getBoundingClientRect()
          if (width === 0 || height === 0) return
          const aspect = width / height
          renderer.setSize(width, height, false)
          camera.aspect = aspect
          camera.fov =
            aspect < 1
              ? MathUtils.radToDeg(
                  2 * Math.atan(Math.tan(MathUtils.degToRad(baseCameraFov) / 2) / aspect)
                )
              : baseCameraFov
          camera.updateProjectionMatrix()
        }
        resize()
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(canvas)

        const render = () => {
          controls.update()
          renderer.render(scene, camera)
          frame = window.requestAnimationFrame(render)
        }
        render()
        setLoadState('ready')
      } catch (error) {
        console.error('Unable to initialize the Lights Out cube', error)
        if (!disposed) setLoadState('error')
      }
    }

    void initialize()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      controlsRef.current?.dispose()
      rendererRef.current?.dispose()
      for (const disposable of disposables) disposable.dispose()
      tilesRef.current = []
      cameraRef.current = null
      controlsRef.current = null
      rendererRef.current = null
      raycasterRef.current = null
      pointerVectorRef.current = null
      focusCellRef.current = () => undefined
      updateTilesRef.current = () => undefined
    }
  }, [])

  const pickCell = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    const camera = cameraRef.current
    const raycaster = raycasterRef.current
    const pointer = pointerVectorRef.current
    if (!canvas || !camera || !raycaster || !pointer) return null

    const bounds = canvas.getBoundingClientRect()
    pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(tilesRef.current, false)[0]
    return typeof hit?.object.userData.cellIndex === 'number'
      ? (hit.object.userData.cellIndex as number)
      : null
  }, [])

  const highlightCell = useCallback((index: number | null) => {
    highlightedRef.current = new Set(index === null ? [] : getAffectedCells(index))
    updateTilesRef.current()
  }, [])

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    keyboardFocusedRef.current = false
    pointerStartRef.current = {
      index: pickCell(event.clientX, event.clientY),
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
      if (nextFace !== previousFace) focusFace(nextFace)
      return
    }

    if ((event.key === 'Enter' || event.key === ' ') && !clearedRef.current) {
      event.preventDefault()
      onPressRef.current(activeCellRef.current)
    }
  }

  function focusFace(face: LightsOutFace) {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const definition = LIGHTS_OUT_FACE_FRAMES.find((candidate) => candidate.face === face)
    if (!camera || !controls || !definition) return

    const [nx, ny, nz] = definition.normal
    const [rx, ry, rz] = definition.right
    const [dx, dy, dz] = definition.down
    camera.position.set(
      nx * 7 + rx * 2.4 - dx * 2.4,
      ny * 7 + ry * 2.4 - dy * 2.4,
      nz * 7 + rz * 2.4 - dz * 2.4
    )
    controls.update()
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

function createTileMaterials(
  MeshStandardMaterialClass: MeshStandardMaterialConstructor
): MeshStandardMaterial[] {
  const shared = { metalness: 0.16, roughness: 0.34 }
  return [
    new MeshStandardMaterialClass({
      ...shared,
      color: 0x080a22,
      emissive: 0x050114,
      emissiveIntensity: 0.12
    }),
    new MeshStandardMaterialClass({
      ...shared,
      color: 0xb8007c,
      emissive: 0xff007a,
      emissiveIntensity: 0.58
    }),
    new MeshStandardMaterialClass({
      ...shared,
      color: 0x00899a,
      emissive: 0x00d9ff,
      emissiveIntensity: 0.44
    }),
    new MeshStandardMaterialClass({
      ...shared,
      color: 0x6930b8,
      emissive: 0x7c3cff,
      emissiveIntensity: 0.52
    }),
    new MeshStandardMaterialClass({
      ...shared,
      color: 0x5f4900,
      emissive: 0xffc400,
      emissiveIntensity: 0.9
    }),
    new MeshStandardMaterialClass({
      ...shared,
      color: 0xffa000,
      emissive: 0xffed75,
      emissiveIntensity: 1
    })
  ]
}
