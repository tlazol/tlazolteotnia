import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { townPersonAppearance, townPersonStyles } from '../src/lib/town-person'
import { createPersonGeometries } from '../src/lib/town-person-geometry'
import { createPersonParts } from '../src/lib/town-person-model'

const examples = townPersonStyles.flatMap((_, variant) =>
  Array.from({ length: 8 }, (_, sample) => ({ variant, identity: `resident-${variant}-${sample}` }))
)

it('preserves the existing article-to-costume slots', () => {
  expect(townPersonStyles.map(({ role }) => role)).toEqual([
    'cap-child',
    'dress-child',
    'casual',
    'dress',
    'hoodie',
    'cardigan',
    'kindergartner',
    'schoolchild',
    'student',
    'salaryman',
    'doctor',
    'office-lady',
    'magical-girl',
    'chef',
    'firefighter',
    'police',
    'builder',
    'farmer',
    'astronaut',
    'alien',
    'nurse',
    'hero',
    'wizard',
    'witch',
    'knight',
    'ninja',
    'pirate',
    'fairy',
    'vampire',
    'robot'
  ])
})

it('keeps each appearance stable, with hair colors independent of clothes', () => {
  const appearances = examples.map(({ variant, identity }) =>
    townPersonAppearance(variant, identity)
  )
  expect(new Set(appearances.map(({ hairColor }) => hairColor)).size).toBe(12)
  expect(new Set(appearances.map(({ hair }) => hair)).size).toBe(12)
  expect(new Set(appearances.map(({ fringe }) => fringe)).size).toBe(6)
  expect(new Set(appearances.map(({ headwear }) => headwear)).size).toBe(10)
  const colorsByCloth = new Map<number, Set<number>>()
  for (const { variant, identity } of examples) {
    const before = createPersonParts(variant, identity)
    createPersonParts((variant + 1) % townPersonStyles.length, 'another-resident', true)
    expect(createPersonParts(variant, identity)).toEqual(before)
    const cloth = before[0].color
    const colors = colorsByCloth.get(cloth) ?? new Set<number>()
    colors.add(townPersonAppearance(variant, identity).hairColor)
    colorsByCloth.set(cloth, colors)
  }
  for (const colors of colorsByCloth.values()) expect(colors.size).toBeGreaterThan(1)
})

describe('eyes stay covered across appearance combinations', () => {
  it.each([false, true])(
    'covers the whole eye area from front and oblique views (riding=%s)',
    (riding) => {
      const geometries = { ...createPersonGeometries(), box: new BoxGeometry(1, 1, 1) }
      const material = new MeshBasicMaterial()
      const ray = new Raycaster()
      const lift = riding ? 10 : 0
      const lean = riding ? -7 : 0
      const views = [
        new Vector3(0, 0, 1),
        new Vector3(-0.7, 0.35, 1).normalize(),
        new Vector3(0.7, 0.35, 1).normalize()
      ]
      try {
        for (const { variant, identity } of examples) {
          const meshes = createPersonParts(variant, identity, riding).map((part) => {
            const { shape, x, y, z, width, height, depth, angle, pitch, color } = part
            for (const value of [x, y, z, width, height, depth, angle, pitch, color])
              expect(Number.isFinite(value), `${identity}: ${shape}`).toBe(true)
            expect(Math.min(width, height, depth)).toBeGreaterThan(0)
            const mesh = new Mesh(geometries[shape], material)
            mesh.name = shape
            mesh.position.set(x, y, z)
            mesh.scale.set(width, height, depth)
            mesh.rotation.set(pitch, 0, angle, 'YXZ')
            mesh.updateMatrixWorld()
            return mesh
          })
          // Sample both eyes' centers and edges, not just a point behind each lens.
          for (const side of [-1, 1]) {
            for (const [x, y] of [
              [5.1, 52.2],
              [3, 52.2],
              [7.2, 52.2],
              [5.1, 54.4],
              [5.1, 50]
            ]) {
              const target = new Vector3(side * x, y + lift, lean + 15)
              for (const view of views) {
                ray.set(target.clone().addScaledVector(view, 80), view.clone().negate())
                const hit = ray.intersectObjects(meshes, false)[0]
                expect(hit, `${identity}: missing head`).toBeDefined()
                expect(
                  hit.object.name,
                  `${identity}: exposed eye at ${side * x}, ${y}`
                ).not.toMatch(/^girl(?:Head|Face)/)
              }
            }
          }
          // The mouth remains readable underneath the fringe or equipment.
          ray.set(new Vector3(0, 43.4 + lift, 80 + lean), new Vector3(0, 0, -1))
          const mouth = ray.intersectObjects(meshes, false)[0]
          expect(mouth?.object.name, `${identity}: hidden mouth`).toMatch(/^girlFace/)
        }
      } finally {
        for (const geometry of Object.values(geometries)) geometry.dispose()
        material.dispose()
      }
    },
    20000
  )
})
