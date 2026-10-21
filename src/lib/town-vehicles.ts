import { bicycleCrank, bicycleGrip, bicyclePose } from './town-bicycle-pose'
import { createPersonParts, type PersonPart } from './town-person-model'

// Moving models are lists of instanced parts. Vehicles add plain boxes, wheels,
// bicycle tyres and unlit lamps to the resident shapes.
export type MovingShape = PersonPart['shape'] | 'box' | 'wheel' | 'tyre' | 'light'
export type MovingPart = Omit<PersonPart, 'shape' | 'motion'> & {
  shape: MovingShape
  motion?: PersonPart['motion'] | 'wheel'
}

function part(
  shape: MovingShape,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  color: number,
  angle = 0,
  pitch = 0
): MovingPart {
  return { shape, x, y, z, width, height, depth, color, angle, pitch }
}

export function personParts(variant: number, identity: string): MovingPart[] {
  return createPersonParts(variant, identity)
}

export const carPaints = [0xe8605a, 0x4f7fe0, 0xf4f0e6, 0x67b98f, 0x9a72d6, 0xf29a4a, 0x52c1d6]

// A rounded toy car about 78 units long, facing +z.
export function carParts(variant: number): MovingPart[] {
  const type = variant % 4
  const taxi = type === 3
  const paint = taxi ? 0xf6c945 : carPaints[variant % carPaints.length]
  const roof = taxi ? 0xf6c945 : variant % 3 === 0 ? 0xfbf8ef : paint
  const glass = 0x7fb3cf
  const parts = [
    part('box', 0, 6, 0, 36, 4, 70, 0x3c3846),
    part('box', 0, 17, 0, 40, 18, 74, paint),
    part('box', 0, 25.5, 30, 38, 2, 14, paint, 0, 0.2),
    part('box', 0, 13, 38.5, 38, 7, 3, 0xd9dde2),
    part('box', 0, 13, -38.5, 38, 7, 3, 0xd9dde2),
    part('light', -12, 20, 37.6, 9, 5, 1, 0xfff1c2),
    part('light', 12, 20, 37.6, 9, 5, 1, 0xfff1c2),
    part('light', -13, 20, -37.6, 8, 4, 1, 0xff5a5a),
    part('light', 13, 20, -37.6, 8, 4, 1, 0xff5a5a)
  ]
  if (type === 2) {
    // A small delivery van with a tall cargo box.
    parts.push(
      part('box', 0, 37, -8, 40, 30, 56, roof),
      part('box', 0, 35, 22, 38, 18, 8, glass),
      part('box', 0, 50, 18, 38, 3, 12, roof),
      part('box', 20.4, 38, -10, 0.8, 14, 30, 0xf2c94c)
    )
  } else if (type === 1) {
    // A pickup with an open bed.
    parts.push(
      part('box', 0, 35, 8, 37, 18, 30, glass),
      part('box', 0, 45, 8, 38, 3, 31, roof),
      part('box', 0, 29, -22, 40, 6, 28, paint),
      part('box', 0, 33, -20, 22, 10, 18, 0xb07a4a)
    )
  } else {
    parts.push(
      part('box', 0, 35, -4, 36, 17, 42, glass),
      part('box', 0, 44.5, -4, 37, 3, 43, roof),
      part('box', 0, 35, -4, 37, 17, 4, paint)
    )
    if (taxi) parts.push(part('light', 0, 50, -4, 18, 7, 9, 0xfff6d2))
  }
  for (const side of [-1, 1]) {
    for (const z of [-24, 24]) {
      const wheel = part('wheel', side * 18, 10, z, 8, 19, 19, 0x2e2a35)
      wheel.motion = 'wheel'
      parts.push(wheel, part('box', side * 21.5, 10, z, 1, 7, 7, 0xd9dde2))
    }
    parts.push(part('box', side * 20.5, 32, 10, 3, 3, 5, paint))
  }
  return parts
}

export function cyclistParts(variant: number, identity: string): MovingPart[] {
  const frame = [0xfa5a6c, 0x527afc, 0xf6d64e, 0x8a72fc, 0xeff0d3][(variant + 2) % 5]
  const parts: MovingPart[] = []
  // Slim frame tubes keep daylight visible through both wheels and triangles.
  function tube(y1: number, z1: number, y2: number, z2: number, tint = frame) {
    parts.push(
      part(
        'box',
        0,
        (y1 + y2) / 2,
        (z1 + z2) / 2,
        3,
        Math.hypot(y2 - y1, z2 - z1),
        3,
        tint,
        0,
        Math.atan2(z2 - z1, y2 - y1)
      )
    )
  }
  for (const z of [-20, 20]) {
    const tyre = part('tyre', 0, 12, z, 18, 18, 18, 0x2e2a35)
    tyre.motion = 'wheel'
    const spokeA = part('box', 0, 12, z, 1, 15, 1, 0xa2a26c)
    const spokeB = part('box', 0, 12, z, 1, 1, 15, 0xa2a26c)
    spokeA.motion = spokeB.motion = 'wheel'
    parts.push(tyre, part('box', 0, 12, z, 7, 3, 3, 0xeff0d3), spokeA, spokeB)
  }
  tube(12, -20, 13, 0)
  tube(12, -20, 29, -7)
  tube(13, 0, 29, -7)
  tube(29, -7, 29, 14)
  tube(13, 0, 29, 14)
  tube(12, 20, 34, 13, 0xeff0d3)
  parts.push(part('box', 0, 31, -7, 11, 4, 10, 0x333333))
  tube(34, 13, bicycleGrip.y, bicycleGrip.z, 0xeff0d3)
  parts.push(
    part('box', 0, bicycleGrip.y, bicycleGrip.z, 23, 3, 3, 0x333333),
    part('box', 0, bicycleCrank.y, bicycleCrank.z, 12, 3, 3, 0x527a74)
  )
  for (const side of [-1, 1]) {
    for (const motion of ['crank', 'pedal'] as const) {
      const pose = bicyclePose(motion, side, 0)
      const item = part(
        'box',
        side * (motion === 'crank' ? 5 : 7),
        pose.y,
        pose.z,
        motion === 'crank' ? 2 : 7,
        pose.height,
        motion === 'crank' ? 2 : 5,
        motion === 'crank' ? 0xeff0d3 : 0x333333,
        0,
        pose.pitch
      )
      item.motion = motion
      parts.push(item)
    }
  }
  return [...parts, ...createPersonParts(variant, identity, true)]
}
