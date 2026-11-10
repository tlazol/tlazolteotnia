import { describe, expect, it, vi } from 'vitest'
import { createIslandInput, type IslandInputBindings } from '../src/lib/island-input'

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
    expect(bindings.residentMove).toHaveBeenLastCalledWith({ x: 700, y: 480 })
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
