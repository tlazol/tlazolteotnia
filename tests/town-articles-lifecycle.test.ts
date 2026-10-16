import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createArticleTown } from '../src/lib/town-articles.client'

const mocks = vi.hoisted(() => {
  const town = {
    pause: vi.fn(),
    dispose: vi.fn(),
    update: vi.fn(),
    render: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    projectResidents: vi.fn(() => []),
    beginResidentDrag: vi.fn(),
    moveResidentDrag: vi.fn(),
    endResidentDrag: vi.fn(),
    select: vi.fn(),
    follow: vi.fn(),
    focus: vi.fn(),
    filter: vi.fn(),
    residentPosition: vi.fn()
  }
  const renderer = {
    shadowMap: { enabled: false, type: 0 },
    setPixelRatio: vi.fn(),
    getPixelRatio: () => 1,
    setSize: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn()
  }
  return { town, renderer }
})
vi.mock('three', () => ({
  PCFShadowMap: 1,
  WebGLRenderer: class {
    constructor() {
      Object.assign(this, mocks.renderer)
    }
  }
}))
vi.mock('../src/lib/town-three.client', () => ({ createTownScene: () => mocks.town }))

function setup() {
  const document = Object.assign(new EventTarget(), { hidden: false })
  const media = Object.assign(new EventTarget(), { matches: false })
  const canvas = Object.assign(new EventTarget(), { width: 0, height: 0, clientWidth: 0 })
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', { devicePixelRatio: 1, matchMedia: () => media })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const positions = vi.fn()
  const failure = vi.fn()
  const town = createArticleTown(canvas as unknown as HTMLCanvasElement, [], positions, failure)
  const frame = (now = 0) => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(now)
  }
  town.update({ x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })
  return { document, media, canvas, frames, positions, failure, town, frame }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('article town renderer lifecycle', () => {
  it('cancels pending animation and timers, removes listeners, and disposes scene and renderer on unmount', () => {
    const t = setup()
    t.frame()
    expect(t.positions).toHaveBeenCalledOnce()
    t.town.dispose()
    t.document.dispatchEvent(new Event('visibilitychange'))
    t.media.dispatchEvent(new Event('change'))
    t.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    vi.advanceTimersByTime(1000)
    expect(t.frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(t.failure).not.toHaveBeenCalled()
    expect(mocks.town.dispose).toHaveBeenCalledOnce()
    expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
  })
  it('stops while hidden and resumes with a paused scene clock', () => {
    const t = setup()
    t.frame()
    t.document.hidden = true
    t.document.dispatchEvent(new Event('visibilitychange'))
    expect(mocks.town.pause).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1000)
    expect(t.frames.size).toBe(0)
    t.document.hidden = false
    t.document.dispatchEvent(new Event('visibilitychange'))
    expect(t.frames.size).toBe(1)
    t.frame(1000)
    expect(t.positions).toHaveBeenCalledTimes(2)
    t.town.dispose()
  })
  it('updates daylight each second under reduced motion and restarts continuous updates when it changes', () => {
    const t = setup()
    t.media.matches = true
    t.frame()
    expect(mocks.town.render).toHaveBeenLastCalledWith(mocks.renderer, 0, false)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(999)
    expect(t.frames.size).toBe(0)
    vi.advanceTimersByTime(1)
    expect(t.frames.size).toBe(1)
    t.frame(1000)
    expect(mocks.town.render).toHaveBeenLastCalledWith(mocks.renderer, 1000, false)
    t.town.select('resident')
    expect(t.frames.size).toBe(1)
    t.frame(10)
    t.media.matches = false
    t.media.dispatchEvent(new Event('change'))
    t.frame(20)
    expect(vi.getTimerCount()).toBe(1)
    t.town.dispose()
  })
  it.each(['resize', 'rebuild'] as const)(
    'reports a synchronous %s failure, stops pending frames, and allows immediate disposal',
    (operation) => {
      const t = setup()
      const error = new Error(`${operation} failed`)
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const update = operation === 'resize' ? mocks.renderer.setSize : mocks.town.update
      update.mockImplementationOnce(() => {
        throw error
      })
      t.failure.mockImplementation(() => t.town.dispose())
      expect(() =>
        t.town.update({ x: 0, y: 0, zoom: 0.4 }, { width: 390, height: 844 })
      ).not.toThrow()
      expect(t.failure).toHaveBeenCalledOnce()
      expect(console.error).toHaveBeenCalledWith('Town renderer unavailable', error)
      expect(t.frames.size).toBe(0)
      vi.advanceTimersByTime(1000)
      expect(vi.getTimerCount()).toBe(0)
      const updateCount = mocks.town.update.mock.calls.length
      t.town.update({ x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })
      t.town.dispose()
      expect(mocks.town.update).toHaveBeenCalledTimes(updateCount)
      expect(mocks.town.dispose).toHaveBeenCalledOnce()
      expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
    }
  )
  it('reports failure during the first update without leaving an animation scheduled', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.town.update.mockImplementationOnce(() => {
      throw new Error('initial update failed')
    })
    const t = setup()
    expect(t.failure).toHaveBeenCalledOnce()
    expect(t.frames.size).toBe(0)
    t.town.dispose()
  })
  it('stops rendering and reports context loss without waking on later input', () => {
    const t = setup()
    const event = new Event('webglcontextlost', { cancelable: true })
    t.canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(t.failure).toHaveBeenCalledOnce()
    t.town.focus('resident')
    vi.advanceTimersByTime(1000)
    expect(t.frames.size).toBe(0)
    expect(mocks.town.render).not.toHaveBeenCalled()
    t.town.dispose()
  })
})
