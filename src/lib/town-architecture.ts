import type { TownArchitecture } from './town-terrain'

// Material colors belong to the landscape; building variants keep their own silhouettes.
export const townArchitecture = {
  spring: {
    wall: 0xffe6da,
    trim: 0xfff4d9,
    roof: 0xaf6486,
    accent: 0x799e8b,
    timber: 0x996876,
    glass: 0x9dc9be
  },
  summer: {
    wall: 0xf5efd1,
    trim: 0xffffe9,
    roof: 0x388e83,
    accent: 0xe2a15d,
    timber: 0x70916c,
    glass: 0x8ed9d3
  },
  autumn: {
    wall: 0xe7bc84,
    trim: 0xffe1ad,
    roof: 0x985746,
    accent: 0xba714b,
    timber: 0x694d49,
    glass: 0xe7b870
  },
  winter: {
    wall: 0x889eaf,
    trim: 0xf3f6ff,
    roof: 0x647b9e,
    accent: 0x9a7585,
    timber: 0x52627d,
    glass: 0xffd796
  },
  tropical: {
    wall: 0xfff0ce,
    trim: 0xe2ffe9,
    roof: 0xc49b58,
    accent: 0x34a997,
    timber: 0x947047,
    glass: 0x79d4ce
  },
  desert: {
    wall: 0xe7b775,
    trim: 0xffdfa0,
    roof: 0xc58b61,
    accent: 0x448f88,
    timber: 0x99634f,
    glass: 0x80c6b6
  },
  crystal: {
    wall: 0xd5d2f1,
    trim: 0xeffaff,
    roof: 0x8677be,
    accent: 0x87dce8,
    timber: 0x6e6b9e,
    glass: 0xc0f4ff
  },
  mesa: {
    wall: 0xbe7965,
    trim: 0xf4c38d,
    roof: 0x925e60,
    accent: 0xdca273,
    timber: 0x775468,
    glass: 0xf5d89c
  },
  mushroom: {
    wall: 0xeee0bc,
    trim: 0xf5d3ef,
    roof: 0xa668ad,
    accent: 0x68a7a3,
    timber: 0x79668d,
    glass: 0xf8dca7
  }
} satisfies Record<
  TownArchitecture,
  {
    wall: number
    trim: number
    roof: number
    accent: number
    timber: number
    glass: number
  }
>
