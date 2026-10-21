import { hashSlug } from './scene-math'

// Each article picks one of these girls by hash; colors vary with the article identity.
// Hair, fringe, eyes and outfit are designed together so no two read alike. Every girl
// hides her eyes: behind a long fringe, glasses, goggles, a mask, a veil, a talisman, a
// visor, bandages, a headset, a hat brim, a hood or a helmet.
export const townPersonStyles = [
  { role: 'sailor', hair: 'long', bangs: 'curtain', eyes: 0, scale: 1 },
  { role: 'blazer', hair: 'bob', bangs: 'swept', eyes: 2, scale: 1 },
  { role: 'parka', hair: 'short', bangs: 'pointy', eyes: 3, scale: 0.94 },
  { role: 'maid', hair: 'twintails', bangs: 'split', eyes: 0, scale: 0.98 },
  { role: 'miko', hair: 'hime', bangs: 'blunt', eyes: 1, scale: 1 },
  { role: 'yukata', hair: 'buns', bangs: 'parted', eyes: 5, scale: 0.96 },
  { role: 'witch', hair: 'wavy', bangs: 'swept', eyes: 2, scale: 1 },
  { role: 'idol', hair: 'twintails', bangs: 'wispy', eyes: 4, scale: 0.98 },
  { role: 'nurse', hair: 'bob', bangs: 'sweep', eyes: 1, scale: 1 },
  { role: 'patissier', hair: 'ponytail', bangs: 'shaggy', eyes: 5, scale: 0.98 },
  { role: 'raincoat', hair: 'short', bangs: 'blunt', eyes: 0, scale: 0.9 },
  { role: 'cheer', hair: 'ponytail', bangs: 'pointy', eyes: 4, scale: 0.98 },
  { role: 'gothic', hair: 'drills', bangs: 'blunt', eyes: 2, scale: 0.98 },
  { role: 'overalls', hair: 'braids', bangs: 'wispy', eyes: 5, scale: 0.94 },
  { role: 'magical', hair: 'sidetail', bangs: 'pointy', eyes: 4, scale: 0.96 },
  { role: 'cardigan', hair: 'halfup', bangs: 'parted', eyes: 3, scale: 1 },
  { role: 'sporty', hair: 'short', bangs: 'swept', eyes: 2, scale: 1 },
  { role: 'artist', hair: 'bob', bangs: 'shaggy', eyes: 1, scale: 0.96 },
  { role: 'china', hair: 'buns', bangs: 'blunt', eyes: 0, scale: 0.98 },
  { role: 'princess', hair: 'wavy', bangs: 'parted', eyes: 0, scale: 1 },
  { role: 'catgirl', hair: 'bob', bangs: 'sweep', eyes: 2, scale: 0.96 },
  { role: 'bunny', hair: 'lowtails', bangs: 'wispy', eyes: 3, scale: 0.92 },
  { role: 'winter', hair: 'long', bangs: 'swept', eyes: 5, scale: 1 },
  { role: 'explorer', hair: 'braids', bangs: 'parted', eyes: 1, scale: 0.98 },
  { role: 'astronaut', hair: 'short', bangs: 'wispy', eyes: 1, scale: 0.98 },
  { role: 'jiangshi', hair: 'long', bangs: 'blunt', eyes: 3, scale: 0.96 },
  { role: 'cyborg', hair: 'bob', bangs: 'pointy', eyes: 4, scale: 0.98 },
  { role: 'steampunk', hair: 'wavy', bangs: 'blunt', eyes: 3, scale: 1 },
  { role: 'knight', hair: 'ponytail', bangs: 'blunt', eyes: 1, scale: 1 },
  { role: 'mummy', hair: 'lowtails', bangs: 'blunt', eyes: 2, scale: 0.94 },
  { role: 'pirate', hair: 'wavy', bangs: 'side', eyes: 2, scale: 0.98 },
  { role: 'fortune', hair: 'long', bangs: 'parted', eyes: 4, scale: 1 },
  { role: 'gamer', hair: 'twintails', bangs: 'pointy', eyes: 1, scale: 0.94 },
  { role: 'diver', hair: 'short', bangs: 'parted', eyes: 5, scale: 0.96 }
] as const

export type TownPersonStyle = (typeof townPersonStyles)[number]

export function townPersonStyle(variant: number) {
  return townPersonStyles[variant % townPersonStyles.length]
}

// Natural shades first, then pastel anime colors.
export const townHairColors = [
  0x3a2c3c, 0x6a4535, 0xa5653f, 0xe6be72, 0xf3dfae, 0xd8645a, 0xf2a6bd, 0xb79be3, 0x8ac6ea,
  0x93d3b6, 0xe9e7f2, 0x4a5a9c
] as const
const skinTones = [0xffe8db, 0xfde0cd, 0xf4cdb2, 0xdcab8a, 0xb98264] as const

export function townPersonAppearance(identity: string) {
  const choose = <T>(key: string, choices: readonly T[]) =>
    choices[(hashSlug(`${key}:${identity}`) >>> 8) % choices.length]
  return {
    hairColor: choose('hair', townHairColors),
    skin: choose('skin', skinTones),
    // Alternate outfit colorways, interpreted by each costume.
    tone: choose('tone', [0, 1, 2, 3] as const),
    ahoge: choose('ahoge', [false, false, true] as const),
    // The color of her lit trims, lenses and hair streak.
    neon: choose('neon', [0x5ef0e6, 0xff5ca8, 0x9cff5c, 0xffb84a, 0xb48aff, 0x5ea8ff] as const)
  }
}
