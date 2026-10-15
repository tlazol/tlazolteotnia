import { hashSlug } from './sticker-board'

// Stable order preserves the article-to-costume mapping. Each resident is designed
// as a girl; the role names are costume identifiers, not the old body designs.
export const townPersonStyles = [
  { role: 'cap-child', hair: 'bob', scale: 0.88, skirt: false, face: 0 },
  { role: 'dress-child', hair: 'twintails', scale: 0.88, skirt: true, face: 4 },
  { role: 'casual', hair: 'waves', scale: 1, skirt: false, face: 3 },
  { role: 'dress', hair: 'long', scale: 1, skirt: true, face: 1 },
  { role: 'hoodie', hair: 'short', scale: 0.96, skirt: false, face: 2 },
  { role: 'cardigan', hair: 'ponytail', scale: 1, skirt: true, face: 5 },
  { role: 'kindergartner', hair: 'braids', scale: 0.84, skirt: true, face: 3 },
  { role: 'schoolchild', hair: 'bob', scale: 0.9, skirt: true, face: 2 },
  { role: 'student', hair: 'long', scale: 0.96, skirt: true, face: 0 },
  { role: 'salaryman', hair: 'ponytail', scale: 1, skirt: false, face: 3 },
  { role: 'doctor', hair: 'braids', scale: 1, skirt: false, face: 5 },
  { role: 'office-lady', hair: 'bun', scale: 1, skirt: true, face: 1 },
  { role: 'magical-girl', hair: 'twintails', scale: 0.96, skirt: true, face: 4 },
  { role: 'chef', hair: 'bun', scale: 0.98, skirt: true, face: 3 },
  { role: 'firefighter', hair: 'ponytail', scale: 1, skirt: false, face: 0 },
  { role: 'police', hair: 'bob', scale: 1, skirt: true, face: 5 },
  { role: 'builder', hair: 'braids', scale: 0.98, skirt: false, face: 2 },
  { role: 'farmer', hair: 'twintails', scale: 0.96, skirt: false, face: 3 },
  { role: 'astronaut', hair: 'short', scale: 1, skirt: false, face: 0 },
  { role: 'alien', hair: 'bun', scale: 0.96, skirt: true, face: 4 },
  { role: 'nurse', hair: 'bob', scale: 1, skirt: true, face: 4 },
  { role: 'hero', hair: 'ponytail', scale: 1, skirt: true, face: 2 },
  { role: 'wizard', hair: 'waves', scale: 1, skirt: true, face: 5 },
  { role: 'witch', hair: 'long', scale: 1, skirt: true, face: 1 },
  { role: 'knight', hair: 'braids', scale: 1, skirt: true, face: 0 },
  { role: 'ninja', hair: 'ponytail', scale: 0.96, skirt: false, face: 5 },
  { role: 'pirate', hair: 'waves', scale: 1, skirt: true, face: 3 },
  { role: 'fairy', hair: 'twintails', scale: 0.88, skirt: true, face: 2 },
  { role: 'vampire', hair: 'long', scale: 1, skirt: true, face: 4 },
  { role: 'robot', hair: 'bob', scale: 1, skirt: true, face: 0 }
] as const

export function townPersonStyle(variant: number) {
  return townPersonStyles[variant % townPersonStyles.length]
}

type Costume = (typeof townPersonStyles)[number]
type Hair = Costume['hair'] | 'flipped-bob' | 'wolf' | 'curly-twintails' | 'sidetail'
type Headwear =
  | 'costume'
  | 'none'
  | 'casquette'
  | 'knit'
  | 'bucket'
  | 'beret'
  | 'goggles'
  | 'mirror'
  | 'visor'
  | 'knight'

const hairColors = [
  0x303a55, 0x815844, 0xb96b4c, 0xc4a37e, 0xe5ce94, 0xdce4ee, 0x8095b2, 0xb5a0d2, 0x76577e,
  0xbc829d, 0xe4afba, 0x91c3ae
] as const

const hairChoices: Record<Costume['hair'], readonly Hair[]> = {
  bob: ['bob', 'flipped-bob', 'wolf'],
  twintails: ['twintails', 'curly-twintails', 'sidetail'],
  waves: ['waves', 'wolf', 'curly-twintails'],
  long: ['long', 'waves', 'sidetail'],
  short: ['short', 'wolf', 'flipped-bob'],
  ponytail: ['ponytail', 'sidetail', 'wolf'],
  braids: ['braids', 'flipped-bob', 'long'],
  bun: ['bun', 'curly-twintails', 'sidetail']
}

// Costume hats stay recognizable. Optional headwear belongs only to everyday outfits.
const headwearChoices: Partial<Record<Costume['role'], readonly Headwear[]>> = {
  'dress-child': ['none', 'beret'],
  casual: ['casquette', 'bucket', 'beret'],
  dress: ['none', 'beret'],
  hoodie: ['knit', 'mirror'],
  cardigan: ['beret', 'knit', 'casquette'],
  student: ['none', 'beret'],
  salaryman: ['none', 'casquette'],
  doctor: ['goggles'],
  'office-lady': ['none', 'beret'],
  firefighter: ['goggles'],
  builder: ['goggles'],
  astronaut: ['visor'],
  knight: ['knight'],
  robot: ['visor']
}

export function townPersonAppearance(variant: number, identity: string) {
  const style = townPersonStyle(variant)
  const choose = <T>(key: string, choices: readonly T[]) =>
    choices[(hashSlug(`${key}:${identity}`) >>> 8) % choices.length]
  const headwear = choose('headwear', headwearChoices[style.role] ?? ['costume'])
  // Low ties and short cuts fit under hats; high buns and tails remain on bare heads.
  const hair = choose(
    'haircut',
    headwear === 'none' ||
      (headwear === 'costume' &&
        ['magical-girl', 'alien', 'hero', 'ninja', 'fairy', 'vampire'].includes(style.role))
      ? hairChoices[style.hair]
      : hairChoices[style.hair].filter(
          (hair) => !['bun', 'twintails', 'curly-twintails', 'ponytail'].includes(hair)
        )
  )
  return {
    hair,
    hairColor: choose('hair-color', hairColors),
    headwear,
    fringe: choose('fringe', [
      'straight',
      'swept',
      'round',
      'locks',
      'pointed',
      'curtain'
    ] as const),
    shortFringe: ['goggles', 'mirror', 'visor', 'knight'].includes(headwear)
  }
}
