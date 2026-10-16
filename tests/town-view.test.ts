import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { zoomViewAt } from '../src/lib/scene-math'
import { createTownCamera, updateTownCamera } from '../src/lib/town-camera'
import { clampTownView, fitTown, getTownBounds } from '../src/lib/town-posts'
import {
  boardToTown,
  gestureTownView,
  rotateTownAt,
  townToBoard,
  zoomTownAt
} from '../src/lib/town-view'

describe('town projection', () => {
  it('zooms around the cursor without moving its world position', () => {
    const view = { x: -120, y: 70, zoom: 0.8 }
    const cursor = { x: 500, y: 320 }
    const next = zoomViewAt(view, 1.5, cursor)
    expect((cursor.x - next.x) / next.zoom).toBeCloseTo((cursor.x - view.x) / view.zoom)
    expect((cursor.y - next.y) / next.zoom).toBeCloseTo((cursor.y - view.y) / view.zoom)
  })

  it('projects the ground to sticker coordinates during pan, zoom, and resize', () => {
    const camera = createTownCamera()
    const initial = { x: -240, y: -370, zoom: 0.8 }
    const views = [
      initial,
      { ...initial, x: 40, y: 90 },
      zoomViewAt(initial, 2.1, { x: 317, y: 241 })
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

describe('rotating the town', () => {
  const size = { width: 1280, height: 720 }
  for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    it(`projects and unprojects at rotation ${rotation}`, () => {
      const camera = createTownCamera()
      const view = { x: -240, y: -370, zoom: 0.8, rotation }
      updateTownCamera(camera, view, size)
      for (const [x, z, height] of [
        [850, 560, 0],
        [-970, 1830, 66]
      ]) {
        const board = townToBoard(x, z, height, rotation)
        const projected = new Vector3(x, height, z).project(camera)
        expect(((projected.x + 1) * size.width) / 2).toBeCloseTo(view.x + board.x * view.zoom)
        expect(((1 - projected.y) * size.height) / 2).toBeCloseTo(view.y + board.y * view.zoom)
        if (!height) {
          const ground = boardToTown(board.x, board.y, rotation)
          expect(ground.x).toBeCloseTo(x)
          expect(ground.z).toBeCloseTo(z)
        }
      }
      const delta = boardToTown(120 / view.zoom, -65 / view.zoom, rotation)
      const projectedDelta = townToBoard(delta.x, delta.z, 0, rotation)
      expect(projectedDelta.x * view.zoom).toBeCloseTo(120)
      expect(projectedDelta.y * view.zoom).toBeCloseTo(-65)
    })

    it(`fits and clamps the rotated town at ${rotation}`, () => {
      for (const viewport of [size, { width: 390, height: 844 }]) {
        const bounds = getTownBounds(rotation)
        const fitted = fitTown(viewport, rotation)
        expect(fitted.rotation).toBe(rotation)
        expect(fitted.x + bounds.left * fitted.zoom).toBeGreaterThanOrEqual(0)
        expect(fitted.x + bounds.right * fitted.zoom).toBeLessThanOrEqual(viewport.width)
        expect(fitted.y + bounds.top * fitted.zoom).toBeGreaterThanOrEqual(70)
        expect(fitted.y + bounds.bottom * fitted.zoom).toBeLessThanOrEqual(viewport.height - 60)
        const clamped = clampTownView({ x: 1e6, y: -1e6, zoom: 10, rotation }, viewport)
        expect(clamped.rotation).toBe(rotation)
        expect(clamped.x + bounds.left * clamped.zoom).toBeLessThanOrEqual(40.001)
        expect(clamped.y + bounds.bottom * clamped.zoom).toBeGreaterThanOrEqual(
          viewport.height - 80.001
        )
      }
    })
  }

  it('keeps the ground pivot fixed across full turns and zooming', () => {
    const initial = { x: -240, y: -370, zoom: 0.8, rotation: 3 }
    const pivot = { x: 317, y: 241 }
    const ground = boardToTown(
      (pivot.x - initial.x) / initial.zoom,
      (pivot.y - initial.y) / initial.zoom,
      initial.rotation
    )
    for (const delta of [0.5, Math.PI, Math.PI * 2, Math.PI * 6 + 0.2]) {
      const rotated = rotateTownAt(initial, delta, pivot)
      const view = zoomTownAt(rotated, 1.5, pivot)
      const point = townToBoard(ground.x, ground.z, 0, view.rotation)
      expect(point.x * view.zoom + view.x).toBeCloseTo(pivot.x)
      expect(point.y * view.zoom + view.y).toBeCloseTo(pivot.y)
      expect(view.rotation).toBe(rotated.rotation)
      expect(Math.abs(view.rotation ?? 0)).toBeLessThanOrEqual(Math.PI)
    }
  })

  it('combines twist, pinch and pan around the two-finger midpoint', () => {
    const initial = { x: -200, y: -300, zoom: 0.8, rotation: 0.2 }
    const before: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 100, y: 200 },
      { x: 300, y: 200 }
    ]
    const after: typeof before = [
      { x: 260, y: 140 },
      { x: 260, y: 440 }
    ]
    const ground = boardToTown(
      (200 - initial.x) / initial.zoom,
      (200 - initial.y) / initial.zoom,
      initial.rotation
    )
    const view = gestureTownView(initial, before, after)
    expect(view.rotation).toBeCloseTo(0.2 + Math.PI / 2)
    expect(view.zoom).toBeCloseTo(1.2)
    const projected = townToBoard(ground.x, ground.z, 0, view.rotation)
    expect(projected.x * view.zoom + view.x).toBeCloseTo(260)
    expect(projected.y * view.zoom + view.y).toBeCloseTo(290)
    const restored = gestureTownView(view, after, before)
    expect(restored.x).toBeCloseTo(initial.x)
    expect(restored.y).toBeCloseTo(initial.y)
    expect(restored.zoom).toBeCloseTo(initial.zoom)
    expect(restored.rotation).toBeCloseTo(initial.rotation)
  })

  it('handles coincident fingers without a rotation or scale jump', () => {
    const view = gestureTownView(
      { x: 20, y: 30, zoom: 1, rotation: 0.5 },
      [
        { x: 100, y: 100 },
        { x: 100, y: 100 }
      ],
      [
        { x: 102, y: 103 },
        { x: 100, y: 100 }
      ]
    )
    expect(view.rotation).toBeCloseTo(0.5)
    expect(view.zoom).toBe(1)
    expect(view.x).toBeCloseTo(21)
    expect(view.y).toBeCloseTo(31.5)
  })
})
