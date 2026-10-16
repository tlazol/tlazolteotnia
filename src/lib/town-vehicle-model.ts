import { bicycleCrank, bicycleGrip, bicyclePose } from './town-bicycle-pose'
import { townColors as colors, townRoofs as roofs, type TownPartWriter } from './town-model-parts'
import { createPersonParts } from './town-person-model'

export function createTownVehicleModels(
  { part, box }: TownPartWriter,
  detailed: boolean,
  identity?: string
) {
  function person(variant: number, riding = false) {
    for (const item of createPersonParts(variant, identity ?? String(variant), riding)) {
      const { shape, x, y, z, width, height, depth, color, angle, pitch } = item
      part(shape, x, y, z, width, height, depth, color, angle, pitch).motion = item.motion
    }
  }

  function car(variant: number) {
    const paint = [colors.flower, colors.water, colors.cream, roofs[0]][variant % 4]
    box(2, 2.7, 2, 35, 0.8, 70, colors.curb)
    box(0, 12, 0, 30, 12, 64, paint)
    box(0, 19, 23, 28, 5, 17, paint)
    box(0, 25, -4, 25, 16, 32, colors.window)
    box(0, 34, -5, 28, 4, 32, paint)
    box(0, 26, 13, 22, 10, 2, colors.glass)
    box(0, 26, -21, 22, 9, 2, colors.glass)
    for (const side of [-1, 1]) {
      for (const z of [-21, 21]) {
        part('disc', side * 15, 9, z, 14, 5, 14, colors.ink, Math.PI / 2)
        part('disc', side * 18, 9, z, 6, 1, 6, colors.pavement, Math.PI / 2)
      }
      box(side * 13, 26, -4, 2, 12, 3, paint)
      box(side * 17, 22, 10, 5, 4, 6, paint)
      box(side * 10, 15, 33, 7, 5, 2, colors.cream)
      box(side * 10, 15, -33, 7, 4, 2, colors.flower)
      if (detailed) box(side * 16, 17, -8, 1, 2, 6, colors.cream)
    }
    box(0, 8, 33, 28, 4, 3, colors.pavement)
    box(0, 8, -33, 28, 4, 3, colors.pavement)
    box(0, 14, 34, 9, 4, 1, colors.ink)
  }

  function cyclist(variant: number) {
    const frame = [0xfa0a5c, 0x527afc, 0xfafa74, 0x8a72fc, 0xeff0d3][(variant + 2) % 5]
    // Slim frame tubes keep daylight visible through both wheels and triangles.
    function tube(y1: number, z1: number, y2: number, z2: number, tint = frame) {
      box(
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
    }
    for (const z of [-20, 20]) {
      part('wheel', 0, 12, z, 18, 18, 18, colors.ink).motion = 'wheel'
      box(0, 12, z, 7, 3, 3, colors.pavement)
      if (detailed) {
        box(0, 12, z, 1, 15, 1, colors.curb).motion = 'wheel'
        box(0, 12, z, 1, 1, 15, colors.curb).motion = 'wheel'
      }
    }
    tube(12, -20, 13, 0)
    tube(12, -20, 29, -7)
    tube(13, 0, 29, -7)
    tube(29, -7, 29, 14)
    tube(13, 0, 29, 14)
    tube(12, 20, 34, 13, colors.pavement)
    box(0, 31, -7, 11, 4, 10, colors.ink)
    tube(34, 13, bicycleGrip.y, bicycleGrip.z, colors.pavement)
    box(0, bicycleGrip.y, bicycleGrip.z, 23, 3, 3, colors.ink)
    box(0, bicycleCrank.y, bicycleCrank.z, 12, 3, 3, colors.window)
    for (const side of [-1, 1]) {
      for (const motion of ['crank', 'pedal'] as const) {
        const pose = bicyclePose(motion, side, 0)
        box(
          side * (motion === 'crank' ? 5 : 7),
          pose.y,
          pose.z,
          motion === 'crank' ? 2 : 7,
          pose.height,
          motion === 'crank' ? 2 : 5,
          motion === 'crank' ? colors.pavement : colors.ink,
          0,
          pose.pitch
        ).motion = motion
      }
    }
    person(variant, true)
  }

  return { person, car, cyclist }
}
