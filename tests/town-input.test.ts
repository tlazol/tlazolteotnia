import type { MouseEvent, PointerEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTownInput, type TownInputBindings } from '../src/lib/town-input'
import type { TownView } from '../src/lib/town-view'

// Only the DOM boundary is faked; all gesture transitions and view calculations are real.
class Target {
  constructor(readonly kind = 'surface') {}
  closest(selector: string) {
    return selector === `.${this.kind}` ? this : null
  }
  getAttribute() {
    return 'resident'
  }
}
function setup() {
  vi.stubGlobal('Element', Target)
  const captures = new Set<number>()
  const surface = Object.assign(new Target(), {
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    setPointerCapture: (id: number) => captures.add(id),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => captures.delete(id)
  })
  const renderer = {
    focus: vi.fn(),
    follow: vi.fn(),
    beginResidentDrag: vi.fn(),
    moveResidentDrag: vi.fn(),
    endResidentDrag: vi.fn()
  }
  let view: TownView = { x: 0, y: 0, zoom: 1 }
  let ready = true
  let rotateMode = false
  const bindings: TownInputBindings = {
    renderer: () => renderer as unknown as ReturnType<TownInputBindings['renderer']>,
    surface: () => surface as unknown as HTMLDivElement,
    view: () => view,
    size: () => ({ width: 1000, height: 800 }),
    ready: () => ready,
    rotateMode: () => rotateMode,
    updateView: vi.fn((next) => {
      view = next
    }),
    setActiveSlug: vi.fn(),
    setDragging: vi.fn(),
    setDraggedSlug: vi.fn(),
    selectResident: vi.fn()
  }
  const input = createTownInput(bindings)
  function event(
    type: string,
    x = 100,
    y = 100,
    id = 1,
    pointerType = 'mouse',
    target = surface as Target
  ) {
    return {
      type,
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType,
      target,
      currentTarget: surface,
      button: 0
    } as unknown as PointerEvent<HTMLDivElement>
  }
  function click(detail: number) {
    const event = { detail, preventDefault: vi.fn(), stopPropagation: vi.fn() }
    input.clickCapture(event as unknown as MouseEvent<HTMLDivElement>)
    return event
  }
  return {
    input,
    bindings,
    renderer,
    event,
    click,
    captures,
    person: new Target('town-person'),
    bubble: new Target('town-bubble'),
    view: () => view,
    setReady: (value: boolean) => {
      ready = value
    },
    setRotate: (value: boolean) => {
      rotateMode = value
    }
  }
}
afterEach(() => vi.unstubAllGlobals())
describe('town input transitions', () => {
  it('treats movement up to six pixels as a tap and suppresses the captured click only', () => {
    const t = setup()
    t.input.pointerDown(t.event('pointerdown', 100, 100, 1, 'mouse', t.person))
    t.input.pointerMove(t.event('pointermove', 106))
    expect(t.renderer.beginResidentDrag).not.toHaveBeenCalled()
    t.input.pointerUp(t.event('pointerup', 106))
    expect(t.bindings.selectResident).toHaveBeenCalledExactlyOnceWith('resident')
    expect(t.click(1).preventDefault).toHaveBeenCalledOnce()
    expect(t.click(0).preventDefault).not.toHaveBeenCalled()
    expect(t.captures.size).toBe(0)
  })
  it('starts dragging once, includes the threshold distance, and suppresses release clicks and hover', () => {
    const t = setup()
    t.input.pointerDown(t.event('pointerdown', 100, 100, 1, 'mouse', t.person))
    t.input.pointerMove(t.event('pointermove', 107))
    t.input.pointerMove(t.event('pointermove', 110, 102))
    expect(t.renderer.beginResidentDrag).toHaveBeenCalledExactlyOnceWith('resident')
    expect(t.renderer.moveResidentDrag.mock.calls).toEqual([
      [7, 0],
      [3, 2]
    ])
    t.input.pointerUp(t.event('pointerup', 110, 102))
    expect(t.renderer.endResidentDrag).toHaveBeenLastCalledWith(false)
    expect(t.bindings.selectResident).not.toHaveBeenCalled()
    expect(t.click(1).preventDefault).toHaveBeenCalledOnce()
    t.renderer.focus.mockClear()
    t.input.enterResident('resident')
    expect(t.renderer.focus).not.toHaveBeenCalled()
    t.input.leaveResident('resident')
    t.input.enterResident('resident')
    expect(t.renderer.focus).toHaveBeenCalledWith('resident')
  })
  it('cancels a resident drag when a second finger begins a pinch, then resumes pan with one finger', () => {
    const t = setup()
    t.input.pointerDown(t.event('pointerdown', 100, 100, 1, 'touch', t.person))
    t.input.pointerMove(t.event('pointermove', 110, 100, 1, 'touch'))
    t.input.pointerDown(t.event('pointerdown', 200, 100, 2, 'touch'))
    expect(t.renderer.endResidentDrag).toHaveBeenCalledWith(true)
    expect(t.bindings.setDraggedSlug).toHaveBeenLastCalledWith(null)
    t.input.pointerMove(t.event('pointermove', 230, 120, 2, 'touch'))
    expect(t.view().zoom).toBeGreaterThan(1)
    expect(t.view().rotation).not.toBe(0)
    t.input.pointerUp(t.event('pointerup', 230, 120, 2, 'touch'))
    const before = t.view()
    t.input.pointerMove(t.event('pointermove', 120, 100, 1, 'touch'))
    expect(t.view()).toEqual({ ...before, x: before.x + 10 })
    t.input.pointerUp(t.event('pointerup', 120, 100, 1, 'touch'))
    expect(t.captures.size).toBe(0)
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur'])(
    'clears all captures on %s and accepts the next gesture',
    (kind) => {
      const t = setup()
      t.input.pointerDown(t.event('pointerdown', 100, 100, 1, 'touch', t.person))
      t.input.pointerMove(t.event('pointermove', 110, 100, 1, 'touch'))
      if (kind === 'blur') t.input.cancelGesture()
      else if (kind === 'lostpointercapture') t.input.lostPointerCapture(t.event(kind))
      else t.input.pointerUp(t.event(kind))
      expect(t.renderer.endResidentDrag).toHaveBeenLastCalledWith(true)
      expect(t.bindings.setDragging).toHaveBeenLastCalledWith(false)
      expect(t.captures.size).toBe(0)
      const before = t.view()
      t.input.pointerDown(t.event('pointerdown'))
      t.input.pointerMove(t.event('pointermove', 120))
      expect(t.view().x).toBe(before.x + 20)
    }
  )
  it('reads current readiness and rotation mode and ignores mixed pointer types', () => {
    const t = setup()
    t.setReady(false)
    t.input.pointerDown(t.event('pointerdown'))
    expect(t.captures.size).toBe(0)
    t.setReady(true)
    t.setRotate(true)
    t.input.pointerDown(t.event('pointerdown'))
    t.input.pointerDown(t.event('pointerdown', 200, 100, 2, 'touch'))
    t.input.pointerMove(t.event('pointermove', 300, 100, 2, 'touch'))
    expect(t.bindings.updateView).not.toHaveBeenCalled()
    t.input.pointerMove(t.event('pointermove', 120))
    expect(t.view().rotation).not.toBe(0)
  })
  it('does not capture a bubble link or suppress its click after a drag', () => {
    const t = setup()
    t.input.pointerDown(t.event('pointerdown'))
    t.input.pointerMove(t.event('pointermove', 120))
    t.input.pointerUp(t.event('pointerup', 120))
    t.input.pointerDown(t.event('pointerdown', 100, 100, 1, 'mouse', t.bubble))
    expect(t.click(1).preventDefault).not.toHaveBeenCalled()
    expect(t.captures.size).toBe(0)
  })
})
