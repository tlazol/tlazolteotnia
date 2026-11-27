import {
  createBuffer,
  hex,
  islandPalette,
  outline,
  type PixelBuffer,
  type Rgba,
  setPixel
} from './island-art'
import { tileHeight } from './island-relief'
import {
  BLACKSAND,
  BRICK,
  CLAY,
  CLOVER,
  COBBLE,
  DECK,
  DRYGRASS,
  decorAt,
  decorBlocksWalking,
  GRASS,
  GRAVEL,
  type Ground,
  groundAt,
  HOTSPRING,
  hash2,
  type IslandWorld,
  inBounds,
  isWalkable,
  isWetGround,
  LAVA,
  MOSS,
  MUD,
  nearestWalkable,
  PATH,
  ROCK,
  SAND,
  SHALLOWS,
  SOIL,
  STEPPING,
  SWAMP,
  TILE_SIZE,
  WATER,
  WHITESAND
} from './island-world'
import { hashSlug } from './scene-math'

// ---- Design ---------------------------------------------------------------

export const hairStyles = [
  'short',
  'bob',
  'long',
  'twintails',
  'ponytail',
  'buns',
  'spiky',
  'braid'
] as const
export const accessories = [
  'none',
  'cap',
  'strawHat',
  'beret',
  'ribbon',
  'flower',
  'catEars',
  'witchHat',
  'crown',
  'headphones',
  'goggles',
  'visor',
  'beanie',
  'hood',
  'sprout',
  'helmet'
] as const
export const outfits = [
  'dress',
  'skirt',
  'pants',
  'overalls',
  'coat',
  'kimono',
  'sailor',
  'hoodie',
  'apron',
  'riding'
] as const
export const hairColors = [
  '#3a2c3c',
  '#6a4535',
  '#a5653f',
  '#e3b867',
  '#f1dfae',
  '#d8645a',
  '#f2a6bd',
  '#a58be0',
  '#7fbfe6',
  '#86cdb0',
  '#e8e6f0',
  '#4a5a9c'
] as const
export const clothColors = [
  '#e0574f',
  '#f08a3c',
  '#f2c84b',
  '#7ac55a',
  '#3fa79a',
  '#4b8fd6',
  '#5b62c9',
  '#9a6bd6',
  '#e070a8',
  '#f4f0e6',
  '#4a4458',
  '#9b6a46'
] as const
const skinTones = ['#ffe3d1', '#fbd7bd', '#eebd98', '#d39a72', '#a8714f'] as const

export type ResidentDesign = {
  hair: (typeof hairStyles)[number]
  accessory: (typeof accessories)[number]
  outfit: (typeof outfits)[number]
  hairColor: string
  top: string
  bottom: string
  accent: string
  skin: string
  backpack?: boolean
}

// Hand-picked looks for the newest regulars.
const designOverrides: Record<string, Partial<ResidentDesign>> = {
  'anti-poem-skill': {
    hair: 'bob',
    accessory: 'beret',
    outfit: 'coat',
    hairColor: '#3a2c3c',
    top: '#f4f0e6',
    bottom: '#4a4458',
    accent: '#e0574f'
  },
  'gpt-sol-luna-coding-workflow': {
    hair: 'long',
    accessory: 'headphones',
    outfit: 'coat',
    hairColor: '#e8e6f0',
    top: '#f08a3c',
    bottom: '#4a5a9c',
    accent: '#7fbfe6'
  },
  'understanding-harnesses-again': {
    hair: 'ponytail',
    accessory: 'helmet',
    outfit: 'riding',
    hairColor: '#a5653f',
    top: '#2f6e5a',
    bottom: '#f4f0e6',
    accent: '#e3b867'
  },
  'skills-inventory': {
    hair: 'buns',
    accessory: 'visor',
    outfit: 'apron',
    hairColor: '#4a5a9c',
    top: '#f2c84b',
    bottom: '#f4f0e6',
    accent: '#e0574f'
  },
  'give-the-ai-precise-instructions': {
    hair: 'short',
    accessory: 'strawHat',
    outfit: 'pants',
    hairColor: '#3a2c3c',
    top: '#3fa79a',
    bottom: '#9b6a46',
    accent: '#f08a3c',
    backpack: true
  }
}

const signature = (d: Pick<ResidentDesign, 'hair' | 'accessory' | 'outfit'>) =>
  `${d.hair}/${d.accessory}/${d.outfit}`

// Every article gets its own look: no two residents share a silhouette
// (hair, headwear and outfit). Older posts claim their look first, so a new
// post never changes how existing residents appear.
export function designResidents(posts: Array<{ slug: string; date: string }>) {
  const designs = new Map<string, ResidentDesign>()
  const taken = new Set<string>()
  const oldestFirst = [...posts].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date) || a.slug.localeCompare(b.slug)
  )
  for (const override of Object.values(designOverrides))
    taken.add(signature(override as ResidentDesign))
  const total = hairStyles.length * accessories.length * outfits.length
  for (const { slug } of oldestFirst) {
    const seed = hashSlug(slug)
    const pick = <T>(key: string, list: readonly T[]) =>
      list[hashSlug(`${key}:${slug}`) % list.length]
    const override = designOverrides[slug]
    let code = seed % total
    let base: Pick<ResidentDesign, 'hair' | 'accessory' | 'outfit'>
    for (;;) {
      base = {
        hair: hairStyles[code % hairStyles.length],
        accessory: accessories[Math.floor(code / hairStyles.length) % accessories.length],
        outfit:
          outfits[Math.floor(code / (hairStyles.length * accessories.length)) % outfits.length]
      }
      if (override || !taken.has(signature(base))) break
      code = (code + 397) % total
    }
    const top = pick('top', clothColors)
    let bottom = pick('bottom', clothColors)
    if (bottom === top) bottom = clothColors[(clothColors.indexOf(top) + 5) % clothColors.length]
    const design: ResidentDesign = {
      ...base,
      hairColor: pick('hair', hairColors),
      top,
      bottom,
      accent: pick('accent', clothColors),
      skin: pick('skin', skinTones),
      ...override
    }
    taken.add(signature(design))
    designs.set(slug, design)
  }
  return designs
}

// ---- Sprites --------------------------------------------------------------

// Tiny two-head-tall residents drawn at 1:1 so every pixel stays crisp.
export const RESIDENT_FRAME = { width: 18, height: 19 } as const
export const RESIDENT_SCALE = 1
export const facings = ['down', 'up', 'side', 'downSide', 'upSide'] as const
export type Facing = (typeof facings)[number]

// Grid steps project onto eight screen directions. The three turned poses
// are drawn facing right; their left-facing counterparts share the same row.
export function residentPose(direction: { x: number; y: number }) {
  // Choose the closest of the eight sprite directions at any camera angle.
  const sectorSlope = Math.SQRT2 - 1 // tan(22.5°)
  const x = Math.abs(direction.x)
  const y = Math.abs(direction.y)
  let facing: Facing
  if (x <= y * sectorSlope) return { facing: direction.y < 0 ? 'up' : 'down', flip: false } as const
  if (y <= x * sectorSlope) facing = 'side'
  else facing = direction.y < 0 ? 'upSide' : 'downSide'
  return { facing, flip: direction.x < 0 }
}
// Columns: idle, left step, right step.
export const RESIDENT_FRAMES = 3

function shade(color: string, amount: number): Rgba {
  const [r, g, b] = hex(color)
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)))
  return [f(r), f(g), f(b), 255]
}

type Painter = {
  px: (x: number, y: number, color: Rgba) => void
  rect: (x: number, y: number, w: number, h: number, color: Rgba) => void
}

function painter(buffer: PixelBuffer, ox: number, oy: number): Painter {
  return {
    px: (x, y, color) => setPixel(buffer, ox + x, oy + y, color),
    rect: (x, y, w, h, color) => {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) setPixel(buffer, ox + x + i, oy + y + j, color)
    }
  }
}

export function paintConversationBubble() {
  const buffer = createBuffer(13, 10)
  const p = painter(buffer, 0, 0)
  const paper = hex('#fff6df')
  const ink = hex('#473943')
  p.rect(2, 1, 9, 6, paper)
  p.rect(1, 2, 11, 4, paper)
  p.rect(3, 7, 2, 1, paper)
  p.px(3, 8, paper)
  for (const x of [3, 6, 9]) p.px(x, 4, ink)
  outline(buffer, ink)
  return buffer
}

// Right hand, seen from above. The left hand mirrors this sprite.
const handSprite = [
  '      hhhh',
  '    hhHHhhh',
  '   hhHHHhhhhs',
  '   hhhhhhhhhs',
  '  hhhhhhhhhss',
  '  hhhshhhhsss',
  '   hhsssaaaaaa',
  '    aaAAAaaaaaa',
  '   aAAAaaaaaaaaa',
  '   aaaaaaaWaWaaad',
  '    aaaaaaaWaaadd',
  '    dddaaaaaadddt',
  '    TTTddddddttttt',
  '   TTTTTttttttttttd',
  '   TTTTtttttttttttdd',
  '   TTtttttttttttttdd',
  '    Ttttttttttttttddd'
] as const

export function paintResidentHand(design: ResidentDesign) {
  const buffer = createBuffer(24, 32)
  const p = painter(buffer, 0, 0)
  const colors: Record<string, Rgba> = {
    h: hex(design.skin),
    H: shade(design.skin, 0.25),
    s: shade(design.skin, -0.15),
    a: hex(design.accent),
    A: shade(design.accent, 0.32),
    W: hex('#fff2dc'),
    t: hex(design.top),
    T: shade(design.top, 0.22),
    d: shade(design.top, -0.23)
  }
  // Extend the sleeve past the frame throughout the walk cycle.
  p.rect(6, 20, 17, 12, colors.t)
  p.rect(20, 20, 3, 12, colors.d)
  handSprite.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ' ') p.px(x + 2, y + 4, colors[row[x]])
    }
  })
  outline(buffer, hex(islandPalette.outline))
  return buffer
}

// Art layout (16×17, inset by one pixel for the outline): headwear rows 0–3,
// head rows 3–11, body 12–14, shoes 15. Side frames face right.
const HEAD = { cx: 8, cy: 7.5, rx: 5.2, ry: 4.6 }
const inHead = (x: number, y: number) =>
  ((x + 0.5 - HEAD.cx) / HEAD.rx) ** 2 + ((y + 0.5 - HEAD.cy) / HEAD.ry) ** 2 <= 1

function paintBody(p: Painter, d: ResidentDesign, facing: Facing, step: number, bob: number) {
  const skin = hex(d.skin)
  const top = hex(d.top)
  const topDark = shade(d.top, -0.25)
  const bottom = hex(d.bottom)
  const bottomDark = shade(d.bottom, -0.25)
  const accent = hex(d.accent)
  const shoe = hex(d.outfit === 'riding' ? '#2b2236' : '#5a3b32')
  const sock = d.outfit === 'riding' ? shoe : skin
  const side = facing === 'side'
  const diagonal = facing === 'downSide' || facing === 'upSide'
  const front = facing === 'down' || facing === 'downSide'
  const back = facing === 'up' || facing === 'upSide'
  const frontShift = diagonal ? 1 : 0
  const y0 = 12 - bob
  const left = side ? 6 : 5
  const width = side ? 4 : diagonal ? 5 : 6
  const right = left + width - 1

  // Feet stay planted; a step lifts one of them.
  const feet = side ? [6, 8] : diagonal ? [5, 8] : [5, 9]
  feet.forEach((fx, i) => {
    const lifted = step !== 0 && step - 1 === i
    const x = (side || diagonal) && step ? fx + (i === 0 ? -1 : 1) * (step === 1 ? 1 : -1) : fx
    if (lifted) p.rect(x, 14, 2, 1, shoe)
    else {
      p.rect(x, 14, 2, 1, sock)
      p.rect(x, 15, 2, 1, shoe)
    }
  })

  // Torso: a little three-row bean.
  const skirt = d.outfit === 'dress' || d.outfit === 'skirt' || d.outfit === 'sailor'
  const long = d.outfit === 'coat' || d.outfit === 'kimono' || d.outfit === 'riding'
  const body = d.outfit === 'sailor' ? hex('#f4f0e6') : top
  p.rect(left, y0, width, 3, body)
  p.rect(right, y0, 1, 3, d.outfit === 'sailor' ? hex('#d9d2c4') : topDark)
  if (skirt) {
    const color = d.outfit === 'dress' ? top : bottom
    p.rect(left - 1, y0 + 2, width + 2, 1, color)
    p.px(right + 1, y0 + 2, d.outfit === 'dress' ? topDark : bottomDark)
  } else if (!long) {
    p.rect(left, y0 + 2, width, 1, bottom)
    p.px(right, y0 + 2, bottomDark)
  }
  switch (d.outfit) {
    case 'overalls':
      p.rect(left, y0 + 1, width, 2, bottom)
      p.px(left + 1, y0, bottom)
      if (!side) p.px(right - 1, y0, bottom)
      break
    case 'sailor':
      p.rect(left, y0, width, 1, top)
      if (front) p.rect(7 + frontShift, y0 + 1, 2, 1, accent)
      if (back) p.rect(left, y0 + 1, width, 1, top)
      break
    case 'kimono':
      p.rect(left, y0 + 1, width, 1, accent)
      if (front) p.px(7 + frontShift, y0, topDark)
      break
    case 'apron':
      if (front) p.rect(6 + frontShift, y0 + 1, 4 - frontShift, 2, bottom)
      else if (side) p.rect(right - 1, y0 + 1, 2, 2, bottom)
      break
    case 'coat':
      if (front) p.px(7 + frontShift, y0 + 1, accent)
      break
    case 'hoodie':
      if (front) p.rect(6, y0 + 2, 4, 1, topDark)
      break
    case 'riding':
      p.rect(left, y0 + 1, width, 1, hex('#2b2236'))
      p.rect(left, y0 + 2, width, 1, bottom)
      break
  }

  // Stubby arms swing opposite the feet.
  const swing = step === 1 ? 1 : step === 2 ? -1 : 0
  if (diagonal) {
    // On a three-quarter turn the nearer sleeve overlaps the torso.
    const near = back ? right : left
    const far = back ? left - 1 : right + 1
    p.px(far, y0, topDark)
    p.px(far, y0 + 1, skin)
    p.px(near + swing, y0 + 1, top)
    p.px(near + swing, y0 + 2, skin)
  } else if (side) {
    p.px(7 + swing, y0, topDark)
    p.px(7 + swing, y0 + 1, skin)
  } else {
    p.px(left - 1, y0, top)
    p.px(left - 1, y0 + 1 + Math.max(0, swing), skin)
    p.px(right + 1, y0, topDark)
    p.px(right + 1, y0 + 1 + Math.max(0, -swing), skin)
  }

  if (d.backpack) {
    const pack = hex('#c0743c')
    const packDark = hex('#8f5230')
    if (back) {
      const packX = diagonal ? 4 : 6
      p.rect(packX, y0, 4, 3, pack)
      p.rect(packX, y0 + 2, 4, 1, packDark)
    } else if (side) {
      p.rect(left - 2, y0, 2, 3, pack)
      p.px(left - 2, y0 + 2, packDark)
    } else {
      p.px(left + 1, y0, packDark)
      p.px(right - 1, y0, packDark)
    }
  }
}

function paintHead(p: Painter, d: ResidentDesign, facing: Facing, bob: number) {
  const skin = hex(d.skin)
  const hair = hex(d.hairColor)
  const hairDark = shade(d.hairColor, -0.22)
  const hairLight = shade(d.hairColor, 0.35)
  const dy = -bob
  const side = facing === 'side'
  const diagonal = facing === 'downSide' || facing === 'upSide'
  const back = facing === 'up' || facing === 'upSide'
  const hood = d.accessory === 'hood'
  const main = hood ? hex(d.top) : hair
  const dark = hood ? shade(d.top, -0.25) : hairDark
  const behind = (x: number, y: number, w: number, h: number) => p.rect(x, y + dy, w, h, dark)

  // Hair that hangs behind the head.
  if (!hood) {
    switch (d.hair) {
      case 'long':
        if (facing === 'upSide') behind(2, 7, 9, 7)
        else if (facing === 'downSide') {
          behind(2, 7, 4, 7)
          behind(11, 8, 2, 5)
        } else if (back) behind(3, 7, 10, 7)
        else if (side) behind(3, 7, 4, 7)
        else {
          behind(2, 7, 2, 7)
          behind(12, 7, 2, 7)
        }
        break
      case 'twintails':
        if (diagonal) {
          behind(1, 6, 3, 6)
          behind(12, 5, 2, 4)
        } else if (side) behind(1, 6, 2, 5)
        else {
          behind(0, 6, 2, 5)
          behind(14, 6, 2, 5)
        }
        break
      case 'ponytail':
        if (diagonal) behind(back ? 4 : 2, 6, 3, 7)
        else if (back) behind(7, 10, 2, 4)
        else if (side) behind(1, 5, 2, 5)
        break
      case 'braid':
        if (diagonal) {
          behind(4, 9, 2, 3)
          behind(3, 12, 2, 2)
          p.px(4, 14 + dy, hex(d.accent))
        } else if (back) behind(7, 10, 2, 5)
        else if (side) behind(3, 10, 2, 4)
        break
      case 'bob':
        if (diagonal) behind(2, 6, 4, 6)
        else if (side) behind(3, 7, 4, 4)
        else {
          behind(2, 6, 2, 5)
          behind(12, 6, 2, 5)
        }
        break
    }
  }

  // Head and face.
  for (let y = 2; y <= 12; y++)
    for (let x = 2; x <= 13; x++) if (inHead(x, y)) p.px(x, y + dy, skin)
  const fringe = (x: number) => {
    switch (d.hair) {
      case 'spiky':
        return 6 + ((x * 3) % 4 === 0 ? 1 : 0)
      case 'short':
        return 5 + (x % 3 === 0 ? 1 : 0)
      case 'bob':
      case 'buns':
        return 6
      default:
        return 6 + (x % 4 === 1 ? 1 : 0)
    }
  }
  for (let y = 2; y <= 12; y++) {
    for (let x = 2; x <= 13; x++) {
      if (!inHead(x, y)) continue
      let covered: boolean
      if (facing === 'upSide') covered = x < 11 || y < 7 || (x === 11 && y < 9)
      else if (facing === 'downSide') covered = y < fringe(x - 1) || x < 5 || (x === 5 && y < 9)
      else if (back) covered = true
      else if (side) covered = y < fringe(x) || x < 7 || (x < 9 && y < 8)
      else covered = y < fringe(x) || x <= 3 || x >= 12 || ((x === 4 || x === 11) && y < 9)
      if (hood && !back && !side)
        covered ||= y < 6 || x <= (diagonal ? 5 : 4) || x >= (diagonal ? 13 : 11)
      if (!covered) continue
      p.px(x, y + dy, x >= 11 || y >= 10 ? dark : main)
    }
  }
  if (!hood) {
    // A shine on the hair for volume.
    if (back) p.rect(7, 4 + dy, 2, 1, hairLight)
    else p.rect(5, 4 + dy, 2, 1, hairLight)
    if (d.hair === 'spiky') {
      for (const x of [5, 8, 10]) p.px(x, 2 + dy, hair)
      p.px(2, 6 + dy, hair)
      p.px(13, 6 + dy, hair)
    }
    if (d.hair === 'buns')
      for (const x of side ? [5] : diagonal ? [3, 10] : [3, 11]) {
        p.rect(x, 1 + dy, 2, 2, hair)
        p.px(x + 1, 2 + dy, hairDark)
      }
    if (d.hair === 'braid' && facing === 'down') {
      p.rect(11, 10 + dy, 1, 4, hairDark)
      p.px(11, 14 + dy, hex(d.accent))
    }
    if (d.hair === 'ponytail' && facing === 'down') p.rect(7, 2 + dy, 2, 1, hex(d.accent))
  }

  // Dot eyes and rosy cheeks.
  const eye = hex('#2b2236')
  const blush = hex('#f29a9a')
  if (facing === 'down') {
    for (const x of [5, 10]) p.rect(x, 8 + dy, 1, 2, eye)
    p.px(4, 10 + dy, blush)
    p.px(11, 10 + dy, blush)
  } else if (facing === 'downSide') {
    for (const x of [7, 11]) p.rect(x, 8 + dy, 1, 2, eye)
    p.px(6, 10 + dy, blush)
  } else if (side) {
    p.rect(10, 8 + dy, 1, 2, eye)
    p.px(11, 10 + dy, blush)
  }
  paintAccessory(p, d, facing, dy)
}

function paintAccessory(p: Painter, d: ResidentDesign, facing: Facing, dy: number) {
  const accent = hex(d.accent)
  const accentDark = shade(d.accent, -0.3)
  const side = facing === 'side'
  const diagonal = facing === 'downSide' || facing === 'upSide'
  const front = facing === 'down' || facing === 'downSide'
  const offset = facing === 'downSide' ? 2 : 0
  const r = (x: number, y: number, w: number, h: number, color: Rgba) =>
    p.rect(x, y + dy, w, h, color)
  switch (d.accessory) {
    case 'cap':
      r(5, 2, 6, 1, accent)
      r(4, 3, 8, 2, accent)
      if (front) r(4 + offset, 5, 8, 1, accentDark)
      if (facing === 'upSide') r(11, 4, 3, 1, accentDark)
      if (side) r(10, 5, 4, 1, accentDark)
      break
    case 'strawHat': {
      const straw = hex('#f1d27a')
      r(5, 1, 6, 3, straw)
      r(5, 3, 6, 1, accent)
      r(2, 4, 12, 1, straw)
      r(2, 5, 12, 1, hex('#c9a24f'))
      break
    }
    case 'beret':
      r(4, 2, 8, 2, accent)
      r(3, 3, 9, 1, accentDark)
      r(8, 1, 1, 1, accentDark)
      break
    case 'ribbon': {
      const x = side ? 4 : diagonal ? 7 : 10
      r(x, 2, 2, 2, accent)
      r(x + 3, 2, 2, 2, accent)
      r(x + 2, 3, 1, 1, accentDark)
      break
    }
    case 'flower': {
      const petal = hex('#fff6e8')
      const fx = side ? 5 : diagonal ? 8 : 11
      r(fx, 2, 1, 1, petal)
      r(fx - 1, 3, 1, 1, petal)
      r(fx + 1, 3, 1, 1, petal)
      r(fx, 4, 1, 1, petal)
      r(fx, 3, 1, 1, hex('#ffcf3f'))
      break
    }
    case 'catEars': {
      const fur = hex(d.hairColor)
      for (const x of side ? [5] : diagonal ? [4, 10] : [3, 11]) {
        r(x, 2, 2, 2, fur)
        r(x + (x < 8 ? 0 : 1), 1, 1, 1, fur)
        if (front) r(x + (x < 8 ? 1 : 0), 3, 1, 1, hex('#f6a5b8'))
      }
      break
    }
    case 'witchHat': {
      const hat = hex('#3d3357')
      r(2, 5, 12, 1, hat)
      r(4, 3, 8, 2, hat)
      r(4, 4, 8, 1, accent)
      r(5, 2, 6, 1, hat)
      r(6, 1, 4, 1, hat)
      r(8, 0, 3, 1, hat)
      break
    }
    case 'crown': {
      const gold = hex('#f2c94c')
      r(5, 2, 6, 2, gold)
      for (const x of [5, 7, 8, 10]) r(x, 1, 1, 1, gold)
      if (facing !== 'upSide') r(7 + offset, 3, 2, 1, hex('#e0574f'))
      break
    }
    case 'headphones':
      r(4, 2, 8, 1, hex('#4a4458'))
      if (diagonal) {
        r(facing === 'upSide' ? 9 : 4, 6, 3, 3, accent)
      } else if (side) r(7, 6, 2, 3, accent)
      else {
        r(2, 6, 2, 3, accent)
        r(12, 6, 2, 3, accent)
      }
      break
    case 'goggles':
      r(3, 5, 10, 1, hex('#4a4458'))
      if (front) {
        for (const x of [5 + offset, 9 + offset]) {
          r(x, 4, 2, 2, accent)
          r(x, 4, 1, 1, hex('#ffffff'))
        }
      } else if (side) r(10, 4, 2, 2, accent)
      break
    case 'visor': {
      // A one-piece cyber visor: a glowing band across both eyes.
      const frame = hex('#2b2236')
      const glow = hex('#63f3ff')
      const glowDeep = hex('#1fa9d6')
      if (front) {
        r(3 + offset, 8, 10 - offset, 2, frame)
        r(4 + offset, 8, 8 - offset, 1, glow)
        r(4 + offset, 9, 8 - offset, 1, glowDeep)
        r(5 + offset, 8, 2, 1, hex('#ffffff'))
        r(10 + offset, 9, 1, 1, glow)
      } else if (side) {
        r(7, 8, 6, 2, frame)
        r(9, 8, 4, 1, glow)
        r(9, 9, 4, 1, glowDeep)
        r(10, 8, 1, 1, hex('#ffffff'))
      } else r(3, 8, 10, 1, frame)
      break
    }
    case 'beanie':
      r(4, 2, 8, 3, accent)
      r(3, 5, 10, 1, accentDark)
      r(7, 1, 2, 1, hex('#f4f0e6'))
      break
    case 'hood':
      r(5, 2, 6, 1, hex(d.top))
      break
    case 'sprout': {
      const leaf = hex('#6cc04f')
      r(8, 1, 1, 2, hex('#3f8a3d'))
      r(6, 0, 2, 1, leaf)
      r(9, 0, 2, 1, leaf)
      break
    }
    case 'helmet': {
      const shell = hex('#2b2236')
      r(5, 2, 6, 1, shell)
      r(4, 3, 8, 3, shell)
      r(6, 3, 2, 1, hex('#5a4f75'))
      r(8, 2, 1, 1, accent)
      if (front) r(4 + offset, 6, 8, 1, shell)
      if (facing === 'upSide') r(11, 5, 3, 1, shell)
      if (side) r(10, 5, 4, 1, shell)
      break
    }
    case 'none':
      break
  }
}

// One sheet per resident: rows are poses, columns are idle and the two steps.
export function paintResidentSheet(design: ResidentDesign, swimming = false) {
  const { width, height } = RESIDENT_FRAME
  const sheet = createBuffer(width * RESIDENT_FRAMES, height * facings.length)
  facings.forEach((facing, row) => {
    for (let frame = 0; frame < RESIDENT_FRAMES; frame++) {
      const cell = createBuffer(width, height)
      const p = painter(cell, 1, 1)
      const bob = frame === 0 ? 0 : 1
      paintBody(p, design, facing, frame, bob)
      paintHead(p, design, facing, bob)
      if (swimming) {
        // Submerge the body; the head bobs above paddling hands.
        cell.data.fill(0)
        const waterPainter = painter(cell, 1, 4)
        paintHead(waterPainter, design, facing, bob)
        for (let y = 15; y < height; y++) cell.data.fill(0, y * width * 4, (y + 1) * width * 4)
        p.rect(frame === 1 ? 1 : 2, 13, 2, 1, hex(design.skin))
        p.rect(frame === 2 ? 13 : 12, 13, 2, 1, hex(design.skin))
      }
      outline(cell, hex('#2b2236'))
      if (swimming) {
        p.rect(3, 15, 10, 1, hex('#b5f4f5'))
        p.px(frame === 1 ? 0 : 1, 14, hex('#ffffff'))
        p.px(frame === 2 ? 15 : 14, 14, hex('#ffffff'))
        p.rect(frame === 1 ? 5 : 7, 16, 4, 1, hex('#67cbdc'))
      }
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          if (!cell.data[i + 3]) continue
          setPixel(sheet, frame * width + x, row * height + y, [
            cell.data[i],
            cell.data[i + 1],
            cell.data[i + 2],
            cell.data[i + 3]
          ])
        }
    }
  })
  return sheet
}

// ---- Movement -------------------------------------------------------------

export type Resident = {
  slug: string
  home: { x: number; y: number }
  tile: { x: number; y: number }
  target: { x: number; y: number } | null
  route: Array<{ x: number; y: number }>
  // Foot position in art pixels.
  x: number
  y: number
  heading: { x: number; y: number }
  frame: number
  wait: number
  walkClock: number
  speed: number
  action: 'walk' | 'idle' | 'dance' | 'jump' | 'fish'
  actionClock: number
  actionRemaining: number
  offsetX: number
  offsetY: number
  tilt: number
  seed: number
}

function chooseAction(
  random: () => number,
  current?: Resident['action'],
  canFish = false
): Resident['action'] {
  if (current === 'fish') return 'walk'
  const roll = random()
  // Dancing and jumping are rare treats: 2% each on arrival and on each activity change.
  if (roll < 0.02) return current === 'dance' ? 'walk' : 'dance'
  if (roll < 0.04) return current === 'jump' ? 'walk' : 'jump'
  // Otherwise residents mostly walk, stopping for a breather between strolls.
  if (current === 'walk') return canFish && roll < 0.34 ? 'fish' : 'idle'
  if (current === 'idle') return 'walk'
  return roll < 0.85 ? 'walk' : 'idle'
}

// Long strolls, brief stops and short bursts of hopping; dances last a while.
function actionDuration(action: Resident['action'], random: () => number) {
  if (action === 'walk') return 10 + random() * 20
  if (action === 'idle') return 2 + random() * 3
  if (action === 'jump') return 2.8 + random() * 2.8
  if (action === 'fish') return 8 + random() * 8
  return 6 + random() * 14
}

// Slow stroll, regular walk and brisk walk, in art pixels per second.
const WALK_SPEEDS = [14, 21, 28] as const

export const footOf = (tile: { x: number; y: number }) => ({
  x: (tile.x + 0.5) * TILE_SIZE,
  y: (tile.y + 0.5) * TILE_SIZE
})

export function residentFootHeight(world: IslandWorld, resident: Resident) {
  const { tile, target } = resident
  const start = tileHeight(world, tile.x, tile.y)
  if (!target) return start
  const end = tileHeight(world, target.x, target.y)
  // On a diagonal the feet pass over the shared corner of four terraces.
  let ledge = Math.max(start, end)
  if (tile.x !== target.x && tile.y !== target.y)
    ledge = Math.max(
      ledge,
      tileHeight(world, tile.x, target.y),
      tileHeight(world, target.x, tile.y)
    )
  if (start === end && start === ledge) return start

  const origin = footOf(tile)
  const progress =
    Math.max(Math.abs(resident.x - origin.x), Math.abs(resident.y - origin.y)) / TILE_SIZE
  // Clear the wall a shoe-width before the center crosses it, in either direction.
  const t = Math.min(1, 4 * Math.min(progress, 1 - progress))
  const floor = progress < 0.5 ? start : end
  return floor + (ledge - floor) * t * t * (3 - 2 * t)
}

export function createResidents(
  slugs: string[],
  homes: Array<{ x: number; y: number }>,
  random = Math.random
) {
  return slugs.map<Resident>((slug, i) => {
    const home = homes[i] ?? homes[0] ?? { x: 0, y: 0 }
    const foot = footOf(home)
    const action = chooseAction(random)
    return {
      slug,
      home: { ...home },
      tile: { ...home },
      target: null,
      route: [],
      ...foot,
      heading: { x: 1, y: 1 },
      frame: 0,
      wait: hash2(i, 3, 5) * 2,
      walkClock: 0,
      speed: WALK_SPEEDS[hashSlug(`walk:${slug}`) % WALK_SPEEDS.length],
      action,
      actionClock: random() * 2,
      actionRemaining: actionDuration(action, random),
      offsetX: 0,
      offsetY: 0,
      tilt: 0,
      seed: hashSlug(slug)
    }
  })
}

export function residentOccupies(resident: Resident, x: number, y: number) {
  return (
    (resident.tile.x === x && resident.tile.y === y) ||
    (resident.target?.x === x && resident.target?.y === y)
  )
}

export function canResidentEnter(world: IslandWorld, x: number, y: number) {
  return inBounds(world, x, y) && !decorBlocksWalking(decorAt(world, x, y))
}

const cardinalSteps = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1]
] as const
const neighborSteps = [...cardinalSteps, [1, 1], [-1, 1], [-1, -1], [1, -1]] as const

// Cast from a bank, pier or shallow into the next open water tile.
function canCast(world: IslandWorld, resident: Resident, dx: number, dy: number) {
  const { x, y } = resident.tile
  const bank = groundAt(world, x, y)
  if ((isWetGround(bank) && bank !== SHALLOWS) || tileHeight(world, x, y) < 0) return false
  const water = groundAt(world, x + dx, y + dy)
  return (water === WATER || water === SHALLOWS) && canResidentEnter(world, x + dx, y + dy)
}

// A diagonal needs clearance on both sides of the corner it crosses.
function canStep(
  x: number,
  y: number,
  nx: number,
  ny: number,
  open: (x: number, y: number) => boolean
) {
  return open(nx, ny) && (nx === x || ny === y || (open(nx, y) && open(x, ny)))
}

// The sea, lakes and springs alike are for swimming in.
const isWet = isWetGround

export function residentIsSwimming(world: IslandWorld, resident: Resident) {
  return residentFootHeight(world, resident) === 0
}

type Greeting = { first: Resident; second: Resident; elapsed: number; speaker: Resident | null }

function faces(resident: Resident, dx: number, dy: number) {
  const { x, y } = resident.heading
  const forward = x * dx + y * dy
  return forward > 0 && Math.abs(x * dy - y * dx) <= forward
}

export function createResidentGreetings(world: IslandWorld, residents: Resident[]) {
  const byResident = new Map<string, Greeting>()
  const greeted = new Set<number>()
  const previous = residents.map(({ x, y }) => ({ x, y }))
  let untilScan = 0
  const canGreet = (r: Resident) => r.action === 'walk' || r.action === 'idle'
  const sameLevel = (a: Resident, b: Resident) =>
    Math.abs(residentFootHeight(world, a) - residentFootHeight(world, b)) < TILE_SIZE / 2
  const reach = (1.8 * TILE_SIZE) ** 2
  const apart = (2.5 * TILE_SIZE) ** 2

  function step(dt: number, available: (resident: Resident) => boolean) {
    for (const [slug, greeting] of byResident) {
      const { first, second } = greeting
      if (slug !== first.slug) continue
      greeting.elapsed += dt
      if (
        greeting.elapsed >= 2 ||
        !available(first) ||
        !available(second) ||
        (first.x - second.x) ** 2 + (first.y - second.y) ** 2 > reach ||
        !sameLevel(first, second)
      ) {
        byResident.delete(first.slug)
        byResident.delete(second.slug)
      } else {
        greeting.speaker = greeting.elapsed < 0.9 ? first : greeting.elapsed >= 1.1 ? second : null
      }
    }

    untilScan -= dt
    if (untilScan > 0) return
    untilScan = 0.15
    const free = residents.map((r) => canGreet(r) && available(r) && !byResident.has(r.slug))
    for (let i = 0; i < residents.length; i++) {
      const first = residents[i]
      for (let j = i + 1; j < residents.length; j++) {
        const second = residents[j]
        const dx = second.x - first.x
        const dy = second.y - first.y
        const distanceSq = dx * dx + dy * dy
        const key = i * residents.length + j
        // Passing the edge of speaking distance briefly is still the same encounter.
        if (distanceSq > apart) greeted.delete(key)
        if (distanceSq > reach || !free[i] || !free[j] || greeted.has(key)) continue
        const oldDx = previous[j].x - previous[i].x
        const oldDy = previous[j].y - previous[i].y
        const approaching = distanceSq < oldDx * oldDx + oldDy * oldDy - 0.01
        if (!approaching && !(faces(first, dx, dy) && faces(second, -dx, -dy))) continue
        if (!sameLevel(first, second)) continue
        const greeting: Greeting = { first, second, elapsed: 0, speaker: first }
        byResident.set(first.slug, greeting)
        byResident.set(second.slug, greeting)
        free[i] = free[j] = false
        greeted.add(key)
      }
      previous[i].x = first.x
      previous[i].y = first.y
    }
  }
  return { byResident, step }
}

export function dropResident(
  world: IslandWorld,
  residents: Resident[],
  resident: Resident,
  point: { x: number; y: number }
) {
  const tile = { x: Math.floor(point.x / TILE_SIZE), y: Math.floor(point.y / TILE_SIZE) }
  if (
    !canResidentEnter(world, tile.x, tile.y) ||
    residents.some((other) => other !== resident && residentOccupies(other, tile.x, tile.y))
  )
    return false
  if (resident.action === 'fish') takeOverResident(resident)
  Object.assign(resident, footOf(tile), { tile, target: null, route: [], frame: 0, wait: 0.6 })
  return true
}

// Residents like firm footing: trails and paving first, then boards and
// stepping stones, grass, bare ground and, last of all, mud and water. A route pays
// `cost` for each tile it steps onto, so a trail is worth a modest detour but
// never a long way round. Where journeys end: around the spot a journey aims
// for (see aimJourney), a footing is picked by `odds`, then a tile on it.
const FOOTINGS = [
  { cost: 4, odds: 34 },
  { cost: 5, odds: 20 },
  { cost: 7, odds: 22 },
  { cost: 9, odds: 16 },
  { cost: 16, odds: 8 }
] as const
// Grounds that share a footing are equally welcome underfoot.
const FOOTING: Record<Ground, number> = {
  [PATH]: 0,
  [COBBLE]: 0,
  [BRICK]: 0,
  [DECK]: 1,
  [STEPPING]: 1,
  [GRASS]: 2,
  [MOSS]: 2,
  [DRYGRASS]: 2,
  [CLOVER]: 2,
  [SAND]: 3,
  [WHITESAND]: 3,
  [BLACKSAND]: 3,
  [SOIL]: 3,
  [CLAY]: 3,
  [GRAVEL]: 3,
  [ROCK]: 3,
  [LAVA]: 3,
  [MUD]: 4,
  [SWAMP]: 4,
  [SHALLOWS]: 4,
  [HOTSPRING]: 4,
  [WATER]: 4
}
// Swimmers paddle about the shallows instead of heading for open water.
const MAX_STROKES_FROM_SHORE = 3
// Journeys head for a dry spot drawn evenly from land within MAX_TRIP tiles,
// picked as the least crowded of AIM_CANDIDATES, and end on the best footing
// within AIM_RADIUS of it. Many short trips roam the whole island without
// funnelling everyone across the middle, and trails win only locally instead of
// drawing everyone to the paved plaza.
const MAX_TRIP = 20
// Most trips stay on dry land; now and then one swims over to another shore.
const CROSSING_ODDS = 0.1
const AIM_CANDIDATES = 5
const AIM_RADIUS = 3
// How near another resident, or where one is heading, counts towards a crowd.
const CROWD_RADIUS = 6

const chebyshev = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by))

// Narrows each footing's destinations to the dry tiles around the chosen aim.
function aimJourney(
  world: IslandWorld,
  residents: Resident[],
  resident: Resident,
  destinations: number[][],
  swims: Uint8Array,
  decision: number
) {
  const { columns } = world
  const crossing = hash2(resident.seed & 0xffff, decision, 6) < CROSSING_ODDS
  const ashore = destinations.flat().filter((index) => !isWet(world.ground[index] as Ground))
  const landward = ashore.filter((index) => !swims[index])
  const dry = !crossing && landward.length ? landward : ashore
  const nearby = dry.filter(
    (index) =>
      Math.hypot(
        (index % columns) - resident.tile.x,
        Math.floor(index / columns) - resident.tile.y
      ) <= MAX_TRIP
  )
  const aims = nearby.length ? nearby : dry
  if (!aims.length) return destinations
  const crowd: Array<{ x: number; y: number }> = []
  for (const other of residents) {
    if (other === resident) continue
    crowd.push(other.tile)
    const goal = other.route[other.route.length - 1]
    if (goal) crowd.push(goal)
  }
  let aim = aims[0]
  let fewest = Number.POSITIVE_INFINITY
  for (let k = 0; k < AIM_CANDIDATES; k++) {
    const index = aims[Math.floor(hash2(resident.seed & 0xffff, decision * 8 + k, 5) * aims.length)]
    const x = index % columns
    const y = Math.floor(index / columns)
    const count = crowd.filter((spot) => chebyshev(spot.x, spot.y, x, y) <= CROWD_RADIUS).length
    if (count < fewest) {
      fewest = count
      aim = index
    }
  }
  const ax = aim % columns
  const ay = Math.floor(aim / columns)
  // Nobody makes for the water; swimming only happens on the way across it.
  return destinations.map((tiles) =>
    tiles.filter(
      (index) =>
        !isWet(world.ground[index] as Ground) &&
        chebyshev(index % columns, Math.floor(index / columns), ax, ay) <= AIM_RADIUS
    )
  )
}

// A journey crosses the island along the most comfortable route, around
// trees, rocks and other residents.
function planJourney(world: IslandWorld, residents: Resident[], resident: Resident) {
  const start = resident.tile.y * world.columns + resident.tile.x
  const previous = new Int32Array(world.ground.length).fill(-1)
  const cost = new Float64Array(world.ground.length).fill(Number.POSITIVE_INFINITY)
  const strokes = new Uint8Array(world.ground.length)
  // Whether the route to each tile swims at all, however short the swim.
  const swims = new Uint8Array(world.ground.length)
  // Each tile is checked from several neighbors. Decode its passability once per search.
  const passable = world.decor.map((code) => (decorBlocksWalking(code) ? 0 : 1))
  for (const other of residents) {
    if (other === resident) continue
    passable[other.tile.y * world.columns + other.tile.x] = 0
    if (other.target) passable[other.target.y * world.columns + other.target.x] = 0
  }
  const tileOpen = (x: number, y: number) =>
    inBounds(world, x, y) && passable[y * world.columns + x] === 1
  // Cheapest-first search; step costs are whole numbers, so tiles queue by total cost.
  const queues: number[][] = [[start]]
  const reached: number[] = []
  // Candidate destinations, listed per footing.
  const destinations: number[][] = FOOTINGS.map(() => [])
  previous[start] = start
  cost[start] = 0
  for (let total = 0; total < queues.length; total++) {
    for (const index of queues[total] ?? []) {
      if (cost[index] !== total) continue
      const x = index % world.columns
      const y = Math.floor(index / world.columns)
      const ground = groundAt(world, x, y)
      if (index !== start) reached.push(index)
      if (
        Math.hypot(x - resident.tile.x, y - resident.tile.y) >= 8 &&
        (!isWet(ground) || strokes[index] <= MAX_STROKES_FROM_SHORE)
      )
        destinations[FOOTING[ground]].push(index)
      for (const [dx, dy] of neighborSteps) {
        const nx = x + dx
        const ny = y + dy
        const next = ny * world.columns + nx
        if (!canStep(x, y, nx, ny, tileOpen)) continue
        const nextGround = world.ground[next] as Ground
        const footing = FOOTINGS[FOOTING[nextGround]].cost
        const nextCost = total + (dx && dy ? Math.round(footing * Math.SQRT2) : footing)
        if (nextCost >= cost[next]) continue
        cost[next] = nextCost
        previous[next] = index
        strokes[next] = isWet(nextGround) ? Math.min(255, strokes[index] + 1) : 0
        swims[next] = swims[index] | (isWet(nextGround) ? 1 : 0)
        if (!queues[nextCost]) queues[nextCost] = []
        queues[nextCost].push(next)
      }
    }
  }
  const decision = performanceSeed(resident)
  let choices = reached
  const near = aimJourney(world, residents, resident, destinations, swims, decision)
  const open = FOOTINGS.map((footing, i) => ({ ...footing, tiles: near[i] })).filter(
    (footing) => footing.tiles.length
  )
  let pick =
    hash2(resident.seed & 0xffff, decision, 4) * open.reduce((sum, { odds }) => sum + odds, 0)
  for (const footing of open) {
    choices = footing.tiles
    pick -= footing.odds
    if (pick < 0) break
  }
  if (!choices.length) return []
  let end = choices[Math.floor(hash2(resident.seed & 0xffff, decision, 3) * choices.length)]
  const route = []
  while (end !== start) {
    route.push({ x: end % world.columns, y: Math.floor(end / world.columns) })
    end = previous[end]
  }
  return route.reverse()
}

// Terrain edits only displace residents trapped under solid decoration.
export function settleResidents(world: IslandWorld, residents: Resident[]) {
  const moved: string[] = []
  for (const resident of residents) {
    resident.route = []
    const blocked =
      !canResidentEnter(world, resident.tile.x, resident.tile.y) ||
      (resident.target &&
        !canStep(resident.tile.x, resident.tile.y, resident.target.x, resident.target.y, (x, y) =>
          canResidentEnter(world, x, y)
        ))
    if (
      resident.action === 'fish' &&
      (blocked || !canCast(world, resident, resident.heading.x, resident.heading.y))
    )
      takeOverResident(resident)
    if (!blocked) continue
    const spot = nearestWalkable(world, resident.tile.x, resident.tile.y, (x, y) =>
      residents.some((other) => other !== resident && residentOccupies(other, x, y))
    )
    if (!spot) continue
    resident.tile = spot
    resident.target = null
    Object.assign(resident, footOf(spot))
    resident.frame = 0
    resident.wait = 1.5
    moved.push(resident.slug)
  }
  for (const resident of residents) {
    if (!isWalkable(world, resident.home.x, resident.home.y)) resident.home = { ...resident.tile }
  }
  return moved
}

function startStep(
  world: IslandWorld,
  residents: Resident[],
  resident: Resident,
  next: { x: number; y: number }
) {
  if (
    !canStep(
      resident.tile.x,
      resident.tile.y,
      next.x,
      next.y,
      (x, y) =>
        canResidentEnter(world, x, y) &&
        !residents.some((other) => other !== resident && residentOccupies(other, x, y))
    )
  )
    return false
  resident.target = next
  resident.heading = { x: next.x - resident.tile.x, y: next.y - resident.tile.y }
  return true
}

function advanceStep(world: IslandWorld, resident: Resident, dt: number) {
  if (!resident.target) return
  const goal = footOf(resident.target)
  const distance = Math.hypot(goal.x - resident.x, goal.y - resident.y)
  const speed = resident.speed * (residentIsSwimming(world, resident) ? 0.65 : 1)
  const move = speed * dt
  resident.walkClock += dt * (speed / 21)
  resident.frame = Math.floor(resident.walkClock / 0.18) % 2 ? 1 : 2
  if (distance <= move) {
    resident.x = goal.x
    resident.y = goal.y
    resident.tile = resident.target
    resident.target = null
    resident.frame = 0
  } else {
    resident.x += ((goal.x - resident.x) / distance) * move
    resident.y += ((goal.y - resident.y) / distance) * move
  }
}

export function takeOverResident(resident: Resident) {
  resident.route = []
  resident.wait = 0
  resident.offsetX = 0
  resident.offsetY = 0
  resident.tilt = 0
  resident.frame = 0
  resident.action = 'walk'
  resident.actionRemaining = actionDuration('walk', Math.random)
}

export function stepManualResident(
  world: IslandWorld,
  residents: Resident[],
  resident: Resident,
  dt: number,
  yaw: number,
  input: { x: number; y: number }
) {
  // Reserve one of the eight neighboring tiles in the direction seen by the viewer.
  if (!resident.target && (input.x || input.y)) {
    const sector = Math.round((yaw + Math.atan2(input.x, -input.y)) / (Math.PI / 4))
    const angle = (sector * Math.PI) / 4
    startStep(world, residents, resident, {
      x: resident.tile.x + Math.round(Math.cos(angle)),
      y: resident.tile.y + Math.round(Math.sin(angle))
    })
  }
  advanceStep(world, resident, dt)
}

export function stepResidents(
  world: IslandWorld,
  residents: Resident[],
  dt: number,
  paused: (slug: string) => boolean
) {
  for (const resident of residents) {
    resident.offsetX = 0
    resident.offsetY = 0
    resident.tilt = 0
    if (paused(resident.slug)) {
      resident.frame = 0
      continue
    }
    resident.actionRemaining -= dt
    // Finish the current tile before changing activities so reservations stay valid.
    if (resident.actionRemaining <= 0 && !resident.target) {
      const cast =
        resident.action === 'walk' &&
        cardinalSteps.find(([dx, dy]) => canCast(world, resident, dx, dy))
      resident.action = chooseAction(Math.random, resident.action, !!cast)
      resident.heading =
        resident.action === 'fish' && cast ? { x: cast[0], y: cast[1] } : { x: 1, y: 1 }
      resident.actionClock = 0
      resident.actionRemaining = actionDuration(resident.action, Math.random)
      // A breather only interrupts the journey; performances end it.
      if (resident.action === 'dance' || resident.action === 'jump') resident.route = []
    }
    if (resident.action !== 'walk' && !resident.target) {
      resident.actionClock += dt
      const beat = resident.actionClock * Math.PI * 2
      resident.frame = 0
      if (resident.action === 'dance') {
        resident.offsetX = Math.sin(beat * 1.2) * 2
        resident.offsetY = -Math.abs(Math.sin(beat * 1.2)) * 2
        resident.tilt = Math.sin(beat * 1.2) * 0.16
        resident.frame = Math.floor(resident.actionClock / 0.22) % 2 ? 1 : 2
      } else if (resident.action === 'jump') {
        // A short hop followed by a grounded pause.
        const hop = (resident.actionClock % 1.4) / 0.7
        resident.offsetY = hop < 1 ? -Math.sin(hop * Math.PI) * 9 : 0
        resident.frame = hop < 1 ? 1 : 0
      }
      continue
    }
    if (!resident.target) {
      resident.frame = 0
      resident.wait -= dt
      if (resident.wait > 0) continue
      if (!resident.route.length) resident.route = planJourney(world, residents, resident)
      const next = resident.route.shift()
      if (!next || !startStep(world, residents, resident, next)) {
        resident.route = []
        resident.wait = 0.3 + hash2(resident.seed, performanceSeed(resident), 9) * 0.7
        continue
      }
    }
    advanceStep(world, resident, dt)
    if (!resident.target && !resident.route.length)
      resident.wait = 0.5 + hash2(resident.seed, performanceSeed(resident), 7) * 1.5
  }
}

// A per-resident counter so each decision rolls a fresh direction.
const decisions = new WeakMap<Resident, number>()
function performanceSeed(resident: Resident) {
  const next = (decisions.get(resident) ?? 0) + 1
  decisions.set(resident, next)
  return next
}
