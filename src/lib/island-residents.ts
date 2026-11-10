import { createBuffer, hex, outline, type PixelBuffer, type Rgba, setPixel } from './island-art'
import {
  decorAt,
  decorBlocksWalking,
  groundAt,
  hash2,
  type IslandWorld,
  inBounds,
  isWalkable,
  nearestWalkable,
  TILE_SIZE,
  WATER
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
  'glasses',
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
    accessory: 'glasses',
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
// Rows below the shoes in each frame; the sprite scales around this foot line.
export const RESIDENT_FOOT_PAD = 2
export type Facing = 'down' | 'up' | 'side'
export const facings: Facing[] = ['down', 'up', 'side']
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
  const front = facing === 'down'
  const y0 = 12 - bob
  const left = side ? 6 : 5
  const width = side ? 4 : 6
  const right = left + width - 1

  // Feet stay planted; a step lifts one of them.
  const feet = side ? [6, 8] : [5, 9]
  feet.forEach((fx, i) => {
    const lifted = step !== 0 && step - 1 === i
    const x = side && step ? fx + (i === 0 ? -1 : 1) * (step === 1 ? 1 : -1) : fx
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
      if (front) p.rect(7, y0 + 1, 2, 1, accent)
      if (facing === 'up') p.rect(left, y0 + 1, width, 1, top)
      break
    case 'kimono':
      p.rect(left, y0 + 1, width, 1, accent)
      if (front) p.px(7, y0, topDark)
      break
    case 'apron':
      if (front) p.rect(6, y0 + 1, 4, 2, bottom)
      else if (side) p.rect(right - 1, y0 + 1, 2, 2, bottom)
      break
    case 'coat':
      if (front) p.px(7, y0 + 1, accent)
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
  if (side) {
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
    if (facing === 'up') {
      p.rect(6, y0, 4, 3, pack)
      p.rect(6, y0 + 2, 4, 1, packDark)
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
  const back = facing === 'up'
  const hood = d.accessory === 'hood'
  const main = hood ? hex(d.top) : hair
  const dark = hood ? shade(d.top, -0.25) : hairDark
  const behind = (x: number, y: number, w: number, h: number) => p.rect(x, y + dy, w, h, dark)

  // Hair that hangs behind the head.
  if (!hood) {
    switch (d.hair) {
      case 'long':
        if (back) behind(3, 7, 10, 7)
        else if (side) behind(3, 7, 4, 7)
        else {
          behind(2, 7, 2, 7)
          behind(12, 7, 2, 7)
        }
        break
      case 'twintails':
        if (side) behind(1, 6, 2, 5)
        else {
          behind(0, 6, 2, 5)
          behind(14, 6, 2, 5)
        }
        break
      case 'ponytail':
        if (back) behind(7, 10, 2, 4)
        else if (side) behind(1, 5, 2, 5)
        break
      case 'braid':
        if (back) behind(7, 10, 2, 5)
        else if (side) behind(3, 10, 2, 4)
        break
      case 'bob':
        if (side) behind(3, 7, 4, 4)
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
      if (back) covered = true
      else if (side) covered = y < fringe(x) || x < 7 || (x < 9 && y < 8)
      else covered = y < fringe(x) || x <= 3 || x >= 12 || ((x === 4 || x === 11) && y < 9)
      if (hood && !back && !side) covered = covered || y < 6 || x <= 4 || x >= 11
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
      for (const x of side ? [5] : [3, 11]) {
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
  const front = facing === 'down'
  const r = (x: number, y: number, w: number, h: number, color: Rgba) =>
    p.rect(x, y + dy, w, h, color)
  switch (d.accessory) {
    case 'cap':
      r(5, 2, 6, 1, accent)
      r(4, 3, 8, 2, accent)
      if (front) r(4, 5, 8, 1, accentDark)
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
    case 'ribbon':
      r(side ? 4 : 10, 2, 2, 2, accent)
      r(side ? 7 : 13, 2, 2, 2, accent)
      r(side ? 6 : 12, 3, 1, 1, accentDark)
      break
    case 'flower': {
      const petal = hex('#fff6e8')
      const fx = side ? 5 : 11
      r(fx, 2, 1, 1, petal)
      r(fx - 1, 3, 1, 1, petal)
      r(fx + 1, 3, 1, 1, petal)
      r(fx, 4, 1, 1, petal)
      r(fx, 3, 1, 1, hex('#ffcf3f'))
      break
    }
    case 'catEars': {
      const fur = hex(d.hairColor)
      for (const x of side ? [5] : [3, 11]) {
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
      r(7, 3, 2, 1, hex('#e0574f'))
      break
    }
    case 'headphones':
      r(4, 2, 8, 1, hex('#4a4458'))
      if (side) r(7, 6, 2, 3, accent)
      else {
        r(2, 6, 2, 3, accent)
        r(12, 6, 2, 3, accent)
      }
      break
    case 'goggles':
      r(3, 5, 10, 1, hex('#4a4458'))
      if (front) {
        r(5, 4, 2, 2, accent)
        r(9, 4, 2, 2, accent)
        r(5, 4, 1, 1, hex('#ffffff'))
        r(9, 4, 1, 1, hex('#ffffff'))
      } else if (side) r(10, 4, 2, 2, accent)
      break
    case 'glasses': {
      const frame = hex('#4a4458')
      if (front)
        for (const x of [4, 9]) {
          r(x, 7, 3, 1, frame)
          r(x, 10, 3, 1, frame)
          r(x, 8, 1, 2, frame)
          r(x + 2, 8, 1, 2, frame)
        }
      else if (side) {
        r(9, 7, 3, 1, frame)
        r(9, 10, 3, 1, frame)
        r(11, 8, 1, 2, frame)
      }
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
      if (front) r(4, 6, 8, 1, shell)
      if (side) r(10, 5, 4, 1, shell)
      break
    }
    case 'none':
      break
  }
}

// One sheet per resident: rows are facings (down, up, side), columns are frames.
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
  facing: Facing
  flip: boolean
  frame: number
  wait: number
  walkClock: number
  speed: number
  action: 'walk' | 'idle' | 'dance' | 'jump'
  actionClock: number
  actionRemaining: number
  offsetX: number
  offsetY: number
  tilt: number
  seed: number
}

const COMMON_ACTIONS = ['walk', 'idle', 'jump'] as const

function chooseAction(random: () => number, current?: Resident['action']): Resident['action'] {
  const roll = random()
  // Dancing is a rare treat: 2% on arrival and on each eligible activity change.
  if (current !== 'dance' && roll < 0.02) return 'dance'
  const choices = COMMON_ACTIONS.filter((action) => action !== current)
  const commonRoll = current === 'dance' ? roll : (roll - 0.02) / 0.98
  return choices[Math.min(choices.length - 1, Math.floor(commonRoll * choices.length))]
}
// Slow stroll, regular walk and brisk walk, in art pixels per second.
const WALK_SPEEDS = [14, 21, 28] as const

export const footOf = (tile: { x: number; y: number }) => ({
  x: tile.x * TILE_SIZE + TILE_SIZE / 2,
  y: tile.y * TILE_SIZE + TILE_SIZE - 3
})

export function createResidents(
  slugs: string[],
  homes: Array<{ x: number; y: number }>,
  random = Math.random
) {
  return slugs.map<Resident>((slug, i) => {
    const home = homes[i] ?? homes[0] ?? { x: 0, y: 0 }
    const foot = footOf(home)
    return {
      slug,
      home: { ...home },
      tile: { ...home },
      target: null,
      route: [],
      ...foot,
      facing: 'down',
      flip: false,
      frame: 0,
      wait: hash2(i, 3, 5) * 2,
      walkClock: 0,
      speed: WALK_SPEEDS[hashSlug(`walk:${slug}`) % WALK_SPEEDS.length],
      action: chooseAction(random),
      actionClock: random() * 2,
      actionRemaining: 6 + random() * 14,
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

export function residentIsSwimming(world: IslandWorld, resident: Pick<Resident, 'x' | 'y'>) {
  return (
    groundAt(world, Math.floor(resident.x / TILE_SIZE), Math.floor(resident.y / TILE_SIZE)) ===
    WATER
  )
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
  Object.assign(resident, footOf(tile), { tile, target: null, route: [], frame: 0, wait: 0.6 })
  return true
}

// A journey crosses the island, routing around trees, rocks and other residents.
function planJourney(world: IslandWorld, residents: Resident[], resident: Resident) {
  const start = resident.tile.y * world.columns + resident.tile.x
  const previous = new Int32Array(world.ground.length).fill(-1)
  const blocked = new Set<number>()
  for (const other of residents) {
    if (other === resident) continue
    blocked.add(other.tile.y * world.columns + other.tile.x)
    if (other.target) blocked.add(other.target.y * world.columns + other.target.x)
  }
  const queue = [start]
  const destinations: number[] = []
  previous[start] = start
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]
    const x = index % world.columns
    const y = Math.floor(index / world.columns)
    if (isWalkable(world, x, y) && Math.hypot(x - resident.tile.x, y - resident.tile.y) >= 8)
      destinations.push(index)
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1]
    ]) {
      const nx = x + dx
      const ny = y + dy
      const next = ny * world.columns + nx
      if (!canResidentEnter(world, nx, ny) || previous[next] !== -1 || blocked.has(next)) continue
      previous[next] = index
      queue.push(next)
    }
  }
  const choices = destinations.length ? destinations : queue.slice(1)
  if (!choices.length) return []
  const roll = hash2(resident.seed & 0xffff, performanceSeed(resident), 3)
  let end = choices[Math.floor(roll * choices.length)]
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
      (resident.target && !canResidentEnter(world, resident.target.x, resident.target.y))
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
      resident.action = chooseAction(Math.random, resident.action)
      resident.actionClock = 0
      resident.actionRemaining = 6 + Math.random() * 14
      resident.route = []
      resident.facing = 'down'
      resident.flip = false
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
        resident.facing = 'down'
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
      if (
        !next ||
        !canResidentEnter(world, next.x, next.y) ||
        residents.some((other) => other !== resident && residentOccupies(other, next.x, next.y))
      ) {
        resident.route = []
        resident.wait = 0.3 + hash2(resident.seed, performanceSeed(resident), 9) * 0.7
        continue
      }
      const dx = next.x - resident.tile.x
      const dy = next.y - resident.tile.y
      resident.target = next
      resident.facing = dy < 0 ? 'up' : dy > 0 ? 'down' : 'side'
      resident.flip = dx < 0
    }
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
      if (!resident.route.length)
        resident.wait = 0.5 + hash2(resident.seed, performanceSeed(resident), 7) * 1.5
    } else {
      resident.x += ((goal.x - resident.x) / distance) * move
      resident.y += ((goal.y - resident.y) / distance) * move
    }
  }
}

// A per-resident counter so each decision rolls a fresh direction.
const decisions = new WeakMap<Resident, number>()
function performanceSeed(resident: Resident) {
  const next = (decisions.get(resident) ?? 0) + 1
  decisions.set(resident, next)
  return next
}
