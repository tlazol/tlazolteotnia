import '@tanstack/react-start/client-only'

import {
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
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  getAffectedCells,
  getCellIndex,
  LIGHTS_OUT_FACE_FRAMES,
  LIGHTS_OUT_FACE_SIZE,
  type LightsOutBoard,
  type LightsOutFace
} from './lights-out'

const baseCameraFov = 32
export type LightsOutScene = ReturnType<typeof createLightsOutScene>

export function createLightsOutScene(
  canvas: HTMLCanvasElement,
  initialBoard: LightsOutBoard,
  onFailure: (error: unknown) => void
) {
  let board = initialBoard
  let hintedCell: number | null = null
  let highlighted = new Set<number>()
  const tiles: Mesh[] = []
  const disposables: { dispose: () => void }[] = []
  let frame = 0
  let disposed = false
  let resizeObserver: ResizeObserver | undefined
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let stopMedia: (() => void) | undefined
  function own<T extends { dispose: () => void }>(resource: T): T {
    disposables.push(resource)
    return resource
  }
  function dispose() {
    if (disposed) return
    disposed = true
    window.cancelAnimationFrame(frame)
    resizeObserver?.disconnect()
    stopMedia?.()
    canvas.removeEventListener('webglcontextlost', contextLost)
    for (const resource of disposables.reverse()) resource.dispose()
    tiles.length = 0
  }
  function fail(error: unknown) {
    if (disposed) return
    dispose()
    onFailure(error)
  }
  function contextLost(event: Event) {
    event.preventDefault()
    fail(new Error('Lights Out WebGL context lost'))
  }
  // Asynchronous callbacks run outside the initialization try/catch.
  function guard(callback: () => void) {
    return () => {
      if (disposed) return
      try {
        callback()
      } catch (error) {
        fail(error)
      }
    }
  }
  try {
    const scene = new Scene()
    const camera = new PerspectiveCamera(baseCameraFov, 1, 0.1, 100)
    camera.position.set(5.6, 4.3, 7.2)
    camera.lookAt(0, 0, 0)

    const renderer = own(
      new WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: 'high-performance'
      })
    )
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = AgXToneMapping
    renderer.toneMappingExposure = 0.76
    canvas.addEventListener('webglcontextlost', contextLost)

    const controls = own(new OrbitControls(camera, canvas))
    controls.enableDamping = !media.matches
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 6.4
    controls.maxDistance = 18
    controls.rotateSpeed = 0.72
    controls.zoomSpeed = 0.7

    const updateMotion = () => {
      controls.enableDamping = !media.matches
    }
    media.addEventListener('change', updateMotion)
    stopMedia = () => media.removeEventListener('change', updateMotion)

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

    const baseGeometry = own(new BoxGeometry(3.16, 3.16, 3.16))
    const baseMaterial = own(
      new MeshStandardMaterial({
        color: 0x03020c,
        metalness: 0.38,
        roughness: 0.64
      })
    )
    const base = new Mesh(baseGeometry, baseMaterial)
    scene.add(base)

    const edgesGeometry = own(new EdgesGeometry(baseGeometry))
    const edgesMaterial = own(
      new LineBasicMaterial({
        color: 0x665cff,
        transparent: true,
        opacity: 0.68
      })
    )
    scene.add(new LineSegments(edgesGeometry, edgesMaterial))

    const tileGeometry = own(new RoundedBoxGeometry(0.82, 0.82, 0.11, 3, 0.055))
    const materials = createTileMaterials(own)

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
          tiles[index] = tile
        }
      }
    }

    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const updateTiles = () => {
      const currentBoard = board
      const currentHint = hintedCell
      for (let index = 0; index < tiles.length; index += 1) {
        const tile = tiles[index]
        if (!tile) continue
        const lit = Boolean(currentBoard[index])
        tile.material =
          currentHint === index
            ? materials[lit ? 5 : 4]
            : materials[lit ? (highlighted.has(index) ? 3 : 1) : highlighted.has(index) ? 2 : 0]
        tile.scale.setScalar(currentHint === index ? 1.12 : 1)
      }
    }
    updateTiles()
    const resize = () => {
      if (disposed) return
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
    resizeObserver = new ResizeObserver(guard(resize))
    resizeObserver.observe(canvas)

    const render = () => {
      if (disposed) return
      controls.update()
      renderer.render(scene, camera)
      frame = window.requestAnimationFrame(renderFrame)
    }
    const renderFrame = guard(render)
    render()
    function focusFace(face: LightsOutFace) {
      if (disposed) return
      const definition = LIGHTS_OUT_FACE_FRAMES.find((candidate) => candidate.face === face)
      if (!definition) return

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

    return {
      update(nextBoard: LightsOutBoard, nextHint: number | null) {
        if (disposed) return
        board = nextBoard
        hintedCell = nextHint
        updateTiles()
      },
      highlight(index: number | null) {
        if (disposed) return
        highlighted = new Set(index === null ? [] : getAffectedCells(index))
        updateTiles()
      },
      focusFace,
      pickCell(clientX: number, clientY: number) {
        if (disposed) return null
        const bounds = canvas.getBoundingClientRect()
        pointer.set(
          ((clientX - bounds.left) / bounds.width) * 2 - 1,
          -((clientY - bounds.top) / bounds.height) * 2 + 1
        )
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(tiles, false)[0]
        return typeof hit?.object.userData.cellIndex === 'number'
          ? (hit.object.userData.cellIndex as number)
          : null
      },
      dispose
    }
  } catch (error) {
    dispose()
    throw error
  }
}

function createTileMaterials(
  own: <T extends { dispose: () => void }>(resource: T) => T
): MeshStandardMaterial[] {
  const shared = { metalness: 0.16, roughness: 0.34 }
  return [
    own(
      new MeshStandardMaterial({
        ...shared,
        color: 0x080a22,
        emissive: 0x050114,
        emissiveIntensity: 0.12
      })
    ),
    own(
      new MeshStandardMaterial({
        ...shared,
        color: 0xb8007c,
        emissive: 0xff007a,
        emissiveIntensity: 0.58
      })
    ),
    own(
      new MeshStandardMaterial({
        ...shared,
        color: 0x00899a,
        emissive: 0x00d9ff,
        emissiveIntensity: 0.44
      })
    ),
    own(
      new MeshStandardMaterial({
        ...shared,
        color: 0x6930b8,
        emissive: 0x7c3cff,
        emissiveIntensity: 0.52
      })
    ),
    own(
      new MeshStandardMaterial({
        ...shared,
        color: 0x5f4900,
        emissive: 0xffc400,
        emissiveIntensity: 0.9
      })
    ),
    own(
      new MeshStandardMaterial({
        ...shared,
        color: 0xffa000,
        emissive: 0xffed75,
        emissiveIntensity: 1
      })
    )
  ]
}
