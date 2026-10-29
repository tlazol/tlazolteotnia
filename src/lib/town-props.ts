import { palette } from './town-buildings'
import { halloween, townHalloween } from './town-halloween'
import { face, surface, type TownBuilder } from './town-mesh-builder'

export type TreeKind = 'round' | 'cone' | 'palm' | 'blossom' | 'bush' | 'autumn' | 'birch'
type Random = () => number
const pick = <T>(rng: Random, items: readonly T[]) => items[Math.floor(rng() * items.length)]

const leaves = townHalloween
  ? {
      // Blazing maples, black pines and witch-purple blossoms.
      round: [0xe0702e, 0xc8452f, 0xe8902a, 0x9a3a2a, 0xd8602a],
      cone: [0x2f2a36, 0x3a3240, 0x2a2630, 0x352e3c],
      blossom: [0x9b6ad0, 0xb48ae0, 0x7a52b0, 0xc08ae8],
      autumn: [0xe8954a, 0xe07a2a, 0xd9673f, 0xb8402e],
      birch: [0xe8a838, 0xf0b448, 0xd8902a]
    }
  : ({
      round: [0x5fae5a, 0x6cbc5c, 0x52a057, 0x7cc46a, 0x63b16b],
      cone: [0x3f8a63, 0x2f7c5c, 0x4b9a6b, 0x367f6a],
      blossom: [0xf6b8cd, 0xf9cada, 0xee9fbe, 0xfbd8e4],
      autumn: [0xe8954a, 0xf2b84b, 0xd9673f, 0xeec05a],
      birch: [0x9fd16e, 0xb4dc78, 0x8cc565]
    } as const)

// Some broadleaf trees stand bare on Halloween, chosen by place so the layout's
// random stream is untouched.
function bare(x: number, z: number) {
  if (!townHalloween) return false
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return value - Math.floor(value) < 0.18
}

// Trees are drawn around (x, z) on the ground; `scale` 1 is about 1.6 residents tall.
// `lift` raises a broadleaf crown above passers-by on narrow sidewalks.
export function tree(
  b: TownBuilder,
  x: number,
  z: number,
  kind: TreeKind,
  rng: Random,
  scale = 1,
  y = 0,
  detail = 1,
  lift = 0
) {
  b.frame(
    x,
    z,
    rng() * Math.PI * 2,
    () => {
      if (kind === 'cone') {
        b.cylinder(0, 14, 0, 6, 28, 0x7a5642)
        const color = pick(rng, leaves.cone)
        for (const [index, [radius, height, base]] of [
          [46, 60, 22],
          [36, 52, 56],
          [24, 44, 88]
        ].entries())
          b.cone(0, base + height / 2, 0, radius, height, color, {
            segments: 7,
            sway: 1.5 + index,
            shade: 1 + index * 0.05
          })
        return
      }
      if (kind === 'palm') {
        const lean = (rng() - 0.5) * 0.5
        let px = 0
        let py = 0
        for (let segment = 0; segment < 6; segment++) {
          const angle = lean * (segment / 5) ** 1.4
          const length = 24
          b.cylinder(
            px + Math.sin(angle) * (length / 2),
            py + Math.cos(angle) * (length / 2),
            0,
            6 - segment * 0.4,
            length + 2,
            segment % 2 ? 0xb08a5c : 0xa07a50,
            {
              rz: -angle,
              segments: 6
            }
          )
          px += Math.sin(angle) * length
          py += Math.cos(angle) * length
        }
        const color = pick(rng, leaves.round)
        for (let leaf = 0; leaf < 7; leaf++) {
          const yaw = (leaf / 7) * Math.PI * 2
          b.frame(
            px,
            0,
            yaw,
            () => {
              b.box(0, py + 2, 22, 16, 3, 48, color, {
                rx: 0.35,
                sway: 3,
                shade: leaf % 2 ? 1 : 0.88
              })
              b.box(0, py - 9, 46, 12, 3, 22, color, { rx: 0.9, sway: 4, shade: 0.92 })
            },
            0
          )
        }
        for (let nut = 0; nut < 3; nut++)
          b.blob(px + Math.cos(nut * 2) * 6, py - 4, Math.sin(nut * 2) * 6, 8, 8, 8, 0x7a5a3a)
        return
      }
      if (kind === 'bush') {
        const color = pick(rng, leaves.round)
        b.blob(0, 14, 0, 44, 30, 40, color, { detail, sway: 0.8 })
        b.blob(14, 20, 6, 30, 24, 28, color, { detail, sway: 1, shade: 1.08 })
        if (rng() < 0.5)
          for (let flower = 0; flower < 4; flower++)
            b.blob(
              (rng() - 0.5) * 34,
              22 + rng() * 8,
              12 + rng() * 8,
              7,
              7,
              7,
              pick(rng, palette.flowers)
            )
        return
      }
      const birch = kind === 'birch'
      b.cylinder(
        0,
        24 + lift / 2,
        0,
        birch ? 5 : 7,
        48 + lift,
        birch ? 0xeeeae0 : townHalloween ? 0x5a4238 : 0x7d5a44,
        {
          segments: 7
        }
      )
      if (birch) for (const y of [14, 30]) b.box(0, y, 0, 11, 3, 11, 0x40404a)
      const palette_ =
        kind === 'blossom'
          ? leaves.blossom
          : kind === 'autumn'
            ? leaves.autumn
            : birch
              ? leaves.birch
              : leaves.round
      const color = pick(rng, palette_)
      if (!birch && kind !== 'blossom' && bare(x, z)) {
        // Crooked limbs reaching out of the trunk, each forking once.
        const bark = 0x4a3a34
        for (let limb = 0; limb < 5; limb++) {
          const yaw = limb * 1.3
          const tilt = 0.55 + (limb % 3) * 0.2
          const base = 40 + limb * 7 + lift
          b.frame(
            0,
            0,
            yaw,
            () => {
              b.cylinder(Math.sin(tilt) * 18, base + Math.cos(tilt) * 18, 0, 3, 38, bark, {
                rz: -tilt,
                segments: 5,
                top: 0.5,
                sway: 1
              })
              const tip = { x: Math.sin(tilt) * 36, y: base + Math.cos(tilt) * 36 }
              for (const fork of [-0.5, 0.6])
                b.cylinder(
                  tip.x + Math.sin(tilt + fork) * 9,
                  tip.y + Math.cos(tilt + fork) * 9,
                  0,
                  1.6,
                  20,
                  bark,
                  {
                    rz: -(tilt + fork),
                    segments: 4,
                    top: 0.3,
                    sway: 2
                  }
                )
            },
            0
          )
        }
        return
      }
      const crowns: [number, number, number, number][] = [
        [0, 72, 0, 74],
        [-20, 58, 10, 50],
        [22, 60, -8, 48],
        [4, 92, -4, 44]
      ]
      for (const [index, [cx, cy, cz, size]] of crowns.entries())
        b.blob(cx, cy + lift, cz, size, size * 0.86, size, color, {
          detail,
          sway: 2 + index * 0.6,
          shade: 0.9 + index * 0.06
        })
      if (kind === 'blossom')
        for (let petal = 0; petal < 3; petal++)
          b.blob(
            (rng() - 0.5) * 50,
            50 + rng() * 40,
            (rng() - 0.5) * 50 + 20,
            12,
            10,
            12,
            0xffffff,
            { detail: 0, sway: 2 }
          )
    },
    y,
    scale
  )
}

export function streetLamp(b: TownBuilder, x: number, z: number, yaw: number) {
  b.frame(x, z, yaw, () => {
    b.cylinder(0, 4, 0, 7, 8, 0x3d3a4a, { segments: 8 })
    b.cylinder(0, 64, 0, 2.6, 116, 0x3d3a4a, { segments: 6 })
    b.box(0, 118, 7, 3, 3, 16, 0x3d3a4a)
    b.box(0, 112, 15, 13, 12, 13, 0xffe2a3, { glow: -1.1 })
    b.box(0, 120, 15, 17, 4, 17, 0x3d3a4a)
  })
  return {
    x: x + Math.sin(yaw) * 15,
    y: 112,
    z: z + Math.cos(yaw) * 15
  }
}

export function bench(b: TownBuilder, x: number, z: number, yaw: number) {
  b.frame(x, z, yaw, () => {
    for (const side of [-1, 1]) b.box(side * 22, 8, 0, 4, 16, 18, 0x4a4552)
    b.box(0, 17, 0, 56, 4, 18, palette.wood, { surface: surface.planks })
    b.box(0, 28, -8, 56, 14, 3, palette.wood)
  })
}

export function fence(
  b: TownBuilder,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  color: number = palette.trim
) {
  const length = Math.hypot(x2 - x1, z2 - z1)
  const yaw = Math.atan2(x2 - x1, z2 - z1)
  b.frame((x1 + x2) / 2, (z1 + z2) / 2, yaw, () => {
    const posts = Math.max(2, Math.round(length / 22))
    for (let index = 0; index <= posts; index++)
      b.box(0, 12, -length / 2 + (index * length) / posts, 4, 24, 4, color)
    for (const y of [10, 20])
      b.box(0, y, 0, 2, 3, length, color, { faces: face.px | face.nx | face.py })
  })
}

export function hedge(
  b: TownBuilder,
  x: number,
  z: number,
  width: number,
  depth: number,
  color = 0x4f9a55
) {
  b.box(x, 13, z, width, 26, depth, color, { shade: 1 })
  b.box(x, 27, z, width - 4, 4, depth - 4, color, { shade: 1.1 })
}

export function flowerBed(
  b: TownBuilder,
  x: number,
  z: number,
  width: number,
  depth: number,
  rng: Random
) {
  b.box(x, 5, z, width + 8, 10, depth + 8, palette.stone, { surface: surface.stone })
  b.box(x, 10.5, z, width, 2, depth, 0x7a5a40)
  const count = Math.max(3, Math.round((width * depth) / 500))
  for (let index = 0; index < count; index++) {
    const fx = x + (rng() - 0.5) * (width - 8)
    const fz = z + (rng() - 0.5) * (depth - 8)
    b.blob(fx, 14, fz, 10, 9, 10, 0x5aa65a)
    b.blob(fx, 19, fz, 7, 6, 7, pick(rng, palette.flowers))
  }
}

export function mailbox(b: TownBuilder, x: number, z: number, yaw: number, color = 0x4d6fb3) {
  b.frame(x, z, yaw, () => {
    b.box(0, 18, 0, 4, 36, 4, palette.wood)
    b.box(0, 40, 0, 12, 12, 20, color)
    b.box(7, 46, -4, 1, 10, 3, 0xe8574f)
  })
}

export function hydrant(b: TownBuilder, x: number, z: number) {
  b.cylinder(x, 12, z, 6, 24, 0xe0503f, { segments: 8 })
  b.cylinder(x, 26, z, 4, 6, 0xe0503f, { segments: 8 })
  b.box(x, 14, z, 18, 4, 4, 0xe0503f)
}

export function vending(b: TownBuilder, x: number, z: number, yaw: number, color: number) {
  b.frame(x, z, yaw, () => {
    b.box(0, 30, 0, 32, 60, 22, color)
    b.box(0, 38, 11.2, 26, 30, 0.6, 0xe6f1f6, { faces: face.pz, glow: -0.8 })
    for (let row = 0; row < 3; row++)
      for (let column = 0; column < 4; column++)
        b.box(-9 + column * 6, 30 + row * 9, 11.8, 4, 6, 1, palette.flowers[(row + column) % 5], {
          faces: face.pz
        })
    b.box(0, 12, 11.4, 22, 6, 1, 0x3a3540, { faces: face.pz })
  })
}

export function trashBin(b: TownBuilder, x: number, z: number) {
  b.cylinder(x, 12, z, 8, 24, 0x5d7f6a, { segments: 8 })
  b.cylinder(x, 25, z, 9, 3, 0x40564a, { segments: 8 })
}

export function umbrella(
  b: TownBuilder,
  x: number,
  z: number,
  colors: readonly number[],
  rng: Random
) {
  b.frame(x, z, rng() * Math.PI, () => {
    b.cylinder(0, 40, 0, 1.6, 80, 0xeeeeee)
    for (let index = 0; index < 8; index++) {
      b.frame(0, 0, (index / 8) * Math.PI * 2, () =>
        b.box(0, 78, 20, 17, 2, 40, colors[index % 2], { rx: 0.4 })
      )
    }
    b.blob(0, 86, 0, 6, 6, 6, colors[0])
  })
}

export function crate(b: TownBuilder, x: number, z: number, size: number, rng: Random, y = 0) {
  b.box(x, y + size / 2, z, size, size, size, pick(rng, [0xb07a4a, 0x9c6a42, 0xc08a52]), {
    surface: surface.planks,
    ry: rng() * 0.4
  })
}

export function barrel(b: TownBuilder, x: number, z: number, color = 0x8a5a3a) {
  b.cylinder(x, 15, z, 11, 30, color, { segments: 10 })
  for (const y of [6, 24]) b.cylinder(x, y, z, 11.6, 3, 0x4a4552, { segments: 10 })
}

export function rockCluster(
  b: TownBuilder,
  x: number,
  z: number,
  size: number,
  rng: Random,
  y = 0
) {
  for (let index = 0; index < 3; index++) {
    const s = size * (0.5 + rng() * 0.6)
    b.rock(
      x + (rng() - 0.5) * size,
      y + s * 0.3,
      z + (rng() - 0.5) * size,
      s,
      s * 0.8,
      s,
      pick(rng, [0xa49a8e, 0x958c84, 0xb5ab9c]),
      {
        ry: rng() * 3
      }
    )
  }
}

export function busStop(b: TownBuilder, x: number, z: number, yaw: number) {
  b.frame(x, z, yaw, () => {
    for (const side of [-1, 1]) b.box(side * 40, 45, -10, 4, 90, 4, 0x3d3a4a)
    b.box(0, 92, 0, 96, 5, 40, 0x3f8f87, { rx: -0.08 })
    b.box(0, 50, -12, 82, 70, 1, 0xd6eef4, { faces: face.pz | face.nz, glow: -0.15 })
    b.box(0, 18, -4, 70, 4, 14, palette.wood)
    b.cylinder(54, 60, 0, 2, 120, 0x3d3a4a)
    b.cylinder(54, 116, 0, 12, 3, 0x4d6fb3, { rx: Math.PI / 2, segments: 12 })
  })
}

export function bicycleRack(b: TownBuilder, x: number, z: number, yaw: number, rng: Random) {
  b.frame(x, z, yaw, () => {
    b.box(0, 10, 0, 90, 4, 4, 0x8d949c)
    for (let index = 0; index < 3; index++) {
      if (rng() < 0.3) continue
      const bx = -30 + index * 30
      const color = pick(rng, [0xe85d5d, 0x4d7be0, 0xf2c94c, 0x3e8f84])
      b.cylinder(bx, 11, -14, 10, 3, 0x2e2a35, { rz: Math.PI / 2, segments: 10 })
      b.cylinder(bx, 11, 14, 10, 3, 0x2e2a35, { rz: Math.PI / 2, segments: 10 })
      b.box(bx, 20, 0, 3, 3, 26, color)
      b.box(bx, 26, -6, 8, 3, 8, 0x2e2a35)
    }
  })
}

// A carved pumpkin on the ground at (x, z); its face looks along +z of `yaw`.
// Size 1 stands about a third as tall as a resident.
export function jackOLantern(
  b: TownBuilder,
  x: number,
  z: number,
  yaw: number,
  size = 1,
  y = 0,
  carved = true
) {
  b.frame(
    x,
    z,
    yaw,
    () => {
      // Carved shells glow faintly from the candle inside.
      for (const [dx, width, shade] of [
        [-6, 16, 0.86],
        [6, 16, 0.86],
        [0, 21, 1]
      ] as const)
        b.blob(dx, 9, 0, width, 17, 21, halloween.pumpkin, {
          detail: 1,
          shade,
          glow: carved ? -0.3 : 0
        })
      b.cylinder(0, 19.5, 0, 1.8, 6, halloween.stem, { segments: 5, rz: 0.25 })
      if (!carved) return
      const candle = { glow: -1.8, faces: face.pz }
      for (const side of [-1, 1])
        b.box(side * 4.4, 11.5, 8.8, 3.6, 3.6, 2, halloween.candle, { ...candle, rz: Math.PI / 4 })
      b.box(0, 5.6, 8.6, 9, 2.6, 2, halloween.candle, candle)
      for (const side of [-1, 1]) b.box(side * 2.4, 7.2, 8.9, 1.8, 1.6, 2, halloween.candle, candle)
    },
    y,
    size
  )
}

// A weathered headstone or cross with a low grave mound in front of it.
export function gravestone(b: TownBuilder, x: number, z: number, yaw: number, cross: boolean) {
  b.frame(x, z, yaw, () => {
    if (cross) {
      b.box(0, 22, 0, 5, 44, 5, halloween.grave, { surface: surface.stone })
      b.box(0, 32, 0, 22, 5, 5, halloween.grave, { surface: surface.stone })
    } else {
      b.box(0, 13, 0, 24, 26, 7, halloween.grave, { surface: surface.stone })
      b.blob(0, 26, 0, 24, 14, 7, halloween.grave)
      b.box(0, 17, 3.6, 12, 2, 0.6, 0x5a5466, { faces: face.pz })
    }
    b.blob(0, 1, 22, 24, 7, 34, halloween.mound)
  })
}
