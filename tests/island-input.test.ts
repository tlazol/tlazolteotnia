import { describe, expect, it, vi } from 'vitest'
import { cameraAxis, screenToWorld, tileAt, worldToScreen } from '../src/lib/island-camera'
import { createIslandInput, type IslandInputBindings } from '../src/lib/island-input'
import { tileHeight } from '../src/lib/island-relief'
import {
  createIsland,
  MAX_ELEVATION_CODE,
  ROCK,
  SAND,
  SEA_LEVEL_CODE,
  TILE_SIZE,
  WATER
} from '../src/lib/island-world'

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
    firstPerson: () => false,
    lookAround: vi.fn(),
    eyeZoom: () => 1,
    setEyeZoom: vi.fn(),
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
  it('zooms from the initial finger spacing and keeps looking with the remaining finger', () => {
    const { input, bindings, event } = setup()
    bindings.firstPerson = () => true
    bindings.eyeZoom = () => 1.5
    input.pointerDown(event(200))
    input.pointerDown(event(300, 2))
    input.pointerMove(event(400, 2))
    input.pointerMove(event(250, 2))
    expect(vi.mocked(bindings.setEyeZoom).mock.calls).toEqual([[3], [0.75]])
    expect(bindings.lookAround).not.toHaveBeenCalled()
    expect(bindings.setView).not.toHaveBeenCalled()
    input.pointerUp(event(200))
    input.pointerMove(event(260, 2))
    expect(bindings.lookAround).toHaveBeenCalledExactlyOnceWith(10, 0)
    input.pointerUp(event(260, 2))
    expect(bindings.setDragging).toHaveBeenLastCalledWith(false)
  })

  it('uses native trackpad scale once when both gesture and wheel events arrive', () => {
    const { input, bindings } = setup()
    bindings.firstPerson = () => true
    const wheel = {
      ctrlKey: true,
      deltaY: -10,
      deltaMode: 0,
      preventDefault: vi.fn()
    } as unknown as WheelEvent
    input.trackpadGesture(new Event('gesturestart'))
    input.wheel(wheel)
    input.trackpadGesture(Object.assign(new Event('gesturechange'), { scale: 2 }))
    expect(bindings.setEyeZoom).toHaveBeenCalledExactlyOnceWith(2)
    input.trackpadGesture(new Event('gestureend'))
    input.wheel(wheel)
    expect(bindings.setEyeZoom).toHaveBeenLastCalledWith(Math.exp(0.1))
    expect(wheel.preventDefault).toHaveBeenCalled()
  })

  it('looks around with one pointer and resumes map input after leaving first person', () => {
    const { input, bindings, event } = setup()
    bindings.firstPerson = () => true
    input.pointerDown(event(400))
    input.pointerMove({ ...event(420), clientY: 285 })
    input.pointerDown(event(600, 2))
    input.pointerMove(event(640, 2))
    input.pointerCancel(event(640, 2))
    input.pointerMove(event(415))
    input.pointerUp(event(415))
    input.pointerMove(event(430))
    expect(vi.mocked(bindings.lookAround).mock.calls).toEqual([
      [20, -15],
      [-5, 15]
    ])
    expect(bindings.setDragging).toHaveBeenLastCalledWith(false)
    expect(bindings.setView).not.toHaveBeenCalled()
    expect(bindings.tap).not.toHaveBeenCalled()
    expect(bindings.residentStart).not.toHaveBeenCalled()

    bindings.firstPerson = () => false
    input.pointerDown(event(400))
    expect(bindings.residentStart).toHaveBeenCalledTimes(1)
  })

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
  it('picks a floor below sea level and lets the height tools reach a narrow pit by its wall', () => {
    const world = createIsland()
    world.ground.fill(SAND)
    world.elevation.fill(MAX_ELEVATION_CODE)
    const tile = { x: 39, y: 28 }
    const middle = { x: (tile.x + 0.5) * TILE_SIZE, y: (tile.y + 0.5) * TILE_SIZE }
    const view = { ...middle, zoom: 2, turn: 0.5 }
    const floor = worldToScreen(view, size, middle, tileHeight(world, tile.x, tile.y))
    expect(tileAt(view, size, floor, world)).toEqual(tile)

    world.elevation.fill(0)
    world.elevation[tile.y * world.columns + tile.x] = SEA_LEVEL_CODE + 3
    const opening = worldToScreen(view, size, middle, 4)
    expect(tileAt(view, size, opening, world)).toEqual({ x: tile.x - 1, y: tile.y })
    expect(tileAt(view, size, opening, world, true)).toEqual(tile)

    world.ground.fill(ROCK)
    world.elevation.fill(0)
    const rock = worldToScreen(view, size, middle, tileHeight(world, tile.x, tile.y))
    world.elevation[tile.y * world.columns + tile.x] = 2
    expect(tileAt(view, size, rock, world, true)).toEqual(tile)
  })

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
