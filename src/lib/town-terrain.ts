import { townLayoutScale } from './town-layout'

export type TownArchitecture =
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'tropical'
  | 'desert'
  | 'crystal'
  | 'mesa'
  | 'mushroom'

type TownTerrain = {
  architecture: TownArchitecture
  ground: number
  shadow: number
  outline: number
  leaf: number
  highlight: number
  flower: number
  scenery: 'tree' | 'palm' | 'cactus' | 'crystal' | 'mesa' | 'mushroom'
  density: number
}

// The scenery and ground share a palette so each landscape reads at every zoom.
const seasons = {
  spring: {
    architecture: 'spring',
    scenery: 'tree',
    density: 100,
    ground: 0xeda4c8,
    shadow: 0xc178a5,
    outline: 0x956387,
    leaf: 0xe580b2,
    highlight: 0xffd2e4,
    flower: 0xffe9b5
  },
  summer: {
    architecture: 'summer',
    scenery: 'tree',
    density: 100,
    ground: 0x89d8a0,
    shadow: 0x55ac86,
    outline: 0x427e79,
    leaf: 0x42b991,
    highlight: 0xb0ed9b,
    flower: 0xfff19b
  },
  autumn: {
    architecture: 'autumn',
    scenery: 'tree',
    density: 100,
    ground: 0xeab96a,
    shadow: 0xc38c60,
    outline: 0x945d65,
    leaf: 0xd87964,
    highlight: 0xffce7a,
    flower: 0xffe1aa
  },
  winter: {
    architecture: 'winter',
    scenery: 'tree',
    density: 100,
    ground: 0xd9eaf5,
    shadow: 0xa3bfd9,
    outline: 0x7a91b6,
    leaf: 0xb4d3e8,
    highlight: 0xf3f6ff,
    flower: 0xabb3e9
  }
} satisfies Record<string, TownTerrain>

const landscapes: { x: number; z: number; rx: number; rz: number; terrain: TownTerrain }[] = [
  {
    x: 3500,
    z: 1420,
    rx: 1650,
    rz: 820,
    terrain: {
      architecture: 'desert',
      scenery: 'cactus',
      density: 19,
      ground: 0xf5d781,
      shadow: 0xd6ac65,
      outline: 0x528e79,
      leaf: 0x73b990,
      highlight: 0xc3e7a0,
      flower: 0xffac84
    }
  },
  {
    x: 700,
    z: 1290,
    rx: 1300,
    rz: 700,
    terrain: {
      architecture: 'tropical',
      scenery: 'palm',
      density: 33,
      ground: 0xbbe3ab,
      shadow: 0x7abf9b,
      outline: 0x367d78,
      leaf: 0x37a78e,
      highlight: 0x87dca0,
      flower: 0xff9b72
    }
  },
  {
    x: 4380,
    z: -3510,
    rx: 1900,
    rz: 1250,
    terrain: {
      architecture: 'crystal',
      scenery: 'crystal',
      density: 29,
      ground: 0xa9a0d9,
      shadow: 0x817eae,
      outline: 0x6875ab,
      leaf: 0x9be3ed,
      highlight: 0xe8faff,
      flower: 0xf2ceff
    }
  },
  {
    x: 0,
    z: -3450,
    rx: 1720,
    rz: 1050,
    terrain: {
      architecture: 'mesa',
      scenery: 'mesa',
      density: 23,
      ground: 0xd78b77,
      shadow: 0xb86b65,
      outline: 0x976274,
      leaf: 0xc47a66,
      highlight: 0xf4c38d,
      flower: 0xf5d89c
    }
  },
  {
    x: -1280,
    z: -840,
    rx: 830,
    rz: 1330,
    terrain: {
      architecture: 'mushroom',
      scenery: 'mushroom',
      density: 42,
      ground: 0x77b6b8,
      shadow: 0x568f9f,
      outline: 0x726caa,
      leaf: 0xbc83ca,
      highlight: 0xf5d3ef,
      flower: 0xf8dca7
    }
  }
]

export function townTerrain(x: number, z: number): TownTerrain {
  x /= townLayoutScale
  z /= townLayoutScale
  for (const region of landscapes) {
    const dx = (x - region.x) / region.rx
    const dz = (z - region.z) / region.rz
    const edge = 1 + Math.sin(x / 270 + z / 410) * 0.12 + Math.cos(z / 190) * 0.06
    if (dx * dx + dz * dz < edge) return region.terrain
  }
  return townSeason(x, z)
}

function townSeason(x: number, z: number) {
  // Wandering boundaries keep the four regions from looking like a checkerboard.
  const east = x > 2200 + Math.sin(z / 620) * 340 + Math.sin(z / 230) * 100
  const north = z < -550 + Math.sin(x / 710) * 340 + Math.cos(x / 290) * 100
  return north ? (east ? seasons.winter : seasons.autumn) : east ? seasons.summer : seasons.spring
}

// Stepped shorelines use the same rectangles for drawing and walking exclusion.
export const townLakeStrips = [
  { x: -850, z: -700, rx: 560, rz: 720 },
  { x: 4940, z: -1640, rx: 600, rz: 810 }
].flatMap((lake) =>
  Array.from({ length: Math.floor((lake.rx * townLayoutScale * 2) / 64) }, (_, index) => {
    const x = lake.x - lake.rx + (index * 64 + 32) / townLayoutScale
    const reach = Math.sqrt(Math.max(0, 1 - ((x - lake.x) / lake.rx) ** 2))
    const bend = Math.sin((x - lake.x) / 170) * 100
    return {
      x: x * townLayoutScale,
      north: Math.round(((lake.z - reach * lake.rz + bend) * townLayoutScale) / 32) * 32,
      south: Math.round(((lake.z + reach * lake.rz + bend) * townLayoutScale) / 32) * 32
    }
  })
)

export function inTownLake(x: number, z: number, margin = 0) {
  return townLakeStrips.some(
    (strip) =>
      Math.abs(x - strip.x) <= 32 + margin && z >= strip.north - margin && z <= strip.south + margin
  )
}
