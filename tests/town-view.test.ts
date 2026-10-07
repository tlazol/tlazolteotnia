import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { zoomBoardAt } from '../src/lib/sticker-board'
import { boardToTown, createTownCamera, updateTownCamera } from '../src/lib/town-view'

describe('town projection', () => {
  it('projects the ground to sticker coordinates during pan, zoom, and resize', () => {
    const camera = createTownCamera()
    const initial = { x: -240, y: -370, zoom: 0.8 }
    const views = [
      initial,
      { ...initial, x: 40, y: 90 },
      zoomBoardAt(initial, 2.1, { x: 317, y: 241 })
    ]
    for (const size of [
      { width: 1280, height: 720 },
      { width: 390, height: 844 }
    ]) {
      for (const view of views) {
        updateTownCamera(camera, view, size)
        camera.updateMatrixWorld()
        for (const point of [
          { x: 0, y: 0 },
          { x: 850, y: 560 },
          { x: -970, y: 1830 }
        ]) {
          const ground = boardToTown(point.x, point.y)
          const projected = new Vector3(ground.x, 0, ground.z).project(camera)
          expect(((projected.x + 1) * size.width) / 2).toBeCloseTo(view.x + point.x * view.zoom)
          expect(((1 - projected.y) * size.height) / 2).toBeCloseTo(view.y + point.y * view.zoom)
        }
      }
    }
  })

  it('uses an undistorted 45-degree camera with symmetric ground axes', () => {
    const camera = createTownCamera()
    updateTownCamera(camera, { x: 0, y: 0, zoom: 1 }, { width: 1280, height: 720 })
    const project = (x: number, y: number, z: number) => {
      const point = new Vector3(x, y, z).project(camera)
      return { x: point.x * 640, y: point.y * 360 }
    }
    const base = project(1200, 0, 900)
    const right = project(1400, 0, 900)
    const back = project(1200, 0, 1100)
    const roof = project(1200, 180, 900)
    expect(right.x - base.x).toBeCloseTo(base.x - back.x)
    expect(right.y - base.y).toBeCloseTo(back.y - base.y)
    expect(Math.hypot(right.x - base.x, right.y - base.y)).toBeCloseTo(
      Math.hypot(back.x - base.x, back.y - base.y)
    )
    expect(roof.x).toBeCloseTo(base.x)
    expect(roof.y).toBeGreaterThan(base.y)
    expect(camera.position.x).toBeCloseTo(camera.position.z)
    expect(camera.position.y).toBeCloseTo(Math.hypot(camera.position.x, camera.position.z))
  })
})
