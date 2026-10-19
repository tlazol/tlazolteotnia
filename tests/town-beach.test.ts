import type { WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'
import {
  beachWalkingSegments,
  coastColumns,
  coastStep,
  containsTownGround
} from '../src/lib/town-coast'
import { onettRoads } from '../src/lib/town-layout'
import { createTownNavigation } from '../src/lib/town-navigation'
import { clampTownView, fitTown, type TownArticle } from '../src/lib/town-posts'
import { createTownStaticModel } from '../src/lib/town-static-model'
import { createTownScene } from '../src/lib/town-three.client'
import { trafficPose } from '../src/lib/town-traffic'
import { townToBoard } from '../src/lib/town-view'

describe('walkable beach', () => {
  it.each([true, false])(
    'joins dry sand to town and excludes the water (detail: %s)',
    (detailed) => {
      const model = createTownStaticModel(detailed)
      const navigation = createTownNavigation(model.obstacles, containsTownGround)
      const surfaceHeight = (x: number, z: number) =>
        Math.max(
          ...model.parts.box
            .filter(
              (part) =>
                Math.abs(x - part.x) <= part.width / 2 && Math.abs(z - part.z) <= part.depth / 2
            )
            .map((part) => part.y + part.height / 2)
        )
      for (const [index, { x, south, beach }] of coastColumns.entries()) {
        const point = { x, z: south + beach / 2 }
        expect(beach).toBeGreaterThanOrEqual(440)
        expect(navigation.canStand(point)).toBe(true)
        const surface = model.parts.box.find(
          (part) => part.x === x && part.z === point.z && part.depth === beach
        )
        expect(surface).toBeDefined()
        expect(surface && surface.y + surface.height / 2).toBe(-1)
        expect(navigation.findPath({ x, z: south - 16 }, point)).toEqual([point])
        expect(navigation.canStand({ x, z: south + beach - 24 })).toBe(true)
        expect(navigation.findPath(point, { x, z: south + beach - 24 })).toEqual([
          { x, z: south + beach - 24 }
        ])
        // A resident can reach the tide line, with water immediately below their feet.
        // Sampling beyond the sand catches both a lowered ocean and coastal stairs.
        for (const distance of [-24, 0, 24, 100, 250]) {
          const height = surfaceHeight(x, south + beach + distance)
          expect(height).toBeGreaterThanOrEqual(-4)
          expect(height).toBeLessThanOrEqual(0)
        }
        expect(navigation.canStand({ x, z: south + beach })).toBe(false)
        expect(navigation.canStand({ x, z: south + beach + 250 })).toBe(false)
        // Also cross the exposed sides of coves and the two ends of the beach.
        for (const direction of [-1, 1]) {
          const neighbor = coastColumns[index + direction]
          const start = neighbor ? Math.max(south, neighbor.south + neighbor.beach) : south
          const shore = south + beach
          if (shore - start < 48) continue
          const edge = x + (direction * coastStep) / 2
          const z = (start + shore) / 2
          expect(navigation.canStand({ x: edge - direction * 24, z })).toBe(true)
          expect(navigation.canStand({ x: edge + direction * 24, z })).toBe(false)
          for (const distance of [-24, 24, 100]) {
            const height = surfaceHeight(edge + direction * distance, z)
            expect(height).toBeGreaterThanOrEqual(-4)
            expect(height).toBeLessThanOrEqual(0)
          }
        }
      }
      for (const segment of beachWalkingSegments) {
        const route = { ...segment, progress: 0, speed: 12 }
        for (let time = 0; time <= 200; time++) {
          expect(navigation.canStand(trafficPose(route, time))).toBe(true)
        }
      }
    }
  )

  it('keeps residents away from exposed edges without blocking adjacent sand', () => {
    const last = coastColumns[coastColumns.length - 1]
    const edge = last.x + coastStep / 2
    expect(containsTownGround({ x: edge - 1, z: last.south + 200 })).toBe(false)
    expect(containsTownGround({ x: edge - 24, z: last.south + 200 })).toBe(true)
    for (let index = 1; index < coastColumns.length; index++) {
      const left = coastColumns[index - 1]
      const right = coastColumns[index]
      const boundary = right.x - coastStep / 2
      const leftShore = left.south + left.beach
      const rightShore = right.south + right.beach
      if (Math.abs(leftShore - rightShore) < 48) continue
      const z = Math.min(leftShore, rightShore) + 24
      const inlandDirection = leftShore > rightShore ? -1 : 1
      expect(containsTownGround({ x: boundary + inlandDirection, z })).toBe(false)
      expect(containsTownGround({ x: boundary + inlandDirection * 24, z })).toBe(true)
      expect(containsTownGround({ x: boundary, z: Math.min(leftShore, rightShore) - 24 })).toBe(
        true
      )
    }
  })

  it('fits every beach corner and keeps it accessible after camera rotation', () => {
    for (const size of [
      { width: 1280, height: 720 },
      { width: 390, height: 844 }
    ]) {
      for (let step = 0; step < 16; step++) {
        const rotation = (step * Math.PI) / 8
        const fitted = fitTown(size, rotation)
        for (const column of coastColumns) {
          for (const x of [column.x - coastStep / 2, column.x + coastStep / 2]) {
            for (const z of [column.south, column.south + column.beach]) {
              const point = townToBoard(x, z, 0, rotation)
              expect(fitted.x + point.x * fitted.zoom).toBeGreaterThanOrEqual(0)
              expect(fitted.x + point.x * fitted.zoom).toBeLessThanOrEqual(size.width)
              expect(fitted.y + point.y * fitted.zoom).toBeGreaterThanOrEqual(70)
              expect(fitted.y + point.y * fitted.zoom).toBeLessThanOrEqual(size.height - 60)
              const centered = {
                x: size.width / 2 - point.x,
                y: size.height / 2 - point.y,
                zoom: 1,
                rotation
              }
              const clamped = clampTownView(centered, size)
              expect(clamped.x + point.x).toBeGreaterThanOrEqual(40)
              expect(clamped.x + point.x).toBeLessThanOrEqual(size.width - 40)
              expect(clamped.y + point.y).toBeGreaterThanOrEqual(90)
              expect(clamped.y + point.y).toBeLessThanOrEqual(size.height - 80)
            }
          }
        }
      }
    }
  })

  it.each([1, 0.3])('moves a street resident onto sand and rejects water (zoom: %s)', (zoom) => {
    const article: TownArticle = {
      slug: 'beach-walker',
      variant: 0,
      kind: 'walker',
      route: {
        start: onettRoads[11].points[0],
        end: onettRoads[11].points[1],
        lane: -48,
        progress: 0.4,
        speed: 12
      }
    }
    const town = createTownScene([article])
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      clear: () => {},
      render: () => {}
    } as unknown as WebGLRenderer
    try {
      const size = { width: 1280, height: 720 }
      const shore = coastColumns[58]
      const destination = { x: shore.x, z: shore.south + shore.beach - 24 }
      const center = townToBoard(destination.x, destination.z)
      town.follow(null)
      town.update({ x: 640 - center.x * zoom, y: 360 - center.y * zoom, zoom }, size)
      town.render(renderer, 0, false)
      const original = town.residentPosition(article.slug)
      if (!original) throw new Error('Missing beach resident')
      const delta = townToBoard(destination.x - original.x, destination.z - original.z)
      town.beginResidentDrag(article.slug)
      town.moveResidentDrag(delta.x * zoom, delta.y * zoom)
      town.render(renderer, 100, false)
      const projected = town.projectResidents(100)[0]
      expect(projected.dropAllowed).toBe(true)
      expect(projected.visible).toBe(true)
      const dropped = town.residentPosition(article.slug)
      town.endResidentDrag()
      town.render(renderer, 200, false)
      expect(town.residentPosition(article.slug)).toEqual(dropped)
      town.render(renderer, 300, true)
      for (let now = 400; now <= 15300; now += 100) {
        town.render(renderer, now, true)
        const point = town.residentPosition(article.slug)
        expect(point && containsTownGround(point)).toBe(true)
      }
      const walking = town.residentPosition(article.slug)
      expect(walking).not.toEqual(dropped)
      if (!walking) throw new Error('Missing walking resident')
      const coast = coastColumns[Math.round((walking.x - coastColumns[0].x) / coastStep)]
      expect(walking.z).toBeGreaterThan(coast.south)
      const from = townToBoard(walking.x, walking.z)
      const sea = townToBoard(walking.x, 10000)
      town.beginResidentDrag(article.slug)
      town.moveResidentDrag((sea.x - from.x) * zoom, (sea.y - from.y) * zoom)
      expect(town.projectResidents(15400)[0].dropAllowed).toBe(false)
      town.endResidentDrag()
      expect(town.residentPosition(article.slug)).toEqual(walking)
    } finally {
      town.dispose()
    }
  })
})
