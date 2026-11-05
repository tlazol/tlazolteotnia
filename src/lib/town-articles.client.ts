import { NeutralToneMapping, PCFShadowMap, WebGLRenderer } from 'three'
import type { SceneSize } from './scene-math'
import type { TownArticle } from './town-posts'
import { createTownScene } from './town-three.client'
import type { TownView } from './town-view'

export type ResidentScreenPosition = ReturnType<
  ReturnType<typeof createTownScene>['projectResidents']
>[number]

export function createArticleTown(
  canvas: HTMLCanvasElement,
  articles: TownArticle[],
  onPositions: (positions: ResidentScreenPosition[], view: TownView) => void,
  onFailure: () => void
) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  // Neutral tone mapping rolls off bright paving and roofs instead of clipping them.
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1.08
  let pixelRatio = Math.min(window.devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  const town = createTownScene(articles)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let viewport: SceneSize = { width: 0, height: 0 }
  let lastFrame = 0
  let frameInterval = 0
  let frameSamples = 0
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let unavailable = false
  let hasSize = false

  function stop() {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    frame = 0
    town.pause()
  }
  function fail(error?: unknown) {
    if (disposed || unavailable) return
    if (error !== undefined) console.error('Town renderer unavailable', error)
    unavailable = true
    stop()
    onFailure()
  }
  // Frames are paced at 30fps; when a device keeps falling well behind, trade
  // resolution for smoothness, stepping down no further than one pixel per point.
  function adaptResolution(now: number) {
    const interval = now - lastFrame
    lastFrame = now
    if (interval > 400 || reducedMotion.matches) {
      frameSamples = 0
      return
    }
    frameInterval = frameSamples ? frameInterval * 0.9 + interval * 0.1 : interval
    frameSamples++
    if (frameSamples < 45 || frameInterval < 52 || pixelRatio <= 1) return
    pixelRatio = Math.max(1, pixelRatio - 0.25)
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(viewport.width, viewport.height, false)
    frameSamples = 0
  }
  function render(now: number) {
    frame = 0
    if (disposed || unavailable || document.hidden || !hasSize) return
    try {
      adaptResolution(now)
      renderer.clear()
      const view = town.render(renderer, now, !reducedMotion.matches)
      onPositions(town.projectResidents(now), view)
      if (!disposed && !unavailable)
        timer = setTimeout(wake, reducedMotion.matches ? 1000 : 1000 / 30)
    } catch (error) {
      fail(error)
    }
  }
  function wake() {
    clearTimeout(timer)
    if (!disposed && !unavailable && !document.hidden && !frame)
      frame = requestAnimationFrame(render)
  }
  function visibilityChanged() {
    if (document.hidden) stop()
    else wake()
  }
  function contextLost(event: Event) {
    event.preventDefault()
    fail()
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  reducedMotion.addEventListener('change', wake)
  canvas.addEventListener('webglcontextlost', contextLost)

  return {
    beginResidentDrag(slug: string) {
      town.beginResidentDrag(slug)
      wake()
    },
    moveResidentDrag(dx: number, dy: number) {
      town.moveResidentDrag(dx, dy)
      wake()
    },
    endResidentDrag(cancel = false) {
      town.endResidentDrag(cancel)
      wake()
    },
    update(view: TownView, size: SceneSize) {
      if (disposed || unavailable || !size.width || !size.height) return
      try {
        hasSize = true
        viewport = size
        if (
          canvas.clientWidth !== size.width ||
          canvas.width !== Math.floor(size.width * renderer.getPixelRatio()) ||
          canvas.height !== Math.floor(size.height * renderer.getPixelRatio())
        )
          renderer.setSize(size.width, size.height, false)
        town.update(view, size)
        wake()
      } catch (error) {
        fail(error)
      }
    },
    select(slug: string | null) {
      town.select(slug)
      wake()
    },
    follow(slug: string | null) {
      town.follow(slug)
      wake()
    },
    focus(slug: string | null) {
      town.focus(slug)
      wake()
    },
    filter(slugs: string[]) {
      town.filter(slugs)
      wake()
    },
    residentPosition: town.residentPosition,
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      document.removeEventListener('visibilitychange', visibilityChanged)
      reducedMotion.removeEventListener('change', wake)
      canvas.removeEventListener('webglcontextlost', contextLost)
      town.dispose()
      renderer.dispose()
    }
  }
}
