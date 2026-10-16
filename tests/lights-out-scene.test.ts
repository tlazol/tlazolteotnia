import { BufferGeometry, Material, Mesh, type PerspectiveCamera, type Scene } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLightsOutScene } from '../src/lib/lights-out-three.client'

const mocks = vi.hoisted(() => ({
  renderer: {
    setClearColor: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn()
  },
  controls: { update: vi.fn(), dispose: vi.fn(), enableDamping: true },
  observe: vi.fn(),
  disconnect: vi.fn()
}))
vi.mock('three', async (original) => ({
  ...(await original<typeof import('three')>()),
  WebGLRenderer: class {
    constructor() {
      Object.assign(this, mocks.renderer)
    }
  }
}))
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    get enableDamping() {
      return mocks.controls.enableDamping
    }
    set enableDamping(value: boolean) {
      mocks.controls.enableDamping = value
    }
    constructor() {
      Object.assign(this, mocks.controls)
    }
  }
}))
let frames: Map<number, FrameRequestCallback>
let media: EventTarget & { matches: boolean }
let resize: () => void
let geometryDispose: ReturnType<typeof vi.spyOn>
let materialDispose: ReturnType<typeof vi.spyOn>
const canvas = Object.assign(new EventTarget(), {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
}) as HTMLCanvasElement
beforeEach(() => {
  vi.clearAllMocks()
  frames = new Map()
  let id = 0
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    matchMedia: () => media,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++id, callback)
      return id
    },
    cancelAnimationFrame: (id: number) => frames.delete(id)
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe = mocks.observe
      disconnect = mocks.disconnect
    }
  )
  geometryDispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
  materialDispose = vi.spyOn(Material.prototype, 'dispose')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function tick() {
  const pending = [...frames.values()]
  frames.clear()
  for (const callback of pending) callback(0)
}
function rendered() {
  const [scene, camera] = mocks.renderer.render.mock.calls.at(-1) as [Scene, PerspectiveCamera]
  return { scene, camera }
}
describe('Lights Out scene lifecycle', () => {
  it('updates tiles, hint, highlight, face focus, and responsive camera without rebuilding', () => {
    const board = Array<boolean>(54).fill(false)
    const view = createLightsOutScene(canvas, board, vi.fn())
    const { scene, camera } = rendered()
    const tiles = scene.children.filter(
      (child): child is Mesh =>
        child instanceof Mesh && typeof child.userData.cellIndex === 'number'
    )
    expect(tiles).toHaveLength(54)
    const off = tiles[4].material
    board[4] = true
    view.update(board, 4)
    expect(tiles[4].scale.x).toBe(1.12)
    expect(tiles[4].material).not.toBe(off)
    view.update(board, null)
    const on = tiles[4].material
    view.highlight(4)
    expect(tiles[4].material).not.toBe(on)
    expect(tiles[4].scale.x).toBe(1)
    const previous = camera.position.clone()
    view.focusFace('back')
    expect(camera.position.equals(previous)).toBe(false)
    resize()
    expect(mocks.renderer.setSize).toHaveBeenLastCalledWith(800, 600, false)
    expect(view.pickCell(-10000, -10000)).toBeNull()
    view.dispose()
  })
  it('cancels animation, disconnects size/motion listeners, and releases each owned resource once', () => {
    const remove = vi.spyOn(media, 'removeEventListener')
    const view = createLightsOutScene(canvas, Array<boolean>(54).fill(false), vi.fn())
    tick()
    expect(frames.size).toBe(1)
    media.matches = true
    media.dispatchEvent(new Event('change'))
    expect(mocks.controls.enableDamping).toBe(false)
    const geometriesBefore = geometryDispose.mock.calls.length
    const materialsBefore = materialDispose.mock.calls.length
    view.dispose()
    view.dispose()
    expect(frames.size).toBe(0)
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
    expect(mocks.controls.dispose).toHaveBeenCalledOnce()
    expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
    expect(geometryDispose.mock.calls.length - geometriesBefore).toBe(3)
    expect(materialDispose.mock.calls.length - materialsBefore).toBe(8)
  })
  it.each(['configure', 'resize', 'render'])(
    'cleans up immediately if initialization fails during %s',
    (stage) => {
      const method =
        stage === 'configure'
          ? mocks.renderer.setClearColor
          : stage === 'resize'
            ? mocks.renderer.setSize
            : mocks.renderer.render
      method.mockImplementationOnce(() => {
        throw new Error('initialization failed')
      })
      expect(() => createLightsOutScene(canvas, Array<boolean>(54).fill(false), vi.fn())).toThrow(
        'initialization failed'
      )
      expect(frames.size).toBe(0)
      expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
      if (stage !== 'configure') {
        expect(mocks.controls.dispose).toHaveBeenCalledOnce()
        expect(materialDispose).toHaveBeenCalledTimes(8)
        expect(geometryDispose.mock.calls.length).toBeGreaterThanOrEqual(3)
      }
      if (stage === 'render') expect(mocks.disconnect).toHaveBeenCalledOnce()
    }
  )
  it.each(['resize', 'render'] as const)(
    'releases resources and reports %s failure after initialization',
    (stage) => {
      const failure = vi.fn()
      const view = createLightsOutScene(canvas, Array<boolean>(54).fill(false), failure)
      const error = new Error('runtime failure')
      const method = stage === 'resize' ? mocks.renderer.setSize : mocks.renderer.render
      method.mockImplementationOnce(() => {
        throw error
      })
      expect(() => (stage === 'resize' ? resize() : tick())).not.toThrow()
      expect(failure).toHaveBeenCalledExactlyOnceWith(error)
      expect(frames.size).toBe(0)
      expect(mocks.disconnect).toHaveBeenCalledOnce()
      expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
      expect(mocks.controls.dispose).toHaveBeenCalledOnce()
      expect(materialDispose).toHaveBeenCalledTimes(8)
      const updates = mocks.controls.update.mock.calls.length
      view.focusFace('back')
      view.update(Array<boolean>(54).fill(true), 4)
      view.highlight(4)
      expect(view.pickCell(100, 100)).toBeNull()
      resize()
      tick()
      expect(mocks.controls.update).toHaveBeenCalledTimes(updates)
      expect(failure).toHaveBeenCalledOnce()
      view.dispose()
      expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
    }
  )
  it('stops after context loss and removes its listener on disposal', () => {
    const failure = vi.fn()
    const remove = vi.spyOn(canvas, 'removeEventListener')
    const view = createLightsOutScene(canvas, Array<boolean>(54).fill(false), failure)
    const event = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(failure).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
    expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
    expect(mocks.controls.dispose).toHaveBeenCalledOnce()
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    expect(materialDispose).toHaveBeenCalledTimes(8)
    expect(remove).toHaveBeenCalledWith('webglcontextlost', expect.any(Function))
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    view.dispose()
    expect(failure).toHaveBeenCalledOnce()
    expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
  })
})
