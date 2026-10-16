import type { TownPartWriter, townColors } from './town-model-parts'
import type { townTerrain } from './town-terrain'

export function createTownSceneryModels(
  { part, box }: TownPartWriter,
  colors: typeof townColors,
  terrainAt: (x: number, z: number) => ReturnType<typeof townTerrain>
) {
  function landscapeScenery(
    x: number,
    z: number,
    size: number,
    elevation: number,
    terrain: ReturnType<typeof townTerrain>
  ) {
    // Use the same local footprint as a tree, including near roads and garden paths.
    function block(
      dx: number,
      y: number,
      dz: number,
      w: number,
      h: number,
      d: number,
      tint: number
    ) {
      box(x + dx * size, elevation + y * size, z + dz * size, w * size, h * size, d * size, tint)
    }
    if (terrain.scenery === 'palm') {
      for (let i = 0; i < 7; i++) {
        block(i * 2 - 8, i * 18 + 9, 0, 14, 18, 14, i % 2 ? colors.wood : colors.sand)
      }
      for (const side of [-1, 1]) {
        for (let step = 0; step < 3; step++) {
          const reach = side * (15 + step * 17)
          const y = 139 - step * step * 5
          block(reach, y, 0, 28, 8, 19 - step * 4, terrain.leaf)
          block(0, y + 3, reach, 19 - step * 4, 8, 28, terrain.highlight)
        }
      }
      block(3, 131, 7, 14, 15, 14, colors.wood)
      block(-8, 127, 3, 12, 13, 12, colors.door)
    } else if (terrain.scenery === 'cactus') {
      block(0, 43, 0, 24, 86, 22, terrain.leaf)
      block(-6, 44, 12, 4, 74, 2, terrain.highlight)
      for (const side of [-1, 1]) {
        block(side * 23, 33 + side * 10, 0, 28, 15, 18, terrain.leaf)
        block(side * 33, 49 + side * 10, 0, 14, 42, 18, terrain.leaf)
        block(side * 36, 52 + side * 10, 10, 3, 30, 2, terrain.highlight)
      }
      block(0, 89, 0, 17, 7, 15, terrain.flower)
      // Low wind-carved sand ripples stay below walking obstacle height.
      for (let i = 0; i < 3; i++) {
        block(12 - i * 7, 0, 30 + i * 12, 75 - i * 16, 2, 3, terrain.shadow)
      }
    } else if (terrain.scenery === 'crystal') {
      for (const [dx, dz, height] of [
        [-27, 5, 48],
        [0, -9, 100],
        [27, 12, 65]
      ]) {
        block(dx, height / 2, dz, 22, height, 22, terrain.leaf)
        block(dx - 6, height / 2, dz + 12, 7, height, 2, terrain.highlight)
        part(
          'gable',
          x + dx * size,
          elevation + height * size,
          z + dz * size,
          22 * size,
          24 * size,
          22 * size,
          terrain.highlight
        )
      }
    } else if (terrain.scenery === 'mesa') {
      block(0, 15, 0, 96, 30, 76, terrain.outline)
      block(-5, 37, -3, 78, 14, 65, terrain.highlight)
      block(-9, 56, -5, 70, 24, 58, terrain.leaf)
      block(-13, 71, -7, 58, 6, 50, terrain.highlight)
      block(41, 7, 29, 19, 14, 22, terrain.leaf)
    } else if (terrain.scenery === 'mushroom') {
      for (const [dx, dz, height, width] of [
        [0, -8, 64, 84],
        [35, 26, 26, 38]
      ]) {
        block(dx, height / 2, dz, 13, height, 13, terrain.highlight)
        part(
          'disc',
          x + dx * size,
          elevation + height * size,
          z + dz * size,
          width * size,
          16 * size,
          width * size,
          terrain.outline
        )
        part(
          'disc',
          x + dx * size,
          elevation + (height + 11) * size,
          z + dz * size,
          (width - 12) * size,
          12 * size,
          (width - 12) * size,
          terrain.leaf
        )
        for (const side of [-1, 1]) {
          block(dx + side * width * 0.2, height + 18, dz + side * 8, 9, 2, 9, terrain.highlight)
        }
      }
    }
  }

  function tree(x: number, z: number, size = 1, elevation = 0) {
    const terrain = terrainAt(x, z)
    box(x + 16, elevation + 1, z + 12, 74 * size, 1, 58 * size, colors.shadow)
    if (terrain.scenery !== 'tree') {
      landscapeScenery(x, z, size, elevation, terrain)
      return
    }
    box(x, elevation + 24 * size, z, 13 * size, 48 * size, 13 * size, colors.trunk)
    part('tree', x, elevation + 61 * size, z, 43 * size, 30 * size, 40 * size, terrain.outline)
    part('tree', x, elevation + 90 * size, z, 52 * size, 60 * size, 48 * size, terrain.leaf)
    part(
      'tree',
      x - 10 * size,
      elevation + 122 * size,
      z - 8 * size,
      38 * size,
      33 * size,
      36 * size,
      terrain.highlight
    )
  }

  function bench(x: number, z: number) {
    box(x, 15, z, 58, 8, 22, colors.trunk)
    box(x, 30, z - 12, 58, 24, 5, colors.wood)
    for (const dx of [-19, 19]) box(x + dx, 7, z, 5, 14, 19, colors.window)
  }

  function flowerbed(x: number, z: number) {
    box(x, 7, z, 90, 14, 40, colors.hedge)
    for (let i = 0; i < 6; i++) {
      box(x - 34 + i * 13, 18, z + (i % 2) * 9 - 5, 9, 9, 9, i % 2 ? colors.cream : colors.flower)
    }
  }

  function park(x: number, z: number, variant: number) {
    part('ground', x, 2, z, 310, 2, 310, terrainAt(x, z).ground)
    box(x, 3, z, 30, 2, 310, colors.sand)
    box(x, 3, z + 55, 310, 2, 26, colors.sand)
    if (variant % 3 === 0) {
      // Stepped banks keep the pond on the same pixel grid as the trees.
      box(x - 58, 3, z - 48, 148, 3, 122, colors.sand)
      box(x - 58, 5, z - 48, 126, 2, 96, colors.water)
      box(x - 58, 5, z - 48, 152, 2, 50, colors.water)
      for (const dx of [-32, 18]) box(x - 58 + dx, 7, z - 43 + dx, 35, 1, 5, colors.waterHighlight)
    } else if (variant % 3 === 1) {
      box(x - 65, 4, z - 52, 110, 5, 110, colors.sand)
      for (const dx of [-102, -28]) box(x + dx, 43, z - 45, 7, 80, 7, colors.wood)
      box(x - 65, 85, z - 45, 90, 7, 9, colors.flower)
      for (const dx of [-79, -51]) box(x + dx, 56, z - 45, 3, 54, 3, colors.ink)
      box(x - 65, 29, z - 45, 38, 6, 22, colors.water)
    } else {
      flowerbed(x - 70, z - 70)
      flowerbed(x - 70, z - 18)
    }
    tree(x + 88, z - 78, 0.85)
    tree(x - 92, z + 110, 0.7)
    bench(x + 88, z + 100)
  }

  const glyphs: Record<string, string> = {
    A: '01110/10001/10001/11111/10001/10001/10001',
    B: '11110/10001/10001/11110/10001/10001/11110',
    C: '01111/10000/10000/10000/10000/10000/01111',
    D: '11110/10001/10001/10001/10001/10001/11110',
    E: '11111/10000/10000/11110/10000/10000/11111',
    F: '11111/10000/10000/11110/10000/10000/10000',
    G: '01111/10000/10000/10111/10001/10001/01111',
    H: '10001/10001/10001/11111/10001/10001/10001',
    I: '11111/00100/00100/00100/00100/00100/11111',
    K: '10001/10010/10100/11000/10100/10010/10001',
    L: '10000/10000/10000/10000/10000/10000/11111',
    M: '10001/11011/10101/10101/10001/10001/10001',
    N: '10001/11001/11001/10101/10011/10011/10001',
    O: '01110/10001/10001/10001/10001/10001/01110',
    P: '11110/10001/10001/11110/10000/10000/10000',
    R: '11110/10001/10001/11110/10100/10010/10001',
    S: '01111/10000/10000/01110/00001/00001/11110',
    T: '11111/00100/00100/00100/00100/00100/00100',
    U: '10001/10001/10001/10001/10001/10001/01110',
    W: '10001/10001/10001/10101/10101/11011/10001',
    Y: '10001/10001/01010/00100/00100/00100/00100',
    "'": '00100/00100/01000/00000/00000/00000/00000'
  }
  function sign(text: string, y: number, z: number, tint = colors.flower, pixel = 3) {
    const width = (text.length * 6 + 2) * pixel
    box(0, y, z, width + 8, pixel * 11, 7, colors.curb)
    box(0, y + 1, z + 4, width, pixel * 9, 3, colors.cream)
    for (let i = 0; i < text.length; i++) {
      const rows = glyphs[text[i]]?.split('/') ?? []
      rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          if (row[dx] === '1')
            box(
              (i * 6 + dx - text.length * 3 + 1) * pixel,
              y + (3 - dy) * pixel,
              z + 7,
              pixel,
              pixel,
              2,
              tint
            )
        }
      })
    }
  }
  function fence(width: number, depth: number) {
    for (const side of [-1, 1]) {
      box((side * width) / 2, 23, 0, 5, 7, depth, colors.cream)
      for (let z = -depth / 2; z <= depth / 2; z += 20)
        box((side * width) / 2, 20, z, 6, 40, 6, colors.cream)
      box(side * (width / 4 + 15), 23, depth / 2, width / 2 - 30, 7, 5, colors.cream)
    }
    for (let x = -width / 2; x <= width / 2; x += 20) {
      if (Math.abs(x) > 30) box(x, 20, depth / 2, 6, 40, 6, colors.cream)
    }
  }

  return { tree, bench, flowerbed, park, sign, fence }
}
