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
  { variant: 0, identity: 'give-the-ai-precise-instructions' }
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
  // Tilt about the neck, then lean onto the saddle as the model does.
  const pivot = new Vector3(0, 26.5, 0)
  local
    .sub(pivot)
    .applyAxisAngle(new Vector3(1, 0, 0), personHeadTilt)
    .add(pivot)
  if (riding) {
    local.sub(new Vector3(0, 13, 0)).applyAxisAngle(new Vector3(1, 0, 0), 0.2)
    local.add(new Vector3(0, 35, -7))
  }
  return local
}

describe('faces read from the 45° town camera', () => {
  it.each([false, true])('shows both eyes and the mouth (riding=%s)', (riding) => {
    const geometries = createPersonGeometries()
    const ray = new Raycaster()
    // Facing the camera, and turned a quarter either way.
    const views = [0, -Math.PI / 4, Math.PI / 4].map((yaw) =>
      new Vector3(Math.sin(yaw), 1, Math.cos(yaw)).normalize()
    )
    try {
      for (const { variant, identity } of examples) {
        const scene = meshes(createPersonParts(variant, identity, riding), geometries)
        const targets = [
          ...[-1, 1].map((side) => onHead(side * personFace.eyeAngle, personFace.eyeY, riding)),
          onHead(0, personFace.mouthY, riding)
        ]
        for (const target of targets) {
          for (const view of views) {
            // Skip the far eye when the head turns away from the camera.
            if (target.x * view.x < -4) continue
            ray.set(target.clone().addScaledVector(view, 200), view.clone().negate())
            const hit = ray.intersectObjects(scene, false)[0]
            expect(hit?.object.name, `${identity}: hidden face at ${target.toArray()}`).toMatch(
              /^girlFace/
            )
          }
        }
      }
    } finally {
      for (const geometry of Object.values(geometries)) geometry.dispose()
    }
  })
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
})
