import { describe, expect, it, vi } from 'vitest'
import { cameraAxis, screenToWorld, tileAt, worldToScreen } from '../src/lib/island-camera'
import { createIslandInput, type IslandInputBindings } from '../src/lib/island-input'
import { tileHeight } from '../src/lib/island-relief'
import { createIsland, ROCK, TILE_SIZE, WATER } from '../src/lib/island-world'

function setup() {
  const resident = {
    dataset: { resident: 'a' },
    setPointerCapture: vi.fn(),
    closest: () => resident
  }
  const bindings: IslandInputBindings = {
    surface: () => null,
    view: () => ({ x: 640, y: 480, zoom: 2 }),
    size: () => ({ width: 800, height: 600 }),
    setView: vi.fn(),
    ready: () => true,
    editing: () => false,
    panning: () => false,
    hover: vi.fn(),
    strokeStart: vi.fn(),
    strokeMove: vi.fn(),
    strokeEnd: vi.fn(),
    tap: vi.fn(),
    setDragging: vi.fn(),
    residentStart: vi.fn(),
    residentMove: vi.fn(),
    residentEnd: vi.fn()
  }
  const input = createIslandInput(bindings)
  const event = (x: number, id = 1, target = resident) => ({
    pointerId: id,
    pointerType: 'touch',
    button: 0,
    clientX: x,
    clientY: 300,
    type: 'pointerup',
    target: target as unknown as EventTarget,
    preventDefault: vi.fn()
  })
  return { input, bindings, event }
}

describe('resident gestures', () => {
  it('keeps a tap as a click and cancels the temporary hold', () => {
    const { input, bindings, event } = setup()
    input.pointerDown(event(400))
    input.pointerMove(event(402))
    input.pointerUp(event(402))
    expect(bindings.residentMove).not.toHaveBeenCalled()
    expect(bindings.residentEnd).toHaveBeenCalledWith(true)
    expect(input.consumeResidentClick()).toBe(false)
  })

  it('drags in world coordinates without panning or clicking', () => {
    const { input, bindings, event } = setup()
    input.pointerDown(event(400))
    input.pointerMove(event(500))
    input.pointerUp(event(520))
    expect(bindings.residentStart).toHaveBeenCalledWith('a', { x: 640, y: 480 })
    expect(bindings.residentMove).toHaveBeenLastCalledWith({
      x: 640 + 60 * Math.SQRT1_2,
      y: 480 - 60 * Math.SQRT1_2
    })
    expect(bindings.residentEnd).toHaveBeenCalledWith(false)
    expect(bindings.setView).not.toHaveBeenCalled()
    expect(bindings.tap).not.toHaveBeenCalled()
    expect(input.consumeResidentClick()).toBe(true)
    expect(input.consumeResidentClick()).toBe(false)
  })

  it('restores a drag on cancellation and ignores the later release', () => {
    const { input, bindings, event } = setup()
    input.pointerDown(event(400))
    input.pointerMove(event(500))
    input.cancel()
    input.pointerUp(event(500))
    expect(bindings.residentEnd).toHaveBeenCalledExactlyOnceWith(true)
    expect(input.consumeResidentClick()).toBe(true)
  })

  it('cancels the resident drag when a second touch starts a pinch', () => {
    const { input, bindings, event } = setup()
    input.pointerDown(event(400))
    input.pointerMove(event(420))
    input.pointerDown(event(500, 2))
    input.pointerMove(event(600, 2))
    expect(bindings.residentEnd).toHaveBeenCalledExactlyOnceWith(true)
    expect(bindings.setView).toHaveBeenCalled()
    input.pointerCancel(event(600, 2))
    expect(bindings.setDragging).toHaveBeenLastCalledWith(false)
  })
})

describe('shared editing gestures', () => {
  const surface = { setPointerCapture: vi.fn(), closest: () => null }
  const down = (id: number, x: number) => ({
    pointerId: id,
    pointerType: 'touch',
    button: 0,
    clientX: x,
    clientY: 300,
    type: 'pointerdown',
    target: surface as unknown as EventTarget,
    preventDefault: vi.fn()
  })

  it('moves the camera instead of editing while edits are not allowed', () => {
    const { input, bindings } = setup()
    bindings.editing = () => true
    bindings.canStroke = () => false
    input.pointerDown(down(1, 400))
    expect(bindings.strokeStart).not.toHaveBeenCalled()
    input.pointerUp({ ...down(1, 400), type: 'pointerup' })
    bindings.canStroke = () => true
    input.pointerDown(down(2, 400))
    expect(bindings.strokeStart).toHaveBeenCalledTimes(1)
  })

  it('drops an unsent stroke when a second finger starts a pinch', () => {
    const { input, bindings } = setup()
    bindings.editing = () => true
    bindings.canStroke = () => true
    input.pointerDown(down(1, 400))
    input.pointerDown(down(2, 500))
    expect(bindings.strokeEnd).toHaveBeenCalledWith(true)
  })
})

describe('camera rotation', () => {
  it('orbits continuously on right drag without moving the center or starting an edit', () => {
    const { input, bindings, event } = setup()
    bindings.editing = () => true
    const right = { ...event(400), pointerType: 'mouse', button: 2 }
    input.pointerDown(right)
    input.pointerMove({ ...right, clientX: 500 })
    expect(bindings.setView).toHaveBeenLastCalledWith({ ...bindings.view(), turn: 3.5 })
    input.pointerMove({ ...right, clientX: 300 })
    expect(bindings.setView).toHaveBeenLastCalledWith({ ...bindings.view(), turn: 0.5 })
    input.pointerUp(right)
    expect(bindings.strokeStart).not.toHaveBeenCalled()
    expect(bindings.residentStart).not.toHaveBeenCalled()
    expect(bindings.tap).not.toHaveBeenCalled()
  })

  it('keeps the same world point between the fingers while twisting, zooming and panning', () => {
    const { input, bindings, event } = setup()
    const setView = vi.mocked(bindings.setView)
    const anchor = screenToWorld(bindings.view(), bindings.size(), { x: 250, y: 300 })
    input.pointerDown(event(200))
    input.pointerDown(event(300, 2))
    input.pointerMove({ ...event(320, 2), clientY: 420 })
    const [next] = setView.mock.calls[0]
    expect(next.turn).toBeCloseTo(0.5)
    expect(next.zoom).toBe(3)
    const point = worldToScreen(next, bindings.size(), anchor)
    expect(point.x).toBeCloseTo(260)
    expect(point.y).toBeCloseTo(360)
  })
})

describe('voxel terrain picking', () => {
  const size = { width: 800, height: 600 }
  it.each([0, 0.3, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])(
    'picks the drawn top and exposed wall at turn %s',
    (turn) => {
      const world = createIsland()
      world.ground.fill(WATER)
      const tile = { x: 39, y: 28 }
      world.ground[tile.y * world.columns + tile.x] = ROCK
      const middle = { x: (tile.x + 0.5) * TILE_SIZE, y: (tile.y + 0.5) * TILE_SIZE }
      const view = { ...middle, zoom: 2.5, turn }
      const h = tileHeight(world, tile.x, tile.y)
      const top = worldToScreen(view, size, middle, h)
      expect(tileAt(view, size, top, world)).toEqual(tile)
      const axis = cameraAxis(view)
      const side = Math.abs(axis.x) >= Math.abs(axis.y) ? 'x' : 'y'
      const face = { ...middle, [side]: middle[side] + (Math.sign(axis[side]) * TILE_SIZE) / 2 }
      const cliff = worldToScreen(view, size, face, h / 2)
      expect(tileAt(view, size, cliff, world)).toEqual(tile)
      const sea = { x: middle.x + 64, y: middle.y - 64 }
      expect(tileAt(view, size, worldToScreen(view, size, sea), world)).toEqual({
        x: tile.x + 4,
        y: tile.y - 4
      })
    }
  )
})
