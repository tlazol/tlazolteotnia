import type { PersonShape } from './town-person-geometry'
import type { PersonPart } from './town-person-model'
export type Part = {
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  angle: number
  pitch: number
  yaw: number
  color: number
  emission?: 'window' | 'lamp' | 'glow'
  motion?: PersonPart['motion'] | 'wheel'
}
export type TownShape =
  | 'box'
  | 'ground'
  | 'land'
  | 'roof'
  | 'gable'
  | 'tree'
  | 'disc'
  | 'wheel'
  | PersonShape
// Sampled from the daytime Onett map; keep these hues independent of scene lighting.
// https://cdn.wikimg.net/strategywiki/images/1/1e/EarthBound_Onett.png
export const townColors = {
  hedge: 0x2aba64,
  treeOutline: 0x527264,
  trunk: 0x9a5a6c,
  pavement: 0xeff0d3,
  curb: 0xa2a26c,
  road: 0xc3d39e,
  stripe: 0xeff0d3,
  shadow: 0x2aba64,
  cream: 0xf2f2bd,
  ink: 0x333333,
  window: 0x527a74,
  door: 0x8a623c,
  brick: 0xd27a74,
  wood: 0xb27a4c,
  flower: 0xfa0a5c,
  water: 0x52bafc,
  waterHighlight: 0xa2eafa,
  ocean: 0x388cba,
  shallows: 0x52bacb,
  sand: 0xeaca8c,
  court: 0xd28a74,
  asphalt: 0x82928c,
  glass: 0x8acacc
}
export const townRoofs = [0x8a72fc, 0x8a72fc, 0xd25afc, 0xfa0a5c]

export type ModelPlacement = { x: number; z: number; yaw: number; scale: number }
export function createTownPartWriter(
  collect: (shape: TownShape, part: Part) => void,
  placement: ModelPlacement
) {
  function part(
    shape: TownShape,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    tint: number,
    angle = 0,
    pitch = 0
  ) {
    const item: Part = {
      x:
        (x * Math.cos(placement.yaw) + z * Math.sin(placement.yaw)) * placement.scale + placement.x,
      y: y * placement.scale,
      z:
        (-x * Math.sin(placement.yaw) + z * Math.cos(placement.yaw)) * placement.scale +
        placement.z,
      width: width * placement.scale,
      height: height * placement.scale,
      depth: depth * placement.scale,
      angle,
      pitch,
      yaw: placement.yaw,
      color: tint
    }
    collect(shape, item)
    return item
  }
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: number,
    angle = 0,
    pitch = 0
  ) => part('box', x, y, z, w, h, d, c, angle, pitch)

  return {
    part,
    box,
    withYaw(delta: number, draw: () => void) {
      const previous = placement.yaw
      placement.yaw += delta
      try {
        draw()
      } finally {
        placement.yaw = previous
      }
    }
  }
}
export type TownPartWriter = ReturnType<typeof createTownPartWriter>
