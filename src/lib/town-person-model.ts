import { bicycleGrip, bicyclePose, bicycleSegment, type CyclingMotion } from './town-bicycle-pose'
import { townPersonAppearance, townPersonStyle } from './town-person'
import type { PersonShape } from './town-person-geometry'

export type PersonPart = {
  shape: PersonShape
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  color: number
  angle: number
  pitch: number
  motion?: 'leg' | 'arm' | CyclingMotion
}

// Two heads tall: legs end at the hips, the torso at the neck, and the head fills the rest.
export const personHipHeight = 13
export const personShoulderHeight = 25
const neckHeight = 26.5
export const personHead = { x: 0, y: 42, z: 3, width: 35, height: 31, depth: 31 }
// Tip the face up toward the 45° town camera so the eyes read from above.
export const personHeadTilt = -0.2
const ridingLean = 0.2
const saddle = { y: 35, z: -7 }

const white = 0xfffaf3
const black = 0x2d2734
const gold = 0xf2c55c
const brown = 0x7b4b3a
const pink = 0xf49ab4

type Frame = 'body' | 'head' | 'leg' | 'arm'
type PartArgs = [
  shape: PersonShape,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  color: number,
  angle?: number,
  pitch?: number
]

function rotate(y: number, z: number, pivot: number, angle: number) {
  const dy = y - pivot
  return [
    pivot + dy * Math.cos(angle) - z * Math.sin(angle),
    dy * Math.sin(angle) + z * Math.cos(angle)
  ]
}

const pick = <T>(tone: number, choices: readonly T[]) => choices[tone % choices.length]

export function createPersonParts(variant: number, identity: string, riding = false) {
  const style = townPersonStyle(variant)
  const look = townPersonAppearance(identity)
  const traveller = identity === 'give-the-ai-precise-instructions'
  const role = traveller ? 'traveller' : style.role
  const hairstyle = traveller ? 'short' : style.hair
  const bangs = traveller ? 'pointy' : style.bangs
  const eyes = traveller ? 0 : style.eyes
  const hair: number = traveller ? 0x3f7de0 : look.hairColor
  const { tone } = look
  const skin: number = look.skin
  const parts: PersonPart[] = []

  const put = (
    frame: Frame,
    ...[shape, x, y, z, width, height, depth, color, angle = 0, pitch = 0]: PartArgs
  ) => {
    if (frame === 'head') {
      ;[y, z] = rotate(y, z, neckHeight, personHeadTilt)
      pitch += personHeadTilt
    }
    const limb = frame === 'leg' || frame === 'arm'
    if (riding && !limb) {
      ;[y, z] = rotate(y, z, personHipHeight, ridingLean)
      pitch += ridingLean
      y += saddle.y - personHipHeight
      z += saddle.z
    }
    // Riding limbs are posed separately, so walking limbs and hand-held props stay home.
    if (riding && limb) return
    const part: PersonPart = { shape, x, y, z, width, height, depth, color, angle, pitch }
    if (limb) part.motion = frame
    parts.push(part)
  }
  const body = (...args: PartArgs) => put('body', ...args)
  const head = (...args: PartArgs) => put('head', ...args)
  const hand = (...args: PartArgs) => put('arm', ...args)
  const bow = (frame: Frame, x: number, y: number, z: number, color: number, size = 1) => {
    for (const side of [-1, 1]) {
      put(
        frame,
        'girlBall',
        x + side * 2.7 * size,
        y + 0.4 * size,
        z,
        5.4 * size,
        4 * size,
        2.6 * size,
        color,
        side * 0.35
      )
      put(
        frame,
        'girlLock',
        x + side * 1.5 * size,
        y - 2.4 * size,
        z - 0.2,
        1.9 * size,
        4.4 * size,
        1.2 * size,
        color,
        side * 0.35
      )
    }
    put(frame, 'girlBall', x, y, z + 0.5 * size, 2.5 * size, 2.5 * size, 2.5 * size, color)
  }
  const hx = personHead.x
  const hy = personHead.y
  const hz = personHead.z

  // Outfit defaults; each costume below overrides what it needs.
  let top = white
  let sleeve: number | undefined
  let cuff: number | undefined
  let lower: number | undefined = 0x34406e
  let skirtLength = 9
  let skirtWidth = 23
  let shorts = false
  let legs = skin
  let socks: number | undefined = white
  let shoes = brown
  let hands = skin
  let wideSleeves = false
  let hairTie = pick(tone, [0xe85a6c, 0x6b8fe6, 0xf2c55c, 0x9b78d8])
  let hat = false
  const details: (() => void)[] = []

  switch (role) {
    case 'sailor': {
      const navy = pick(tone, [0x34406e, 0x2b3045, 0x2c6470, 0x5e3048])
      lower = cuff = socks = navy
      details.push(() => {
        // The square collar lies over the shoulders and hangs down the back.
        body('girlTrim', 0, 24.6, -2.6, 16.5, 2, 9, navy)
        body('girlTrim', 0, 21, -6.1, 13.5, 8, 1.2, navy)
        body('girlTrim', 0, 21, -6.8, 11.5, 0.8, 0.4, white)
        body('girlTrim', 0, 24.6, -2.6, 15, 0.6, 9.6, white)
        bow('body', 0, 22.8, 6.3, 0xe5505f, 0.95)
      })
      break
    }
    case 'blazer': {
      top = sleeve = pick(tone, [0x2f3c66, 0x6b4a3a, 0x5b6170, 0x2f5a48])
      lower = pick(tone, [0xa6404f, 0x3b4e7a, 0x6a6f85, 0x8a6a3a])
      socks = 0x2f2c3a
      details.push(() => {
        body('girlTrim', 0, 23.2, 5.7, 4.4, 5, 1, white)
        bow('body', 0, 23.4, 6.6, 0xe5505f, 0.7)
        for (const y of [17.5, 20]) body('girlBall', 2.6, y, 6.3, 1.4, 1.4, 1, gold)
      })
      break
    }
    case 'parka': {
      top = sleeve = hands = pick(tone, [0xa8dcc8, 0xc9b6ef, 0xf6b9c9, 0xf8dc86])
      lower = undefined
      shorts = true
      shoes = 0xf3f1ef
      socks = undefined
      details.push(() => {
        body('girlTorso', 0, 18.5, 0, 19, 14.5, 13.5, top)
        body('girlBall', 0, 25, -6.8, 15, 7.5, 8, top)
        for (const side of [-1, 1]) body('girlTrim', side * 2.4, 21.6, 6.9, 0.9, 5, 0.9, white)
        body('girlTrim', 0, 15.5, 6.6, 9, 3.6, 1, 0x5a6b8c)
      })
      break
    }
    case 'maid': {
      const dress = pick(tone, [0x2e2a40, 0x29324f, 0x5a2c3c, 0x4a3a34])
      top = sleeve = lower = dress
      cuff = white
      skirtWidth = 25
      skirtLength = 10
      legs = socks = 0xf7f3f0
      shoes = black
      details.push(() => {
        body('girlLock', 0, 14.8, 8.2, 13, 10, 2, white, 0, -0.32)
        body('girlTrim', 0, 21.3, 6.1, 8, 6, 1, white)
        body('girlTorso', 0, 25.4, 0.4, 11, 2.4, 9, white)
        bow('body', 0, 19.4, -6.6, white, 1)
        head('girlHairband', hx, hy, hz, 35, 31, 31, white)
        for (const x of [-9, -3, 3, 9])
          head('girlBall', x, 57.5, 9 - Math.abs(x) * 0.35, 6, 3.6, 3, white)
      })
      hairTie = black
      break
    }
    case 'miko': {
      sleeve = white
      wideSleeves = true
      lower = 0xd8434f
      skirtLength = 16
      skirtWidth = 24
      legs = socks = white
      shoes = 0xc8463f
      hairTie = white
      details.push(() => {
        for (const side of [-1, 1])
          body('girlTrim', side * 1.5, 23.8, 6, 2.2, 4.6, 1, 0xd8434f, side * 0.5)
        body('girlTorso', 0, 19.5, 0, 16.4, 2, 12.4, 0xd8434f)
      })
      break
    }
    case 'yukata': {
      top = sleeve = lower = pick(tone, [0x47579a, 0xf3a9bb, 0x82c9b5, 0xb49de0])
      const obi = pick(tone, [0xf2c55c, 0xe25a6a, 0xf6e3a4, 0xe57da0])
      wideSleeves = true
      skirtLength = 15
      skirtWidth = 19
      socks = white
      shoes = 0x9b6b47
      hairTie = obi
      details.push(() => {
        body('girlTorso', 0, 18.6, 0, 17.2, 4.6, 12.8, obi)
        bow('body', 0, 18.8, -7.4, obi, 1.5)
        for (const [x, y, z] of [
          [-5, 10, 8.3],
          [4.5, 5.5, 9.3],
          [3, 14.5, 7],
          [-3, 23, 6]
        ])
          body('girlBall', x, y, z, 2.6, 2.6, 1, white)
        head('girlBall', 13, 51, 8, 5, 5, 3, pink)
        head('girlBall', 15.5, 49, 6, 4, 4, 3, 0xffffff)
      })
      break
    }
    case 'witch': {
      const robe = pick(tone, [0x5d4a8c, 0x2f2a3d, 0x2f6a6a, 0x6e3348])
      top = sleeve = lower = robe
      skirtWidth = 25
      skirtLength = 11
      socks = 0x4a3a5a
      shoes = black
      hat = true
      details.push(() => {
        body('girlHairBell', 0, 19.5, -0.8, 22, 15, 17, 0x29243a)
        bow('body', 0, 24.2, 6.4, gold, 0.75)
        head('girlDisc', hx, 55.5, hz, 50, 2.4, 48, 0x29243a)
        head('girlCone', hx, 67.5, hz - 1, 30, 26, 30, 0x29243a, 0, -0.18)
        head(
          'girlDisc',
          hx,
          57.2,
          hz - 0.3,
          29.6,
          3,
          29.6,
          pick(tone, [0xe85a6c, gold, 0x8ad0c0, 0xb79be3]),
          0,
          -0.18
        )
        hand('girlLimb', 11.5, 12, 3, 1.4, 12, 1.4, 0x9b6b47, 0, 0.5)
        hand('girlBall', 11.5, 8, 6, 3.4, 3.4, 3.4, gold)
      })
      break
    }
    case 'idol': {
      const color = pick(tone, [0xf27aa6, 0x6fb6f0, 0x6fd0b0, 0xf6c84c])
      top = sleeve = color
      lower = white
      skirtWidth = 26
      skirtLength = 8
      legs = socks = white
      shoes = color
      hairTie = color
      details.push(() => {
        body('girlSkirt', 0, 17, 0, 23, 6, 19, color)
        body('girlTorso', 0, 25.4, 0.3, 8.5, 1.8, 7.5, black)
        bow('body', 0, 22.5, 6.6, white, 0.9)
        hand('girlLimb', -11.5, 14.6, 2.6, 2, 5, 2, 0x5c5c6c)
        hand('girlBall', -11.5, 17.6, 3, 3.4, 3.4, 3.4, 0xc8ccd6)
        for (const side of [-1, 1]) head('girlEar', side * 12, 55.5, 9, 5, 5, 1.6, gold, side * 0.3)
      })
      break
    }
    case 'nurse': {
      top = sleeve = lower = pick(tone, [0xf6c6d4, 0xbad8f2, 0xf3f0f6, 0xbfe6d6])
      skirtWidth = 21
      cuff = white
      legs = socks = 0xf7f3f0
      shoes = white
      details.push(() => {
        body('girlTorso', 0, 25.4, 0.4, 11, 2.4, 9, white)
        head('girlCap', hx, 58, hz + 3, 18, 6, 12, white, 0, -0.35)
        head('girlTrim', hx, 58.6, hz + 9.4, 4.4, 1.3, 1, 0xe5505f, 0, -0.35)
        head('girlTrim', hx, 58.6, hz + 9.4, 1.3, 4.4, 1, 0xe5505f, 0, -0.35)
      })
      break
    }
    case 'patissier': {
      lower = pick(tone, [0x6a4535, 0x3a3448, 0x8a5a6c, 0x3e5878])
      const apron = pick(tone, [0xf5b2c4, 0x9ed2c0, 0xf6d896, 0xb9c9f2])
      skirtLength = 8
      shoes = black
      socks = white
      hat = true
      details.push(() => {
        body('girlLock', 0, 14.5, 8.3, 14, 11, 2, apron, 0, -0.3)
        body('girlTorso', 0, 25.4, 0.4, 10, 2.6, 9, apron)
        for (const y of [17, 20, 23])
          for (const x of [-2.6, 2.6]) body('girlBall', x, y, 6.3, 1.4, 1.4, 1, 0xd8d2cc)
        head('girlCap', hx, 59.5, hz - 1, 24, 6, 22, white)
        for (const [x, y, z] of [
          [-6, 64.5, -1],
          [0, 66.5, 0],
          [6, 64.5, -1],
          [0, 64, -6]
        ])
          head('girlBall', x, y, hz + z, 12, 10.5, 13, white)
      })
      break
    }
    case 'raincoat': {
      const coat = pick(tone, [0xf6cf4a, 0xee7a7a, 0x7cbfe8, 0x8acd8e])
      top = sleeve = lower = coat
      skirtWidth = 24
      skirtLength = 10
      socks = undefined
      shoes = pick(tone, [0xe25a6a, 0xf6cf4a, 0xf6cf4a, 0xe25a6a])
      hat = true
      details.push(() => {
        for (const y of [12, 16, 20, 23.5])
          body('girlBall', 0, y, y < 19 ? 9.5 - (y - 10) * 0.25 : 6.4, 1.8, 1.8, 1, 0x3a3a4a)
        head('girlHood', hx, hy, hz, 35, 31, 31, coat)
        for (const side of [-1, 1]) put('leg', 'girlLimb', side * 4, 5.6, 0.2, 5.6, 8, 5.8, shoes)
      })
      break
    }
    case 'cheer': {
      const team = pick(tone, [0xe2475a, 0x3f6fd8, 0xf08a3c, 0x8a5ad0])
      top = white
      sleeve = undefined
      lower = team
      skirtLength = 8
      shoes = white
      hairTie = team
      details.push(() => {
        body('girlTorso', 0, 21.5, 0, 16.3, 3, 12.3, team)
        body('girlSkirt', 0, 11.2, 0, 23.2, 1.6, 20, white)
        for (const side of [-1, 1])
          hand('girlBall', side * 11.6, 15.8, 1, 10, 9, 9, side > 0 ? team : gold)
      })
      break
    }
    case 'gothic': {
      top = sleeve = lower = black
      cuff = white
      skirtWidth = 25
      skirtLength = 10
      legs = socks = 0x3a3344
      shoes = black
      const ribbon = pick(tone, [0xd23a4e, 0x7a4ac8, 0x3a5ad0, 0xe86a9a])
      hairTie = ribbon
      details.push(() => {
        body('girlSkirt', 0, 10.6, 0, 26, 3, 22, white)
        body('girlTorso', 0, 25.4, 0.4, 11, 2.4, 9, white)
        bow('body', 0, 23, 6.6, ribbon, 0.9)
        head('girlHairband', hx, hy, hz, 35, 31, 31, black)
        for (const x of [-10, -5, 0, 5, 10])
          head('girlBall', x, 57.3 - Math.abs(x) * 0.15, 8.5 - Math.abs(x) * 0.35, 5, 3, 2.6, white)
        head('girlBall', -13, 55, 6, 5, 5, 4, ribbon)
      })
      break
    }
    case 'overalls': {
      const denim = pick(tone, [0x5b7bb4, 0x4a5f8a, 0xd98a6a, 0x8aa86a])
      lower = undefined
      shorts = true
      shoes = 0xc8463f
      hat = true
      details.push(() => {
        for (const y of [17, 22]) body('girlTorso', 0, y, 0, 16.2, 1.5, 12.2, 0xe5505f)
        body('girlTorso', 0, 14.5, 0, 16.4, 6, 12.4, denim)
        body('girlTrim', 0, 20.5, 5.9, 9, 6, 1.2, denim)
        for (const side of [-1, 1]) body('girlTrim', side * 4, 23.5, 3, 1.6, 5, 7, denim)
        head('girlDisc', hx, 55, hz + 1, 50, 2, 48, 0xeed39a)
        head('girlCap', hx, 58.5, hz, 31, 9, 30, 0xeed39a)
        head(
          'girlDisc',
          hx,
          56,
          hz,
          32.6,
          3.6,
          31.6,
          pick(tone, [0xe5505f, 0x6b8fe6, 0x4a8a5a, 0xf08a3c])
        )
      })
      break
    }
    case 'magical': {
      const dress = pick(tone, [0xf59ac0, 0xc4a6f0, 0x8ccaf2, 0xf8b48a])
      top = sleeve = dress
      lower = white
      skirtWidth = 26
      legs = socks = white
      shoes = dress
      hairTie = white
      details.push(() => {
        body('girlSkirt', 0, 16.5, 0, 24, 7, 20, dress)
        bow('body', 0, 22.5, 6.8, 0xe5505f, 1.3)
        hand('girlLimb', 11.5, 13, 3, 1.4, 11, 1.4, white, 0, 0.5)
        hand('girlBall', 11.5, 9.2, 5.8, 4.4, 4.4, 2.4, gold)
        for (const side of [-1, 1]) head('girlLock', side * 14, 54, -2, 3, 7, 2, white, side * -0.9)
      })
      break
    }
    case 'cardigan': {
      top = sleeve = hands = pick(tone, [0xe8d2b0, 0xf4c6d0, 0xb8cfa8, 0xc6bce6])
      lower = 0x6a6f85
      socks = 0x34406e
      details.push(() => {
        body('girlTrim', 0, 22.5, 5.8, 4, 6.5, 1, white)
        bow('body', 0, 24, 6.4, 0x6a6f85, 0.6)
        for (const y of [16.5, 19.5]) body('girlBall', 0, y, 6.5, 1.3, 1.3, 1, white)
      })
      break
    }
    case 'sporty': {
      const jacket = pick(tone, [0x4a7ee0, 0xe2475a, 0x3faa7a, 0x3a3448])
      top = sleeve = jacket
      lower = undefined
      shorts = true
      shoes = white
      hairTie = white
      details.push(() => {
        body('girlTrim', 0, 19.5, 6.3, 1, 12, 1, white)
        for (const side of [-1, 1])
          hand('girlLimb', side * 11.6, 21, 1.6, 1, 8, 1, white, side * 0.25)
        head('girlHairband', hx, hy, hz, 35, 31, 31, white)
      })
      break
    }
    case 'artist': {
      top = sleeve = lower = pick(tone, [0xa9cde8, 0xf3e6c4, 0xb2dcc0, 0xf4c6d0])
      skirtWidth = 22
      shoes = 0x9b6b47
      hat = true
      details.push(() => {
        for (const [x, y, color] of [
          [-4, 14, 0xe5505f],
          [3, 11, 0x4a7ee0],
          [5, 18, gold]
        ] as const)
          body('girlBall', x, y, y < 19 ? 9.6 - (y - 10) * 0.28 : 6.4, 2.2, 2.2, 1, color)
        bow('body', 0, 23.5, 6.4, 0xe5505f, 0.6)
        const beret = pick(tone, [0xd84a5a, 0x3a3448, 0x4a6ac8, 0x6a8a4a])
        head('girlCap', -2.5, 57.8, hz, 36, 9, 34, beret, 0.2)
        head('girlLimb', -4, 62.5, hz, 1.4, 3, 1.4, beret, 0.2)
        hand('girlLimb', 11.5, 14, 2.5, 1.2, 9, 1.2, 0xc89a6a, 0, 0.4)
      })
      break
    }
    case 'china': {
      const silk = pick(tone, [0xd8384a, 0x3f5fbf, 0x2f9a7a, 0xf08ab0])
      top = sleeve = lower = silk
      skirtWidth = 18
      skirtLength = 13
      socks = undefined
      shoes = black
      hairTie = gold
      details.push(() => {
        body('girlTorso', 0, 25.5, 0.3, 9, 2.4, 8, gold)
        body('girlTrim', 2.6, 22.5, 5.8, 1, 6, 1, gold, -0.6)
        for (const side of [-1, 1]) head('girlLock', side * 11.5, 46, -4, 2.6, 8, 2.6, 0xe5505f)
      })
      break
    }
    case 'princess': {
      const gown = pick(tone, [0xf7b8cc, 0xaad2f2, 0xf6e29a, 0xcdb6ee])
      top = sleeve = lower = gown
      skirtWidth = 30
      skirtLength = 15
      socks = undefined
      shoes = gown
      hat = true
      details.push(() => {
        body('girlSkirt', 0, 14, 0, 26, 10, 22, white)
        body('girlSkirt', 0, 16, 0, 24, 7, 20, gown)
        for (const side of [-1, 1]) body('girlBall', side * 8.5, 24.5, 0, 7.5, 6.5, 7.5, white)
        for (const [x, h] of [
          [-6, 3.5],
          [0, 5.5],
          [6, 3.5]
        ])
          head('girlEar', x, 58.2 + h / 2, 7 - Math.abs(x) * 0.4, 4.4, h, 2, gold)
        head('girlBall', hx, 59, 9.5, 2.6, 2.6, 2, 0xe5505f)
      })
      break
    }
    case 'catgirl': {
      top = sleeve = hands = pick(tone, [0xf3ead8, 0x9a9aaa, 0x3a3448, 0xf4c6d0])
      lower = top
      skirtWidth = 21
      skirtLength = 7
      socks = 0x3a3448
      shoes = 0x3a3448
      details.push(() => {
        body('girlTorso', 0, 25.4, 0.3, 9, 2, 8, 0xe5505f)
        body('girlBall', 0, 24, 5.4, 2.6, 2.6, 2.6, gold)
        for (const side of [-1, 1]) {
          head('girlEar', side * 10.5, 59.5, hz - 1, 10, 11, 5, hair, side * -0.32)
          head('girlEar', side * 10.5, 59, hz + 0.4, 5.5, 6.5, 3.4, pink, side * -0.32)
        }
        for (const [y, z, p] of [
          [12.5, -8.5, 1.1],
          [16, -12.5, 0.3],
          [21.5, -12.8, -0.35]
        ])
          body('girlLimb', 0, y, z, 3.6, 7, 3.6, hair, 0, p)
      })
      break
    }
    case 'bunny': {
      top = sleeve = lower = pick(tone, [0xf8dce4, 0xddd0f4, 0xcfeedd, 0xf6ead0])
      lower = undefined
      shorts = true
      socks = undefined
      shoes = 0xf49ab4
      hands = top
      details.push(() => {
        body('girlTorso', 0, 14, 0, 16, 6.5, 12.2, top)
        body('girlBall', 0, 14.5, -7, 6, 6, 6, white)
        body('girlTrim', 0, 18.5, 6.4, 7, 5, 1, white)
        for (const side of [-1, 1]) {
          head('girlLock', side * 5.5, 66, -1, 6.5, 19, 3.4, white, side * -0.14)
          head('girlLock', side * 5.5, 65, 0.2, 3.4, 13, 2.8, pink, side * -0.14)
        }
      })
      break
    }
    case 'winter': {
      const coat = pick(tone, [0xc79a62, 0xc8505a, 0x3c4a78, 0xefe6d6])
      const scarf = pick(tone, [0xe5505f, 0xf2e2b0, 0xf2c55c, 0x5a8ad0])
      top = sleeve = lower = coat
      skirtWidth = 23
      skirtLength = 10
      hands = scarf
      socks = undefined
      shoes = 0x8a5a3e
      hat = true
      details.push(() => {
        for (const y of [13, 17, 21])
          body('girlTrim', 0, y, y < 19 ? 9 - (y - 10) * 0.2 : 6.3, 1.2, 3, 1.4, 0xf2e2b0)
        body('girlTorso', 0, 25.8, 0.6, 15.5, 4.6, 13.5, scarf)
        body('girlTrim', 4, 21, 6.6, 3.6, 7, 1.6, scarf, 0.1)
        head('girlCap', hx, 56, hz - 0.5, 37.5, 15, 36, scarf)
        head('girlCuff', hx, hy, hz, 35, 31, 31, scarf)
        head('girlBall', hx, 64, hz - 2, 9, 9, 9, white)
        for (const side of [-1, 1]) put('leg', 'girlLimb', side * 4, 5.6, 0.3, 5.6, 8, 5.8, shoes)
      })
      break
    }
    case 'explorer': {
      top = sleeve = 0xc8b07a
      lower = undefined
      shorts = true
      shoes = 0x7b4b3a
      hat = true
      const pack = pick(tone, [0x6a8a4a, 0xc8584a, 0x4a6ac8, 0xd8a03a])
      details.push(() => {
        body('girlTorso', 0, 14, 0, 16.4, 6, 12.4, 0x8a6a4a)
        for (const side of [-1, 1]) body('girlTrim', side * 4.5, 20.5, 6.1, 3.4, 3, 1, 0xa88e5a)
        body('girlBall', 0, 19.5, -8, 13, 13, 7, pack)
        body('girlTrim', 0, 22.5, -11, 10, 4, 1.4, pack)
        for (const side of [-1, 1]) body('girlTrim', side * 4.6, 21, 5.4, 1.4, 9, 2, pack)
        // A field cap with a forward visor, unlike the farm girl's straw hat.
        head('girlCap', hx, 56.5, hz - 0.5, 37.5, 13, 36, pack)
        head('girlDisc', hx, 52, hz + 15.5, 24, 2, 11, pack, 0, -0.15)
        head('girlBall', hx, 56, hz + 17.5, 5, 4, 1.6, gold)
      })
      break
    }
    case 'traveller': {
      // The white-hooded traveller from this article's illustration, as a cheerful girl.
      top = sleeve = lower = 0xf6f5ff
      skirtLength = 14
      skirtWidth = 23
      legs = socks = 0xf6f5ff
      shoes = 0x1d2236
      hat = true
      details.push(() => {
        for (const y of [8, 11.5, 15, 18.5, 22])
          body('girlTrim', 3.5, y, y < 19 ? 9.3 - (y - 6) * 0.28 : 6.4, 0.8, 1.8, 0.8, 0xe5505f)
        body('girlCap', 0, 21.5, 6.6, 3, 2.4, 2.4, 0x8e79d6)
        head('girlHood', hx, hy, hz, 35, 31, 31, 0xf6f5ff)
        for (const [x, y, a] of [
          [11, 56, -0.9],
          [15, 52, -1.2],
          [8, 59, -0.6]
        ])
          head('girlLock', x, y, 9, 5, 11, 3.5, hair, a)
      })
      break
    }
  }

  // Legs and shoes; riding legs follow the pedals instead.
  if (riding) {
    for (const side of [-1, 1]) {
      for (const motion of ['thigh', 'shin', 'shoe'] as const) {
        const pose = bicyclePose(motion, side, 0)
        const part: PersonPart = {
          shape: motion === 'shoe' ? 'girlBall' : 'girlLimb',
          x: side * 4.5,
          y: pose.y,
          z: pose.z,
          width: motion === 'shoe' ? 6 : 4.8,
          height: pose.height,
          depth: motion === 'shoe' ? 9 : 4.8,
          color: motion === 'shoe' ? shoes : legs,
          angle: 0,
          pitch: pose.pitch,
          motion
        }
        parts.push(part)
      }
    }
  } else {
    for (const side of [-1, 1]) {
      put('leg', 'girlLimb', side * 4, 7.5, 0, 4.6, 11.5, 4.8, legs)
      if (socks !== undefined) put('leg', 'girlLimb', side * 4, 5.2, 0.1, 5, 5.6, 5.2, socks)
      put('leg', 'girlBall', side * 4, 2.4, 1.2, 6, 4.8, 9, shoes)
    }
  }

  // Torso, lower garment and neck.
  body('girlTorso', 0, 19.5, 0, 16, 13, 12, top)
  body('girlLimb', 0, 26.8, 0.4, 5, 4.5, 5, skin)
  if (lower !== undefined) {
    const length = riding ? Math.min(skirtLength, 9) : skirtLength
    body(
      'girlSkirt',
      0,
      19.5 - length / 2,
      0,
      skirtWidth + (length - 9) * 0.3,
      length,
      skirtWidth * 0.85,
      lower
    )
  } else if (shorts) body('girlTorso', 0, 13.8, 0, 15.6, 6, 11.6, top === white ? 0x4a6a9a : top)

  // Arms swing from the shoulder while walking and reach the bars while riding.
  const sleeveColor = sleeve ?? skin
  if (riding) {
    for (const side of [-1, 1]) {
      const [y, z] = rotate(personShoulderHeight - 1, 0, personHipHeight, ridingLean)
      const shoulder = { y: y + saddle.y - personHipHeight, z: z + saddle.z }
      const elbow = {
        y: (shoulder.y + bicycleGrip.y) / 2 - 2.5,
        z: (shoulder.z + bicycleGrip.z) / 2 - 1
      }
      for (const [from, to, width, color] of [
        [elbow, shoulder, wideSleeves ? 7 : 5.2, sleeveColor],
        [bicycleGrip, elbow, 4.2, hands === skin ? skin : sleeveColor]
      ] as const) {
        const pose = bicycleSegment(from, to)
        parts.push({
          shape: 'girlLimb',
          x: side * 9.5,
          y: pose.y,
          z: pose.z,
          width,
          height: pose.height,
          depth: width,
          color,
          angle: 0,
          pitch: pose.pitch
        })
      }
      parts.push({
        shape: 'girlBall',
        x: side * 9.5,
        y: bicycleGrip.y + 0.5,
        z: bicycleGrip.z,
        width: 4.6,
        height: 4.6,
        depth: 4.6,
        color: hands,
        angle: 0,
        pitch: 0
      })
    }
  } else {
    for (const side of [-1, 1]) {
      const width = wideSleeves ? 8 : 5.4
      put(
        'arm',
        'girlLimb',
        side * (wideSleeves ? 10.6 : 9.8),
        21.3,
        0,
        width,
        9,
        width,
        sleeveColor,
        side * 0.25
      )
      if (sleeve === undefined)
        put('arm', 'girlBall', side * 9.4, 24, 0, 6.4, 4.6, 6.4, top, side * 0.25)
      if (cuff !== undefined)
        put(
          'arm',
          'girlLimb',
          side * 10.9,
          17.7,
          0.2,
          width + 0.4,
          2,
          width + 0.4,
          cuff,
          side * 0.25
        )
      put('arm', 'girlBall', side * 11.3, 15.9, 0.5, 4.6, 4.6, 4.6, hands)
    }
  }

  // Head: skin, painted face, hair cap with its glossy ring, and face-framing locks.
  const { width: hw, height: hh, depth: hd } = personHead
  head('girlHead', hx, hy, hz, hw, hh, hd, skin)
  head(`girlFace${eyes}` as PersonShape, hx, hy, hz, hw, hh, hd, 0xffffff)
  head(`girlHair_${bangs}`, hx, hy, hz, hw, hh, hd, hair)
  head('girlHalo', hx, hy, hz, hw, hh, hd, mix(hair, 0xffffff, 0.45))
  for (const side of [-1, 1])
    head('girlLock', side * 15.8, 35.5, hz + 4.5, 6, 16, 5, hair, side * 0.06)
  if (look.ahoge && !hat) head('girlLock', 1.5, 60, hz + 1, 2.6, 9, 2, hair, -0.55)

  switch (hairstyle) {
    case 'bob':
      head('girlHairBell', hx, 38.5, hz, 40, 22, 37, hair)
      break
    case 'long':
    case 'hime':
    case 'wavy':
    case 'halfup':
      head('girlHairBell', hx, 38, hz, 40, 23, 37, hair)
      for (const x of [-12, -6, 0, 6, 12])
        head(
          'girlLock',
          x,
          hairstyle === 'wavy' ? 30 : 29,
          -9.5 + Math.abs(x) * 0.3,
          11,
          hairstyle === 'wavy' ? 28 : 33,
          10,
          hair,
          -x * 0.012
        )
      if (hairstyle === 'wavy')
        for (const x of [-13, -4.5, 4.5, 13])
          head('girlBall', x, 17.5, -8.5 + Math.abs(x) * 0.2, 8, 7, 8, hair)
      if (hairstyle === 'hime')
        for (const side of [-1, 1]) head('girlTrim', side * 15.4, 33, hz + 4.5, 5, 13, 4.5, hair)
      if (hairstyle === 'halfup') {
        head('girlBall', hx, 53, -11, 9, 8, 8, hair)
        bow('head', hx, 53.5, -15, hairTie, 0.9)
      }
      if (role === 'miko') {
        head('girlTrim', hx, 36, -14.5, 9, 3, 3, white)
        bow('head', hx, 39, -14.5, 0xd8434f, 0.9)
      }
      break
    case 'twintails':
    case 'lowtails':
      for (const side of [-1, 1]) {
        const low = hairstyle === 'lowtails'
        head('girlBall', side * (low ? 14.5 : 16), low ? 34 : 49, low ? -5 : 0, 8, 8, 8, hair)
        head(
          'girlLock',
          side * (low ? 17 : 21),
          low ? 24 : 34.5,
          low ? -4 : -2,
          low ? 10 : 12,
          low ? 20 : 30,
          low ? 9 : 11,
          hair,
          side * (low ? 0.12 : 0.2)
        )
        bow(
          'head',
          side * (low ? 16 : 18),
          low ? 34.5 : 50,
          low ? -1 : 3.5,
          hairTie,
          low ? 0.7 : 0.85
        )
      }
      break
    case 'ponytail':
      head('girlBall', hx, 53, -13, 10, 9, 9, hair)
      head('girlLock', hx, 39, -19, 13, 28, 12, hair, 0, 0.3)
      bow('head', hx, 54, -17.5, hairTie, 0.9)
      break
    case 'sidetail':
      head('girlBall', 16.5, 50, -1, 9, 9, 9, hair)
      head('girlLock', 21.5, 35.5, -1.5, 13, 28, 11, hair, 0.22)
      bow('head', 17.5, 51.5, 3.5, hairTie, 1.1)
      break
    case 'buns':
      for (const side of [-1, 1]) {
        head('girlBall', side * 11.5, 57, hz - 3, 12, 11.5, 12, hair)
        if (role === 'china') head('girlCap', side * 11.5, 58, hz - 3, 13, 6, 13, white)
        else bow('head', side * 13, 54.5, hz + 3, hairTie, 0.6)
      }
      head('girlHairBell', hx, 39, hz, 39, 18, 36, hair)
      break
    case 'drills':
      for (const side of [-1, 1]) {
        head('girlBall', side * 16, 49, -1, 8, 8, 8, hair)
        for (let i = 0; i < 4; i++)
          head(
            'girlBall',
            side * (19 + i * 0.4),
            43 - i * 6,
            -2,
            9.5 - i * 1.4,
            7.5,
            9.5 - i * 1.4,
            hair
          )
        bow('head', side * 17, 50, 3, hairTie, 0.85)
      }
      break
    case 'braids':
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++)
          head(
            'girlBall',
            side * (14 - i * 0.6),
            31 - i * 4.6,
            -1 + i * 2.2,
            7 - i * 0.4,
            6.2,
            7 - i * 0.4,
            hair
          )
        bow('head', side * 12.4, 14.8, 7.4, hairTie, 0.6)
      }
      break
    default:
      for (const x of [-7, 0, 7]) head('girlLock', x, 31, -10.5, 9, 10, 7, hair, x * -0.02, -0.25)
  }

  for (const detail of details) detail()
  return parts
}

function mix(a: number, b: number, t: number) {
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift
  return channel(16) | channel(8) | channel(0)
}
