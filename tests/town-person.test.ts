import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { townHairColors, townPersonAppearance, townPersonStyles } from '../src/lib/town-person'
import { createPersonGeometries, headPoint, personFace } from '../src/lib/town-person-geometry'
import {
  createPersonParts,
  type PersonPart,
  personHead,
  personHeadTilt
} from '../src/lib/town-person-model'

const examples = [
  ...townPersonStyles.flatMap((_, variant) =>
    Array.from({ length: 6 }, (_, sample) => ({
      variant,
      identity: `resident-${variant}-${sample}`
    }))
  ),
  { variant: 0, identity: 'give-the-ai-precise-instructions' },
  { variant: 0, identity: 'skills-inventory' },
  { variant: 0, identity: 'understanding-harnesses-again' }
]

it('gives every girl her own hairstyle, fringe and eyes', () => {
  const roles = townPersonStyles.map(({ role }) => role)
  expect(new Set(roles).size).toBe(roles.length)
  const looks = townPersonStyles.map(({ hair, bangs, eyes }) => `${hair}/${bangs}/${eyes}`)
  expect(new Set(looks).size).toBe(looks.length)
})

it('keeps each appearance stable and independent of the costume', () => {
  const colors = new Set(examples.map(({ identity }) => townPersonAppearance(identity).hairColor))
  expect(colors.size).toBe(townHairColors.length)
  for (const { variant, identity } of examples) {
    const before = createPersonParts(variant, identity)
    createPersonParts((variant + 1) % townPersonStyles.length, 'another-resident', true)
    expect(createPersonParts(variant, identity)).toEqual(before)
  }
})

function meshes(parts: PersonPart[], geometries: ReturnType<typeof createPersonGeometries>) {
  const material = new MeshBasicMaterial()
  return parts.map((part) => {
    const { shape, x, y, z, width, height, depth, angle, pitch, color } = part
    for (const value of [x, y, z, width, height, depth, angle, pitch, color])
      expect(Number.isFinite(value), shape).toBe(true)
    expect(Math.min(width, height, depth)).toBeGreaterThan(0)
    const mesh = new Mesh(geometries[shape], material)
    mesh.name = shape
    mesh.position.set(x, y, z)
    mesh.scale.set(width, height, depth)
    mesh.rotation.set(pitch, 0, angle, 'YXZ')
    mesh.updateMatrixWorld()
    return mesh
  })
}

// Where a point on the unit head lands once the head is placed and tilted.
function onHead(a: number, y: number, riding: boolean) {
  const [x, py, z] = headPoint(a, Math.asin(y * 2), 1.012)
  const local = new Vector3(
    x * personHead.width,
    py * personHead.height + personHead.y,
    z * personHead.depth + personHead.z
  )
  // Tilt about the neck (riders lift against the lean), then lean onto the saddle.
  const pivot = new Vector3(0, 26.5, 0)
  local
    .sub(pivot)
    .applyAxisAngle(new Vector3(1, 0, 0), riding ? personHeadTilt - 0.2 : personHeadTilt)
    .add(pivot)
  if (riding) {
    local.sub(new Vector3(0, 13, 0)).applyAxisAngle(new Vector3(1, 0, 0), 0.2)
    local.add(new Vector3(0, 35, -7))
  }
  return local
}

describe('faces read from the 45° town camera', () => {
  it.each([false, true])(
    'hide the eyes but show the mouth (riding=%s)',
    (riding) => {
      const geometries = createPersonGeometries()
      const ray = new Raycaster()
      // Facing the camera, and turned a quarter either way.
      const views = [0, -Math.PI / 4, Math.PI / 4].map((yaw) =>
        new Vector3(Math.sin(yaw), 1, Math.cos(yaw)).normalize()
      )
      const { eyeAngle, eyeY, eyeHalfHeight, mouthY } = personFace
      // The center, corners, lash wing and rims of each eye (positive is outward).
      const eye = [
        [0, 0],
        [-0.12, 0],
        [0.12, 0],
        [0.17, 0.06],
        [0.1, -eyeHalfHeight * 0.8],
        [0, eyeHalfHeight * 0.8],
        [0, -eyeHalfHeight * 0.8]
      ]
      const misses: string[] = []
      try {
        for (const { variant, identity } of examples) {
          const scene = meshes(createPersonParts(variant, identity, riding), geometries)
          const targets = [
            ...[-1, 1].flatMap((side) =>
              eye.map(([a, y]) => ({
                point: onHead(side * (eyeAngle + a), eyeY + y, riding),
                shown: false
              }))
            ),
            { point: onHead(0, mouthY, riding), shown: true }
          ]
          for (const { point, shown } of targets) {
            for (const view of views) {
              // Skip the far eye when the head turns away from the camera. The mouth only
              // needs to read head-on; turned away, the cheek and fringe may hide it.
              if (point.x * view.x < -4 || (shown && view.x !== 0)) continue
              ray.set(point.clone().addScaledVector(view, 200), view.clone().negate())
              const hit = ray.intersectObjects(scene, false)[0]
              const face = /^girl(?:Face|Head)/.test(hit?.object.name ?? '')
              if (face !== shown)
                misses.push(
                  `${riding} ${views.indexOf(view)} ${identity} ${shown ? 'mouth' : 'eye'} ${hit?.object.name} at ${point.toArray().map((v) => v.toFixed(1))}`
                )
            }
          }
        }
        expect(misses).toEqual([])
      } finally {
        for (const geometry of Object.values(geometries)) geometry.dispose()
      }
    },
    15_000
  )
})

it('covers the back of the head with hair or headwear from above', () => {
  const geometries = createPersonGeometries()
  const ray = new Raycaster()
  try {
    for (const { variant, identity } of examples) {
      const scene = meshes(createPersonParts(variant, identity), geometries)
      // Offset from x = 0, where rays would graze the seam of the revolved meshes.
      for (let x = -11.5; x < 12; x += 2) {
        for (let z = -9.5; z < 2; z += 2) {
          ray.set(new Vector3(x, 200, z), new Vector3(0, -1, 0))
          const hit = ray.intersectObjects(scene, false)[0]
          expect(hit, `${identity}: missing head at ${x}, ${z}`).toBeDefined()
          expect(hit.object.name, `${identity}: bare scalp at ${x}, ${z}`).not.toMatch(
            /^girl(?:Head|Face)/
          )
        }
      }
    }
  } finally {
    for (const geometry of Object.values(geometries)) geometry.dispose()
  }
}, 15_000)

it('keeps hair inside hats and helms', () => {
  const geometries = createPersonGeometries()
  const ray = new Raycaster()
  const covered = ['witch', 'overalls', 'winter', 'explorer', 'jiangshi', 'pirate', 'knight']
  const misses: string[] = []
  try {
    // Hairstyles follow the costume, so one girl per costume is enough.
    for (const { variant, identity } of examples) {
      if (!covered.includes(townPersonStyles[variant].role) || !identity.endsWith('-0')) continue
      const hair = townPersonAppearance(identity).hairColor
      const parts = createPersonParts(variant, identity)
      const scene = meshes(parts, geometries)
      const isHair = ({ color, shape }: PersonPart) =>
        color === hair || /^girl(?:Hair_|Halo)/.test(shape)
      // Crowns, brims and helms; ear modules are discs too, but sit lower.
      const isHat = ({ shape, y }: PersonPart) =>
        /^girl(?:Cone|Cap|Cowl|Helmet)/.test(shape) || (shape === 'girlDisc' && y > 45)
      for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 6)
        for (const elevation of [0.35, Math.PI / 4, Math.PI / 3]) {
          const view = new Vector3(
            Math.sin(yaw) * Math.cos(elevation),
            Math.sin(elevation),
            Math.cos(yaw) * Math.cos(elevation)
          )
          for (let x = -20; x <= 20; x += 4)
            for (let y = 30; y <= 70; y += 4) {
              const target = new Vector3(x + 0.5, y, 0)
              ray.set(target.clone().addScaledVector(view, 200), view.clone().negate())
              const [first, ...rest] = ray.intersectObjects<(typeof scene)[number]>(scene, false)
              // Locks may fall out of a helm's face opening; only the crown counts.
              if (!first || first.point.y < 40) continue
              if (!isHair(parts[scene.indexOf(first.object)])) continue
              // Hair in front of the hat it should be tucked under has poked through it.
              const hat = rest.find(
                (hit) =>
                  hit.distance - first.distance < 6 && isHat(parts[scene.indexOf(hit.object)])
              )
              if (hat)
                misses.push(
                  `${identity} ${first.object.name} through ${hat.object.name} at ${first.point.toArray().map((v) => v.toFixed(1))}`
                )
            }
        }
    }
    expect(misses).toEqual([])
  } finally {
    for (const geometry of Object.values(geometries)) geometry.dispose()
  }
}, 30_000)
