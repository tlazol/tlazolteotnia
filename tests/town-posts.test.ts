import { Vector3, type WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'
import type { BlogPostSummary } from '../src/lib/blog-post'
import { onettBuildings } from '../src/lib/town-layout'
import {
  clampTownView,
  fitTown,
  layoutTownArticles,
  placeTownBubble,
  townBounds,
  townToBoard
} from '../src/lib/town-posts'
import { createTownScene } from '../src/lib/town-three.client'
import { createTownCamera, updateTownCamera } from '../src/lib/town-view'

const posts: BlogPostSummary[] = Array.from({ length: 46 }, (_, i) => ({
  slug: `post-${i}`,
  title: `記事 ${i}`,
  date: '2026-09-01',
  description: '',
  tags: []
}))
const size = { width: 1280, height: 720 }
const view = { x: 200, y: 200, zoom: 1 }
const renderer = {
  getRenderTarget: () => null,
  setRenderTarget: () => {},
  clear: () => {},
  render: () => {}
} as unknown as WebGLRenderer

describe('article residents', () => {
  it('creates exactly one identity per article, stable across sorting and filtering', () => {
    const full = layoutTownArticles(posts)
    expect(full).toHaveLength(46)
    expect(new Set(full.map((person) => person.slug)).size).toBe(46)
    for (const person of layoutTownArticles([posts[10], posts[0], posts[45]])) {
      expect(person).toEqual(full.find((candidate) => candidate.slug === person.slug))
    }
    expect(layoutTownArticles([])).toEqual([])
  })

  it('stops a selected person, preserves their pose across detail rebuilds, and resumes without teleporting', () => {
    const town = createTownScene(layoutTownArticles(posts))
    try {
      town.update(view, size)
      town.render(renderer, 0, true)
      town.render(renderer, 100, true)
      town.select(posts[0].slug)
      const stopped = town.residentPosition(posts[0].slug)
      const other = town.residentPosition(posts[1].slug)
      town.render(renderer, 200, true)
      expect(town.residentPosition(posts[0].slug)).toEqual(stopped)
      expect(town.residentPosition(posts[1].slug)).not.toEqual(other)
      town.update({ ...view, zoom: 0.3 }, size)
      town.render(renderer, 300, true)
      expect(town.residentPosition(posts[0].slug)).toEqual(stopped)
      town.select(null)
      town.render(renderer, 400, true)
      const resumed = town.residentPosition(posts[0].slug)
      if (!resumed || !stopped) throw new Error('Article resident missing')
      expect(Math.hypot(resumed.x - stopped.x, resumed.z - stopped.z)).toBeLessThanOrEqual(1.5)
      expect(resumed).not.toEqual(stopped)
      town.filter([posts[0].slug])
      const hidden = town.residentPosition(posts[1].slug)
      town.render(renderer, 500, true)
      expect(town.residentPosition(posts[1].slug)).toEqual(hidden)
      expect(
        town
          .projectResidents(500)
          .filter((person) => person.visible)
          .every((person) => person.slug === posts[0].slug)
      ).toBe(true)
    } finally {
      town.dispose()
    }
  })

  it('disables a building-occluded resident while keeping a visible street resident selectable', () => {
    const building = onettBuildings[0]
    const town = createTownScene([
      {
        slug: 'behind-building',
        variant: 0,
        route: {
          start: { x: building.x - 48, z: building.z - 40 },
          end: { x: building.x - 48, z: building.z + 120 },
          lane: 48,
          progress: 0,
          speed: 0
        }
      },
      ...layoutTownArticles([{ ...posts[0], slug: 'retired-programmer' }])
    ])
    try {
      const viewport = { width: 1600, height: 1200 }
      town.update(fitTown(viewport), viewport)
      town.render(renderer, 0, false)
      const positions = town.projectResidents(0)
      expect(positions.find((person) => person.slug === 'behind-building')?.visible).toBe(false)
      expect(positions.find((person) => person.slug === 'retired-programmer')?.visible).toBe(true)
    } finally {
      town.dispose()
    }
  })

  it('keeps article residents still for reduced motion and keyboard focus', () => {
    const town = createTownScene(layoutTownArticles(posts.slice(0, 1)))
    try {
      town.update(view, size)
      town.render(renderer, 0, false)
      const initial = town.residentPosition(posts[0].slug)
      town.render(renderer, 10000, false)
      expect(town.residentPosition(posts[0].slug)).toEqual(initial)
      town.focus(posts[0].slug)
      town.render(renderer, 10100, true)
      town.render(renderer, 10200, true)
      expect(town.residentPosition(posts[0].slug)).toEqual(initial)
      town.focus(null)
      town.render(renderer, 10300, true)
      expect(town.residentPosition(posts[0].slug)).not.toEqual(initial)
    } finally {
      town.dispose()
    }
  })
})

describe('town viewport and conversations', () => {
  it('aligns the head of a resident with its DOM overlay at every zoom', () => {
    const camera = createTownCamera()
    for (const zoom of [0.2, 1, 2.5]) {
      const current = { ...view, zoom }
      updateTownCamera(camera, current, size)
      const point = townToBoard(2200, 650, 46)
      const projected = new Vector3(2200, 46, 650).project(camera)
      expect(((projected.x + 1) * size.width) / 2).toBeCloseTo(current.x + point.x * zoom)
      expect(((1 - projected.y) * size.height) / 2).toBeCloseTo(current.y + point.y * zoom)
    }
  })

  it('fits all landmarks and clamps panning without relying on article count', () => {
    for (const viewport of [size, { width: 390, height: 844 }]) {
      const fitted = fitTown(viewport)
      expect(fitted.x + townBounds.left * fitted.zoom).toBeGreaterThanOrEqual(0)
      expect(fitted.x + townBounds.right * fitted.zoom).toBeLessThanOrEqual(viewport.width)
      expect(fitted.y + townBounds.top * fitted.zoom).toBeGreaterThanOrEqual(70)
      expect(fitted.y + townBounds.bottom * fitted.zoom).toBeLessThanOrEqual(viewport.height - 60)
      const clamped = clampTownView({ x: 1e6, y: -1e6, zoom: 10 }, viewport)
      expect(clamped.zoom).toBe(2.5)
      expect(clamped.x + townBounds.left * clamped.zoom).toBeLessThanOrEqual(40)
      expect(clamped.y + townBounds.bottom * clamped.zoom).toBeGreaterThanOrEqual(
        viewport.height - 80
      )
    }
  })

  it('keeps long-title bubbles inside the viewport and flips them below top-edge residents', () => {
    const viewport = { width: 390, height: 844 }
    const bubble = { width: 320, height: 300 }
    for (const point of [
      { x: 5, y: 90 },
      { x: 385, y: 600 },
      { x: 190, y: 740 }
    ]) {
      const position = placeTownBubble(point, bubble, viewport)
      expect(position.left).toBeGreaterThanOrEqual(12)
      expect(position.left + bubble.width).toBeLessThanOrEqual(viewport.width - 12)
      expect(position.top).toBeGreaterThanOrEqual(82)
      expect(position.top + bubble.height).toBeLessThanOrEqual(viewport.height - 95)
      if (point.y === 90) expect(position.above).toBe(false)
    }
  })
})
