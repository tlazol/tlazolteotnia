import { createBuffer, hex, outline, type PixelBuffer, type Rgba, setPixel } from './island-art'
import { hash2, type IslandWorld, isWalkable, nearestWalkable, TILE_SIZE } from './island-world'
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

export const RESIDENT_FRAME = { width: 20, height: 28 } as const
// Residents are drawn smaller than their art so they sit lighter on the tiles.
export const RESIDENT_SCALE = 0.8
// Rows below the shoes in each frame; the sprite scales around this foot line.
export const RESIDENT_FOOT_PAD = 3
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
  has: (x: number, y: number) => boolean
}

function painter(buffer: PixelBuffer, ox: number, oy: number): Painter {
  return {
    px: (x, y, color) => setPixel(buffer, ox + x, oy + y, color),
    rect: (x, y, w, h, color) => {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) setPixel(buffer, ox + x + i, oy + y + j, color)
    },
    has: (x, y) => {
      const bx = ox + x
      const by = oy + y
      if (bx < 0 || by < 0 || bx >= buffer.width || by >= buffer.height) return false
      return buffer.data[(by * buffer.width + bx) * 4 + 3] > 0
    }
  }
}

// Frame layout (20×28): head rows 5–15, torso 15–20, legs 21–23, shoes 24.
const HEAD = { cx: 10, cy: 10, rx: 6.4, ry: 5.6 }
const inHead = (x: number, y: number) =>
  ((x + 0.5 - HEAD.cx) / HEAD.rx) ** 2 + ((y + 0.5 - HEAD.cy) / HEAD.ry) ** 2 <= 1

function paintBody(p: Painter, d: ResidentDesign, facing: Facing, step: number, bob: number) {
  const skin = hex(d.skin)
  const top = hex(d.top)
  const topDark = shade(d.top, -0.25)
  const bottom = hex(d.bottom)
  const bottomDark = shade(d.bottom, -0.25)
  const shoe = hex(d.outfit === 'riding' ? '#2b2236' : '#5a3b32')
  const sock = d.outfit === 'riding' ? hex('#2b2236') : skin
  const y0 = 15 - bob
  const side = facing === 'side'
  // Legs and shoes stay planted; the torso bobs.
  const legs = side ? [8, 11] : [8, 11]
  legs.forEach((lx, i) => {
    const lifted = step !== 0 && step - 1 === i ? 1 : 0
    const offset = side && step ? (i === 0 ? -1 : 1) * (step === 1 ? 1 : -1) : 0
    const x = lx + offset
    p.rect(x, 21 - lifted, 2, 3, sock)
    p.rect(x, 24 - lifted, 2, 1, shoe)
    if (side) p.px(x + 2, 24 - lifted, shoe)
  })
  const width = side ? 6 : 8
  const left = side ? 7 : 6
  const long = d.outfit === 'coat' || d.outfit === 'kimono' || d.outfit === 'riding'
  const skirt = d.outfit === 'dress' || d.outfit === 'skirt' || d.outfit === 'sailor'
  // Lower body.
  if (skirt) {
    const color = d.outfit === 'dress' ? top : bottom
    const dark = d.outfit === 'dress' ? topDark : bottomDark
    p.rect(left - 1, y0 + 4, width + 2, 3, color)
    p.rect(left - 1, y0 + 6, width + 2, 1, dark)
  } else if (d.outfit === 'kimono') {
    p.rect(left, y0 + 4, width, 5 + bob, top)
    p.rect(left + width - 1, y0 + 4, 1, 5 + bob, topDark)
  } else if (long) {
    p.rect(left, y0 + 4, width, 2, d.outfit === 'riding' ? bottom : top)
    if (d.outfit === 'riding') p.rect(left, y0 + 6, width, 1, bottomDark)
  } else {
    p.rect(left, y0 + 4, width, 3 + bob, bottom)
    p.rect(left + width - 1, y0 + 4, 1, 3 + bob, bottomDark)
  }
  // Torso.
  p.rect(left, y0, width, 5, d.outfit === 'sailor' ? hex('#f4f0e6') : top)
  p.rect(left + width - 1, y0, 1, 5, d.outfit === 'sailor' ? hex('#d9d2c4') : topDark)
  if (d.outfit === 'overalls') {
    p.rect(left, y0 + 2, width, 3, bottom)
    p.px(left + 1, y0, bottom)
    p.px(left + 1, y0 + 1, bottom)
    if (!side) {
      p.px(left + width - 2, y0, bottom)
      p.px(left + width - 2, y0 + 1, bottom)
    }
    p.rect(left, y0 + 4, width, 3 + bob, bottom)
  }
  if (d.outfit === 'sailor' && facing !== 'up') {
    p.rect(left, y0, width, 1, top)
    if (!side) {
      p.px(left + 3, y0 + 1, hex(d.accent))
      p.px(left + 4, y0 + 1, hex(d.accent))
      p.px(left + 3, y0 + 2, hex(d.accent))
    }
  }
  if (d.outfit === 'sailor' && facing === 'up') p.rect(left, y0, width, 2, top)
  if (d.outfit === 'kimono') p.rect(left, y0 + 3, width, 1, hex(d.accent))
  if (d.outfit === 'apron' && facing !== 'up') {
    p.rect(left + 1, y0 + 1, width - 2, 6, bottom)
    if (!side) p.px(left + 3, y0 + 4, bottomDark)
  }
  if (d.outfit === 'coat' && !side && facing === 'down') {
    p.px(left + 3, y0 + 2, hex(d.accent))
    p.px(left + 3, y0 + 4, hex(d.accent))
  }
  if (d.outfit === 'hoodie' && facing !== 'down') p.rect(left + 1, y0, width - 2, 2, topDark)
  if (d.outfit === 'hoodie' && facing === 'down') p.rect(left + 2, y0 + 3, width - 4, 1, topDark)
  if (d.outfit === 'riding') p.rect(left, y0 + 3, width, 1, hex('#2b2236'))
  // Arms swing opposite the legs.
  const swing = step === 1 ? 1 : step === 2 ? -1 : 0
  if (side) {
    p.rect(9 + swing, y0 + 1, 2, 3, topDark)
    p.rect(9 + swing, y0 + 4, 2, 1, skin)
  } else {
    p.rect(left - 1, y0 + 1, 1, 3 + swing, top)
    p.px(left - 1, y0 + 4 + swing, skin)
    p.rect(left + width, y0 + 1, 1, 3 - swing, topDark)
    p.px(left + width, y0 + 4 - swing, skin)
  }
  if (d.backpack) {
    const pack = hex('#c0743c')
    const packDark = hex('#8f5230')
    if (facing === 'up') {
      p.rect(left + 1, y0, width - 2, 5, pack)
      p.rect(left + 1, y0 + 4, width - 2, 1, packDark)
    } else if (side) {
      p.rect(left - 2, y0, 3, 5, pack)
      p.rect(left - 2, y0 + 4, 3, 1, packDark)
    } else {
      p.px(left + 1, y0, packDark)
      p.px(left + width - 2, y0, packDark)
      p.px(left + 1, y0 + 1, packDark)
      p.px(left + width - 2, y0 + 1, packDark)
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
  const hairColor = hood ? hex(d.top) : hair
  const hairShade = hood ? shade(d.top, -0.25) : hairDark

  // Hair behind the head.
  const behind = (x: number, y: number, w: number, h: number) => p.rect(x, y + dy, w, h, hairShade)
  if (!hood) {
    if (d.hair === 'long') {
      if (back) behind(4, 9, 12, 9)
      else if (side) behind(4, 9, 6, 9)
      else {
        behind(3, 9, 2, 9)
        behind(15, 9, 2, 9)
      }
    }
    if (d.hair === 'twintails') {
      if (side) behind(2, 9, 3, 8)
      else {
        behind(1, 9, 3, 8)
        behind(16, 9, 3, 8)
      }
    }
    if (d.hair === 'ponytail') {
      if (back) behind(8, 12, 4, 8)
      else if (side) behind(2, 7, 3, 9)
    }
    if (d.hair === 'braid' && (back || side)) behind(back ? 9 : 4, 13, 2, 8)
    if (d.hair === 'bob') {
      if (side) behind(4, 9, 6, 6)
      else {
        behind(3, 9, 2, 6)
        behind(15, 9, 2, 6)
      }
    }
  }

  // Head and face.
  for (let y = 4; y <= 16; y++)
    for (let x = 3; x <= 16; x++) if (inHead(x, y)) p.px(x, y + dy, skin)
  const fringe = (x: number) => {
    switch (d.hair) {
      case 'spiky':
        return 8 + ((x * 3) % 4 === 0 ? 1 : 0)
      case 'short':
        return 7 + (x % 3 === 0 ? 1 : 0)
      case 'bob':
      case 'buns':
        return 8
      default:
        return 7 + (x % 4 === 1 ? 1 : 0)
    }
  }
  for (let y = 3; y <= 16; y++) {
    for (let x = 2; x <= 17; x++) {
      if (!inHead(x, y)) continue
      let covered: boolean
      if (back) covered = true
      else if (side) covered = y < fringe(x) || x < 10 || (x < 12 && y < 10)
      else covered = y < fringe(x) || x <= 4 || x >= 15 || ((x === 5 || x === 14) && y < 12)
      if (hood) covered = covered || (!side && !back ? y < 8 || x <= 4 || x >= 15 : covered)
      if (!covered) continue
      p.px(
        x,
        y + dy,
        y <= 6 && x <= 9 && !back
          ? hairColor
          : hairColor === hair
            ? x >= 13 || y >= 13
              ? hairDark
              : hair
            : x >= 13
              ? hairShade
              : hairColor
      )
    }
  }
  if (!hood) {
    // A shine on the hair for volume.
    if (!back) {
      p.px(7, 5 + dy, hairLight)
      p.px(8, 5 + dy, hairLight)
    } else {
      p.px(8, 6 + dy, hairLight)
      p.px(9, 6 + dy, hairLight)
    }
    if (d.hair === 'spiky') {
      for (const x of [5, 8, 11, 14]) p.px(x, 3 + dy, hair)
      p.px(17, 8 + dy, hair)
      p.px(2, 8 + dy, hair)
    }
    if (d.hair === 'buns') {
      for (const cx of side ? [8] : [4, 15]) {
        p.rect(cx - 1, 3 + dy, 3, 3, hair)
        p.px(cx + 1, 5 + dy, hairDark)
      }
    }
    if (d.hair === 'braid' && facing === 'down') {
      p.rect(14, 13 + dy, 2, 5, hairDark)
      p.px(14, 18 + dy, hex(d.accent))
    }
    if (d.hair === 'ponytail' && facing === 'down') p.rect(9, 3 + dy, 2, 1, hex(d.accent))
  }

  // Eyes, blush and mouth.
  const eye = hex('#2b2236')
  const shine = hex('#ffffff')
  const blush = hex('#f29a9a')
  if (facing === 'down') {
    for (const x of [7, 12]) {
      p.px(x, 10 + dy, eye)
      p.px(x, 11 + dy, eye)
      p.px(x, 10 + dy, x === 7 ? eye : eye)
    }
    p.px(7, 10 + dy, shine)
    p.px(12, 10 + dy, shine)
    p.px(6, 12 + dy, blush)
    p.px(13, 12 + dy, blush)
    p.px(9, 13 + dy, hex('#c4645e'))
  } else if (side) {
    p.px(13, 10 + dy, shine)
    p.px(13, 11 + dy, eye)
    p.px(14, 11 + dy, eye)
    p.px(14, 12 + dy, blush)
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
      r(4, 3, 12, 3, accent)
      r(4, 5, 12, 1, accentDark)
      if (front) r(5, 6, 10, 1, accentDark)
      if (side) r(14, 5, 4, 1, accentDark)
      break
    case 'strawHat': {
      const straw = hex('#f1d27a')
      const strawDark = hex('#c9a24f')
      r(1, 5, 18, 2, straw)
      r(1, 6, 18, 1, strawDark)
      r(5, 2, 10, 3, straw)
      r(5, 4, 10, 1, hex(d.accent))
      break
    }
    case 'beret':
      r(4, 3, 11, 2, accent)
      r(3, 4, 12, 1, accentDark)
      p.px(9, 2 + dy, accentDark)
      break
    case 'ribbon':
      r(side ? 6 : 12, 3, 2, 2, accent)
      r(side ? 9 : 15, 3, 2, 2, accent)
      p.px(side ? 8 : 14, 4 + dy, accentDark)
      break
    case 'flower':
      p.px(side ? 6 : 14, 4 + dy, hex('#fff6e8'))
      p.px(side ? 5 : 13, 5 + dy, hex('#fff6e8'))
      p.px(side ? 7 : 15, 5 + dy, hex('#fff6e8'))
      p.px(side ? 6 : 14, 6 + dy, hex('#fff6e8'))
      p.px(side ? 6 : 14, 5 + dy, hex('#ffcf3f'))
      break
    case 'catEars':
      for (const x of side ? [7] : [4, 14]) {
        r(x, 2, 2, 2, hex(d.hairColor))
        p.px(x + (x < 10 ? 0 : 1), 1 + dy, hex(d.hairColor))
        if (!side && facing !== 'up') p.px(x + (x < 10 ? 1 : 0), 3 + dy, hex('#f6a5b8'))
      }
      break
    case 'witchHat': {
      const hat = hex('#3d3357')
      r(2, 5, 16, 2, hat)
      r(5, 3, 10, 2, hat)
      r(7, 1, 6, 2, hat)
      r(9, 0, 3, 1, hat)
      r(5, 4, 10, 1, accent)
      break
    }
    case 'crown': {
      const gold = hex('#f2c94c')
      r(6, 3, 8, 2, gold)
      for (const x of [6, 9, 13]) p.px(x, 2 + dy, gold)
      p.px(10, 3 + dy, hex('#e0574f'))
      break
    }
    case 'headphones': {
      const band = hex('#4a4458')
      r(4, 3, 12, 1, band)
      if (!side) {
        r(2, 8, 2, 4, accent)
        r(16, 8, 2, 4, accent)
      } else r(8, 8, 3, 4, accent)
      break
    }
    case 'goggles':
      r(3, 6, 14, 1, hex('#4a4458'))
      if (front) {
        r(5, 5, 4, 3, accent)
        r(11, 5, 4, 3, accent)
        p.px(6, 6 + dy, hex('#ffffff'))
        p.px(12, 6 + dy, hex('#ffffff'))
      } else if (side) r(12, 5, 4, 3, accent)
      break
    case 'glasses':
      if (front) {
        const frame = hex('#4a4458')
        r(5, 9, 4, 1, frame)
        r(10, 9, 5, 1, frame)
        p.px(5, 10 + dy, frame)
        p.px(8, 10 + dy, frame)
        p.px(11, 10 + dy, frame)
        p.px(14, 10 + dy, frame)
        r(5, 12, 4, 1, frame)
        r(11, 12, 4, 1, frame)
      } else if (side) {
        r(12, 9, 4, 1, hex('#4a4458'))
        p.px(15, 10 + dy, hex('#4a4458'))
      }
      break
    case 'beanie':
      r(4, 2, 12, 5, accent)
      r(4, 6, 12, 1, accentDark)
      p.px(9, 1 + dy, hex('#f4f0e6'))
      p.px(10, 1 + dy, hex('#f4f0e6'))
      break
    case 'hood':
      r(4, 3, 12, 2, hex(d.top))
      break
    case 'sprout': {
      const leaf = hex('#6cc04f')
      p.px(10, 3 + dy, hex('#3f8a3d'))
      p.px(10, 2 + dy, hex('#3f8a3d'))
      r(8, 1, 2, 1, leaf)
      r(11, 1, 2, 1, leaf)
      break
    }
    case 'helmet': {
      const shell = hex('#2b2236')
      r(4, 3, 12, 4, shell)
      r(5, 2, 10, 1, shell)
      p.px(7, 3 + dy, hex('#5a4f75'))
      p.px(8, 3 + dy, hex('#5a4f75'))
      if (front) r(5, 7, 10, 1, shell)
      if (side) r(14, 6, 4, 1, shell)
      r(9, 2, 2, 1, accent)
      break
    }
    case 'none':
      break
  }
}

// One sheet per resident: rows are facings (down, up, side), columns are frames.
export function paintResidentSheet(design: ResidentDesign) {
  const { width, height } = RESIDENT_FRAME
  const sheet = createBuffer(width * RESIDENT_FRAMES, height * facings.length)
  facings.forEach((facing, row) => {
    for (let frame = 0; frame < RESIDENT_FRAMES; frame++) {
      const cell = createBuffer(width, height)
      const p = painter(cell, 0, 0)
      const bob = frame === 0 ? 0 : 1
      paintBody(p, design, facing, frame, bob)
      paintHead(p, design, facing, bob)
      outline(cell, hex('#2b2236'))
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
  // Foot position in art pixels.
  x: number
  y: number
  facing: Facing
  flip: boolean
  frame: number
  wait: number
  walkClock: number
  seed: number
}

export const footOf = (tile: { x: number; y: number }) => ({
  x: tile.x * TILE_SIZE + TILE_SIZE / 2,
  y: tile.y * TILE_SIZE + TILE_SIZE - 3
})

export function createResidents(slugs: string[], homes: Array<{ x: number; y: number }>) {
  return slugs.map<Resident>((slug, i) => {
    const home = homes[i] ?? homes[0] ?? { x: 0, y: 0 }
    const foot = footOf(home)
    return {
      slug,
      home: { ...home },
      tile: { ...home },
      target: null,
      ...foot,
      facing: 'down',
      flip: false,
      frame: 0,
      wait: 1 + hash2(i, 3, 5) * 4,
      walkClock: 0,
      seed: hashSlug(slug)
    }
  })
}

const WANDER = 3
const SPEED = 14 // art pixels per second

export function residentOccupies(resident: Resident, x: number, y: number) {
  return (
    (resident.tile.x === x && resident.tile.y === y) ||
    (resident.target?.x === x && resident.target?.y === y)
  )
}

// Moves any resident left in the sea or under a tree to the nearest free ground.
export function settleResidents(world: IslandWorld, residents: Resident[]) {
  const moved: string[] = []
  for (const resident of residents) {
    const blocked =
      !isWalkable(world, resident.tile.x, resident.tile.y) ||
      (resident.target && !isWalkable(world, resident.target.x, resident.target.y))
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
    if (!resident.target) {
      resident.frame = 0
      if (paused(resident.slug)) continue
      resident.wait -= dt
      if (resident.wait > 0) continue
      const roll = hash2(resident.seed & 0xffff, Math.floor(performanceSeed(resident)), 3)
      const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ] as const
      const [dx, dy] = directions[Math.floor(roll * 4)]
      const next = { x: resident.tile.x + dx, y: resident.tile.y + dy }
      resident.wait = 1.2 + hash2(next.x, next.y, resident.seed & 0xff) * 4
      if (
        Math.abs(next.x - resident.home.x) > WANDER ||
        Math.abs(next.y - resident.home.y) > WANDER ||
        !isWalkable(world, next.x, next.y) ||
        residents.some((other) => other !== resident && residentOccupies(other, next.x, next.y))
      )
        continue
      resident.target = next
      resident.facing = dy < 0 ? 'up' : dy > 0 ? 'down' : 'side'
      resident.flip = dx < 0
      continue
    }
    const goal = footOf(resident.target)
    const distance = Math.hypot(goal.x - resident.x, goal.y - resident.y)
    const move = SPEED * dt
    resident.walkClock += dt
    resident.frame = Math.floor(resident.walkClock / 0.18) % 2 ? 1 : 2
    if (distance <= move) {
      resident.x = goal.x
      resident.y = goal.y
      resident.tile = resident.target
      resident.target = null
      resident.frame = 0
      if (resident.facing === 'up') resident.facing = 'down'
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
