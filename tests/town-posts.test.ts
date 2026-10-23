import {
  GreaterDepth,
  InstancedMesh,
  type Material,
  Matrix4,
  Scene,
  Vector3,
  type WebGLRenderer
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { BlogPostSummary } from '../src/lib/blog-post'
import { createTownCamera, updateTownCamera } from '../src/lib/town-camera'
import { createTownMaterials } from '../src/lib/town-materials'
import {
  clampTownView,
  fitTown,
  getTownBounds,
  nearestResidentRoute,
  placeTownBubble,
  layoutTownArticles as randomTownArticles,
  type TownArticle
} from '../src/lib/town-posts'
import { buildTownStatic } from '../src/lib/town-static'
import { createTownScene } from '../src/lib/town-three.client'
import { type TrafficRoute, trafficPose } from '../src/lib/town-traffic'
import { townToBoard } from '../src/lib/town-view'
import { containsTownGround, walkerLane, walkSegments } from '../src/lib/town-world'

// Tall buildings inside the street grid, shared by the drop and occlusion tests.
const buildings = (() => {
  const materials = createTownMaterials()
  const statics = buildTownStatic(materials)
  const boxes = statics.occluders.filter(
    (box) => box.maxY > 200 && Math.abs(box.minX) < 2400 && Math.abs(box.minZ) < 1600
  )
  statics.dispose()
  materials.dispose()
  return boxes
})()
const buildingCenters = buildings.map((box) => ({
  x: (box.minX + box.maxX) / 2,
  z: (box.minZ + box.maxZ) / 2
}))

// True when the point lies on the route's capsule circuit.
function onCircuit(point: { x: number; z: number }, route: TrafficRoute) {
  for (let time = 0; time < 400; time += 0.05) {
    const pose = trafficPose(route, time)
    if (Math.hypot(pose.x - point.x, pose.z - point.z) < 1) return true
  }
  return false
}
const onAnyCircuit = (point: { x: number; z: number }, route: TrafficRoute) =>
  walkSegments.some((segment) =>
    [-1, 1].some((side) =>
      onCircuit(point, {
        ...route,
        start: segment.start,
        end: segment.end,
        lane: side * Math.abs(route.lane),
        progress: 0
      })
    )
  )

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

// Scene interaction tests use repeatable layouts; randomness is tested separately.
const layoutTownArticles = (catalogue: BlogPostSummary[]) =>
  randomTownArticles(catalogue, () => 0.5)
// An avenue beside the plaza with a clear view from the default camera.
const street = walkSegments[23]
const beach = walkSegments.find(
  (segment) => segment.lane === segment.cycleLane && segment.lane < 40
)
if (!beach) throw new Error('Beach promenade missing')
const streetResident: TownArticle = {
  slug: 'retired-programmer',
  variant: 15,
  kind: 'walker',
  route: {
    start: street.start,
    end: street.end,
    lane: -walkerLane,
    progress: 0.4,
    speed: 10
  }
}

describe('article residents', () => {
  it('follows and drags residents with a rotated camera', () => {
    const town = createTownScene([streetResident])
    try {
      town.update(view, size)
      town.render(renderer, 0, false)
      for (const [step, rotation] of [0, Math.PI / 2, Math.PI, Math.PI * 1.5].entries()) {
        const before = town.residentPosition(streetResident.slug)
        if (!before) throw new Error('Resident missing')
        const point = townToBoard(before.x, before.z, 28, rotation)
        town.update({ x: 640 - point.x, y: 400 - point.y, zoom: 1, rotation }, size)
        town.follow(streetResident.slug)
        const followed = town.render(renderer, step * 16, false)
        expect(followed.rotation ?? 0).toBe(rotation)
        const positions = town.projectResidents(step * 16)
        expect(positions[0].x).toBeCloseTo(size.width / 2)
        expect(positions[0].inView).toBe(true)

        town.beginResidentDrag(streetResident.slug)
        const lifted = town.projectResidents(step * 16)[0]
        town.moveResidentDrag(80, -40)
        // The pointer may carry the resident up onto a flat roof, so compare on screen.
        const moved = town.projectResidents(step * 16)[0]
        expect(moved.x - lifted.x).toBeCloseTo(80)
        expect(Math.abs(moved.y - lifted.y + 40)).toBeLessThan(3)
        town.endResidentDrag(true)
        expect(town.residentPosition(streetResident.slug)).toEqual(before)
      }
    } finally {
      town.dispose()
    }
  })

  it('reuses occlusion checks during camera movement but refreshes moving residents', () => {
    const town = createTownScene([streetResident])
    try {
      town.update(view, size)
      town.render(renderer, 0, false)
      const initial = town.projectResidents(0)[0]
      expect(initial.visible).toBe(true)

      town.follow(null)
      const pose = town.residentPosition(streetResident.slug)
      if (!pose) throw new Error('Resident missing')
      const point = townToBoard(pose.x, pose.z, 28)
      for (let step = 1; step <= 5; step++) {
        const zoom = 1 + step * 0.05
        town.update(
          { x: size.width / 2 - point.x * zoom + step * 10, y: 400 - point.y * zoom, zoom },
          size
        )
        town.render(renderer, step * 16, false)
        expect(town.projectResidents(step * 16)[0].visible).toBe(true)
      }
      expect(town.projectResidents(180)[0].visible).toBe(true)

      town.follow(streetResident.slug)
      town.render(renderer, 196, true)
      town.projectResidents(196)
      town.render(renderer, 212, true)
      town.projectResidents(212)

      town.update({ ...view, zoom: 0.3 }, size)
      town.render(renderer, 228, false)
      town.projectResidents(228)
    } finally {
      town.dispose()
    }
  })

  it('checks residents entering the viewport before the next visibility refresh', () => {
    const town = createTownScene([streetResident])
    try {
      town.follow(null)
      town.update({ x: -100000, y: -100000, zoom: 1 }, size)
      town.render(renderer, 0, false)
      expect(town.projectResidents(0)[0].visible).toBe(false)

      town.follow(streetResident.slug)
      town.render(renderer, 16, false)
      expect(town.projectResidents(16)[0].visible).toBe(true)
    } finally {
      town.dispose()
    }
  })

  it.each(['walker', 'bicycle'] as const)(
    'returns a %s dropped by any building to an existing road and keeps its full circuit there',
    (kind) => {
      const article = layoutTownArticles(posts).find((person) => person.kind === kind)
      if (!article) throw new Error('Resident missing')
      const original = structuredClone(article.route)
      for (const point of [...buildingCenters, { x: -10000, z: 10000 }]) {
        const route = nearestResidentRoute(point, article.route)
        expect(route.speed).toBe(article.route.speed)
        expect(
          walkSegments.some((segment) => segment.start === route.start && segment.end === route.end)
        ).toBe(true)
        expect(Math.abs(route.lane)).toBeLessThanOrEqual(
          Math.max(
            ...walkSegments.map((segment) =>
              kind === 'bicycle' ? segment.cycleLane : segment.lane
            )
          )
        )
        for (let time = 0; time <= 1000; time += 20)
          expect(containsTownGround(trafficPose(route, time))).toBe(true)
      }
      expect(article.route).toEqual(original)
    }
  )

  it.each(['walker', 'bicycle'] as const)(
    'leaves a dropped %s on the grass, walks back without jumps, and then follows the road',
    (kind) => {
      for (const zoom of [1, 0.3, 2.5]) {
        const article = structuredClone(streetResident)
        article.kind = kind
        // The open sand beside the promenade leaves room to drop a resident anywhere.
        article.route = {
          start: beach.start,
          end: beach.end,
          lane: beach.lane,
          progress: 0.5,
          speed: kind === 'bicycle' ? 28 : 10
        }
        const town = createTownScene([article])
        try {
          town.update({ ...view, zoom }, size)
          town.render(renderer, 0, false)
          const before = town.projectResidents(0)[0]
          town.beginResidentDrag(article.slug)
          town.moveResidentDrag(140 * zoom, -70 * zoom)
          town.render(renderer, 100, false)
          const lifted = town.projectResidents(100)[0]
          expect(lifted.dropAllowed).toBe(true)
          expect(lifted.x - before.x).toBeCloseTo(140 * zoom)
          expect(lifted.y - before.y).toBeCloseTo((-70 - 28 / Math.SQRT2) * zoom)
          const held = town.residentPosition(article.slug)
          town.endResidentDrag()
          town.render(renderer, 200, false)
          expect(town.residentPosition(article.slug)).toEqual(held)
          if (!held) throw new Error('Resident missing')
          expect(onCircuit(held, article.route)).toBe(false)
          town.render(renderer, 300, true)
          town.render(renderer, 400, true)
          const walkingBack = town.residentPosition(article.slug)
          expect(walkingBack).not.toEqual(held)
          town.update({ ...view, zoom: zoom === 0.3 ? 1 : 0.3 }, size)
          town.render(renderer, 500, false)
          expect(town.residentPosition(article.slug)).toEqual(walkingBack)
          town.beginResidentDrag(article.slug)
          town.moveResidentDrag(-100, 80)
          town.render(renderer, 600, true)
          const carried = town.residentPosition(article.slug)
          town.render(renderer, 700, true)
          expect(town.residentPosition(article.slug)).toEqual(carried)
          town.endResidentDrag(true)
          town.render(renderer, 800, false)
          expect(town.residentPosition(article.slug)).toEqual(walkingBack)
          town.render(renderer, 900, true)
          let previous = town.residentPosition(article.slug)
          for (let now = 1000; now <= 60900; now += 100) {
            town.render(renderer, now, true)
            const next = town.residentPosition(article.slug)
            if (!previous || !next) throw new Error('Resident missing')
            expect(Math.hypot(next.x - previous.x, next.z - previous.z)).toBeLessThanOrEqual(
              article.route.speed * 0.1 + 0.001
            )
            if (now === 60900) expect(onAnyCircuit(next, article.route)).toBe(true)
            previous = next
          }
          expect(previous).not.toEqual(walkingBack)
        } finally {
          town.dispose()
        }
      }
    }
  )

  it('rejects drops on buildings and water and restores the previous walk', () => {
    const article = layoutTownArticles(posts)[0]
    const town = createTownScene([article])
    try {
      town.update(view, size)
      town.render(renderer, 0, false)
      const original = town.residentPosition(article.slug)
      if (!original) throw new Error('Resident missing')
      const from = townToBoard(original.x, original.z)
      for (const point of [...buildingCenters, { x: -20000, z: -20000 }]) {
        const to = townToBoard(point.x, point.z)
        town.beginResidentDrag(article.slug)
        town.moveResidentDrag(to.x - from.x, to.y - from.y)
        town.render(renderer, 100, false)
        expect(town.projectResidents(100)[0].dropAllowed).toBe(false)
        town.endResidentDrag()
        town.render(renderer, 200, false)
        expect(town.residentPosition(article.slug)).toEqual(original)
      }
    } finally {
      town.dispose()
    }
  })

  it('resumes walking from the original position after cancelling a first drag', () => {
    const article = layoutTownArticles(posts)[0]
    const town = createTownScene([article])
    try {
      town.update(view, size)
      town.render(renderer, 0, true)
      const before = { ...town.residentPosition(article.slug) }
      town.beginResidentDrag(article.slug)
      town.moveResidentDrag(100, 100)
      town.render(renderer, 100, true)
      town.endResidentDrag(true)
      expect(town.residentPosition(article.slug)).toEqual(before)
      town.render(renderer, 200, true)
      expect(town.residentPosition(article.slug)).not.toEqual(before)
    } finally {
      town.dispose()
    }
  })

  it('creates exactly one identity per article, stable across sorting and filtering', () => {
    const full = layoutTownArticles(posts)
    expect(full).toHaveLength(46)
    expect(new Set(full.map((person) => person.slug)).size).toBe(46)
    for (const person of layoutTownArticles([posts[10], posts[0], posts[45]])) {
      const original = full.find((candidate) => candidate.slug === person.slug)
      expect(person.variant).toBe(original?.variant)
      expect(person.kind).toBe(original?.kind)
    }
    expect(layoutTownArticles([])).toEqual([])
    expect(new Set(full.map((person) => person.kind))).toEqual(new Set(['walker', 'bicycle']))
    for (const person of full) {
      expect(Math.abs(person.route.lane)).toBeLessThanOrEqual(walkerLane)
    }
  })

  it('changes positions between visits while keeping each resident’s appearance', () => {
    const random = vi.spyOn(Math, 'random')
    try {
      random.mockReturnValue(0.2)
      const first = randomTownArticles(posts)
      random.mockReturnValue(0.8)
      const second = randomTownArticles(posts)
      expect(second.map((person) => person.route)).not.toEqual(first.map((person) => person.route))
      expect(second.map(({ route: _, ...identity }) => identity)).toEqual(
        first.map(({ route: _, ...identity }) => identity)
      )
    } finally {
      random.mockRestore()
    }
  })

  it.each([0, 0.25, 0.5, 0.999])(
    'spreads residents across town and keeps circuits on walkable ground (%s)',
    (value) => {
      const articles = randomTownArticles(posts, () => value)
      const positions = articles.map((article) => trafficPose(article.route, 0))
      expect(Math.min(...positions.map((point) => point.z))).toBeLessThan(-1000)
      expect(Math.max(...positions.map((point) => point.z))).toBeGreaterThan(1000)
      expect(Math.min(...positions.map((point) => point.x))).toBeLessThan(-1500)
      expect(Math.max(...positions.map((point) => point.x))).toBeGreaterThan(1500)
      const counts = new Map<string, number>()
      for (const article of articles) {
        const key = JSON.stringify([article.route.start, article.route.end])
        counts.set(key, (counts.get(key) ?? 0) + 1)
        for (let time = 0; time <= 1000; time += 5)
          expect(containsTownGround(trafficPose(article.route, time))).toBe(true)
      }
      expect(counts.size).toBeGreaterThan(20)
      expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1)
    }
  )

  it.each(['walker', 'bicycle'] as const)(
    'keeps a selected %s moving across focus and detail rebuilds without teleporting',
    (kind) => {
      const articles = layoutTownArticles(posts)
      const selected = articles.find((article) => article.kind === kind)
      if (!selected) throw new Error('Article resident missing')
      // Keep the speed assertion away from ambient traffic's avoidance sidesteps.
      selected.route = { ...selected.route, progress: 0.37 }
      const otherSlug = articles.find((article) => article.slug !== selected.slug)?.slug
      if (!otherSlug) throw new Error('Other resident missing')
      const town = createTownScene(articles)
      try {
        town.update(view, size)
        town.render(renderer, 0, true)
        town.render(renderer, 100, true)
        town.select(selected.slug)
        town.focus(selected.slug)
        const before = town.residentPosition(selected.slug)
        const other = town.residentPosition(otherSlug)
        town.render(renderer, 200, true)
        expect(town.residentPosition(selected.slug)).not.toEqual(before)
        expect(town.residentPosition(otherSlug)).not.toEqual(other)
        town.update({ ...view, zoom: 0.3 }, size)
        town.render(renderer, 300, true)
        const stopped = town.residentPosition(selected.slug)
        expect(stopped).not.toEqual(before)
        town.select(null)
        town.focus(null)
        town.render(renderer, 400, true)
        const resumed = town.residentPosition(selected.slug)
        if (!resumed || !stopped) throw new Error('Article resident missing')
        expect(Math.hypot(resumed.x - stopped.x, resumed.z - stopped.z)).toBeLessThanOrEqual(
          selected.route.speed * 0.1 + 0.001
        )
        expect(resumed).not.toEqual(stopped)
        town.filter([selected.slug])
        const hidden = town.residentPosition(otherSlug)
        town.render(renderer, 500, true)
        expect(town.residentPosition(otherSlug)).toEqual(hidden)
        expect(
          town
            .projectResidents(500)
            .filter((person) => person.visible)
            .every((person) => person.slug === selected.slug)
        ).toBe(true)
      } finally {
        town.dispose()
      }
    }
  )

  it('disables a building-occluded resident while keeping a visible street resident selectable', () => {
    // Just north-west of a tall building, the camera looks over its roof.
    const building = buildings.reduce((tallest, box) => (box.maxY > tallest.maxY ? box : tallest))
    const behind = { x: (building.minX + building.maxX) / 2, z: building.minZ - 30 }
    const town = createTownScene([
      {
        slug: 'behind-building',
        variant: 0,
        kind: 'walker',
        route: {
          start: { x: behind.x - 100, z: behind.z },
          end: { x: behind.x + 100, z: behind.z },
          lane: 0.001,
          progress: 0.5,
          speed: 0
        }
      },
      {
        ...structuredClone(streetResident),
        route: { start: beach.start, end: beach.end, lane: beach.lane, progress: 0.5, speed: 0 }
      }
    ])
    try {
      town.follow(null)
      const viewport = { width: 1600, height: 1200 }
      town.update(fitTown(viewport), viewport)
      town.render(renderer, 0, false)
      const positions = town.projectResidents(0)
      expect(positions.find((person) => person.slug === 'behind-building')?.visible).toBe(false)
      expect(positions.find((person) => person.slug === 'behind-building')?.inView).toBe(true)
      expect(positions.find((person) => person.slug === 'retired-programmer')?.visible).toBe(true)
    } finally {
      town.dispose()
    }
  })

  it('updates the selected silhouette when switching, filtering and rebuilding without motion', () => {
    const other: TownArticle = {
      ...structuredClone(streetResident),
      slug: 'other',
      variant: 0,
      kind: 'bicycle'
    }
    other.route.start.x += 400
    other.route.end.x += 400
    const town = createTownScene([streetResident, other])
    let rendered: Scene | undefined
    const renderSpy = vi.spyOn(renderer, 'render').mockImplementation((scene) => {
      rendered = scene as Scene
    })
    // X-ray instances of the selected resident, drawn only where buildings hide it.
    function render(now: number) {
      town.render(renderer, now, false)
      const silhouettes: InstancedMesh[] = []
      rendered?.traverse((object) => {
        if (
          object instanceof InstancedMesh &&
          (object.material as Material).depthFunc === GreaterDepth &&
          object.count > 0
        )
          silhouettes.push(object)
      })
      return silhouettes
    }
    function expectSelected(meshes: InstancedMesh[], slug: string) {
      const pose = town.residentPosition(slug)
      if (!pose) throw new Error('Resident missing')
      const matrix = new Matrix4()
      const point = new Vector3()
      let count = 0
      for (const mesh of meshes) {
        for (let index = 0; index < mesh.count; index++) {
          mesh.getMatrixAt(index, matrix)
          point.setFromMatrixPosition(matrix)
          expect(Math.hypot(point.x - pose.x, point.z - pose.z)).toBeLessThan(70)
          count++
        }
      }
      expect(count).toBeGreaterThan(10)
    }
    try {
      town.update(view, size)
      expect(render(0)).toEqual([])
      town.select(streetResident.slug)
      expectSelected(render(100), streetResident.slug)
      town.select(other.slug)
      expectSelected(render(200), other.slug)
      town.update({ ...view, zoom: 0.3 }, size)
      expectSelected(render(300), other.slug)
      town.select(null)
      expect(render(400)).toEqual([])
      town.select(other.slug)
      expectSelected(render(500), other.slug)
      town.filter([streetResident.slug])
      expect(render(600)).toEqual([])
      town.filter([streetResident.slug, other.slug])
      expectSelected(render(700), other.slug)
    } finally {
      renderSpy.mockRestore()
      town.dispose()
    }
  })

  it('keeps selected bicycle wheels moving and hides them with the rider', () => {
    const rider = layoutTownArticles(posts).find((article) => article.kind === 'bicycle')
    if (!rider) throw new Error('Cyclist missing')
    const town = createTownScene([rider])
    let wheels: InstancedMesh | undefined
    const renderSpy = vi.spyOn(renderer, 'render').mockImplementation((scene) => {
      if (!(scene instanceof Scene) || !scene.background) return
      scene.traverse((mesh) => {
        if (
          mesh instanceof InstancedMesh &&
          mesh.geometry.type === 'TorusGeometry' &&
          (mesh.material as Material).depthFunc !== GreaterDepth
        )
          wheels = mesh
      })
    })
    try {
      town.update(view, size)
      town.render(renderer, 0, true)
      if (!wheels) throw new Error('Bicycle wheels missing')
      expect(wheels.count).toBe(2)
      town.select(rider.slug)
      const stopped = [...wheels.instanceMatrix.array]
      town.render(renderer, 100, true)
      expect([...wheels.instanceMatrix.array]).not.toEqual(stopped)
      town.select(null)
      town.render(renderer, 200, true)
      expect([...wheels.instanceMatrix.array]).not.toEqual(stopped)
      town.filter([])
      town.render(renderer, 300, true)
      const matrix = new Matrix4()
      for (let i = 0; i < wheels.count; i++) {
        wheels.getMatrixAt(i, matrix)
        expect(matrix.determinant()).toBe(0)
      }
      expect(town.projectResidents(300).every((person) => !person.visible)).toBe(true)
    } finally {
      renderSpy.mockRestore()
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
  it('follows the newest resident, switches targets, and stays put after unlocking or filtering', () => {
    const articles = layoutTownArticles(posts.slice(0, 2))
    // Follow behavior needs interior routes, away from camera clamping at the town edge.
    articles.forEach((article, index) => {
      article.route = {
        ...article.route,
        start: walkSegments[23].start,
        end: walkSegments[23].end,
        progress: 0.35 + index * 0.3
      }
    })
    const town = createTownScene(articles)
    try {
      town.update(view, size)
      const initial = town.render(renderer, 0, true)
      const head = town.projectResidents(0)[0]
      const moving = town.render(renderer, 100, true)
      expect(moving).not.toEqual(initial)
      const tracked = town.projectResidents(100)[0]
      expect(tracked.x).toBeCloseTo(head.x)
      expect(tracked.y).toBeCloseTo(head.y)

      town.follow(articles[1].slug)
      town.render(renderer, 200, true)
      expect(town.projectResidents(200)[1].x).toBeCloseTo(size.width / 2)
      town.update({ ...moving, zoom: 1.25 }, { width: 390, height: 844 })
      const resized = town.render(renderer, 300, true)
      expect(resized.zoom).toBe(1.25)
      expect(town.projectResidents(300)[1].x).toBeCloseTo(195)

      town.follow(null)
      const unlockedPose = town.residentPosition(articles[1].slug)
      expect(town.render(renderer, 400, true)).toEqual(resized)
      expect(town.residentPosition(articles[1].slug)).not.toEqual(unlockedPose)
      town.follow(articles[0].slug)
      const relocked = town.render(renderer, 500, true)
      town.filter([articles[1].slug])
      expect(town.render(renderer, 600, true)).toEqual(relocked)
      town.follow(articles[0].slug)
      expect(town.render(renderer, 700, true)).toEqual(relocked)
      town.follow(articles[1].slug)
      const beforeDrag = town.render(renderer, 800, true)
      town.beginResidentDrag(articles[1].slug)
      town.moveResidentDrag(50, 50)
      expect(town.render(renderer, 900, true)).toEqual(beforeDrag)
    } finally {
      town.dispose()
    }
  })

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
    const townBounds = getTownBounds()
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
