import { bicycleGrip, bicyclePose, bicycleSegment, type CyclingMotion } from './town-bicycle-pose'
import { townPersonAppearance, townPersonStyle } from './town-person'
import { headPoint, type PersonShape, personFace } from './town-person-geometry'

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
  // Unlit neon: lenses, seams and LEDs that glow at night.
  glow?: boolean
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
  const neon: number = traveller ? 0x6fe8ff : look.neon
  const parts: PersonPart[] = []
  let glowing = false
  // Parts put inside are drawn as neon.
  const lit = (draw: () => void) => {
    glowing = true
    draw()
    glowing = false
  }

  const put = (
    frame: Frame,
    ...[shape, x, y, z, width, height, depth, color, angle = 0, pitch = 0]: PartArgs
  ) => {
    if (frame === 'head') {
      // Riders lift their heads against the lean, so hat brims and fringes sit the same.
      const tilt = riding ? personHeadTilt - ridingLean : personHeadTilt
      ;[y, z] = rotate(y, z, neckHeight, tilt)
      pitch += tilt
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
    if (glowing) part.glow = true
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
  const { width: hw, height: hh, depth: hd } = personHead
  // Eye covers are shaped on the head surface, so they share the head's placement.
  const cover = (shape: PersonShape, color: number) => head(shape, hx, hy, hz, hw, hh, hd, color)
  // A point on the head surface at an angle and height in head units, for trims on covers.
  const onFace = (a: number, y: number, inflate: number) => {
    const [x, py, z] = headPoint(a, Math.asin(y * 2), inflate)
    return [hx + x * hw, hy + py * hh, hz + z * hd] as const
  }
  const glasses = (frame: number, lens: number) => {
    for (const side of ['L', 'R'] as const) {
      cover(`girlRim${side}`, frame)
      // Every lens doubles as a HUD and lights up from inside.
      lit(() => cover(`girlLens${side}`, lens))
    }
    head('girlTrim', 0, 40.6, 19.4, 4.4, 0.8, 0.8, frame)
  }

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
        lit(() => {
          for (const y of [17.5, 20]) body('girlBall', 2.6, y, 6.3, 1.4, 1.4, 1, neon)
        })
        // Round smart glasses with a HUD in her neon.
        glasses(black, mix(neon, white, 0.55))
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
        lit(() => body('girlTrim', 0, 15.5, 7.2, 7, 0.6, 0.4, neon))
        glasses(white, mix(neon, 0x1c2030, 0.55))
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
        // An android maid: a status lamp on the headdress and a lit apron hem.
        lit(() => {
          head('girlBall', 0, 57.8, 10.2, 2.6, 2.6, 1.6, neon)
          body('girlTrim', 0, 9.6, 10.6, 12, 0.6, 0.6, neon, 0, -0.32)
        })
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
        // An onmyoji's paper face cloth, marked with a red seal.
        cover('girlCloth', white)
        for (const [size, color, inflate] of [
          [6, 0xd8434f, 1.08],
          [4, white, 1.09],
          [1.8, 0xd8434f, 1.1]
        ] as const)
          head('girlBall', ...onFace(0, -0.08, inflate), size, size, 0.6, color)
        // The seal is a hologram projected onto the cloth.
        lit(() => head('girlBall', ...onFace(0, -0.08, 1.11), 1.8, 1.8, 0.6, 0xff4a6a))
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
        // A festival fox mask with red markings.
        cover('girlFox', white)
        for (const side of [-1, 1]) {
          lit(() => head('girlTrim', side * 7.3, 39.8, 18.9, 5.4, 1.2, 0.8, 0xff4a6a, side * 0.35))
          head('girlEar', side * 8.5, 50.5, 15.5, 6, 7, 3, white, side * -0.2, -0.3)
          head('girlEar', side * 8.5, 50.2, 16.6, 3, 4, 2, 0xd8434f, side * -0.2, -0.3)
        }
        lit(() => head('girlBall', 0, 46, 18.8, 2.2, 3, 1, 0xff4a6a))
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
        // Pulled low, so the drooping brim shades the eyes.
        head('girlDisc', hx, 48.5, hz + 1, 52, 2.4, 50, 0x29243a, 0, 0.25)
        head('girlCone', hx, 63.5, hz - 2, 32, 26, 32, 0x29243a, 0, -0.18)
        // A techno-witch: a neon hat band and a staff tipped with a plasma orb.
        lit(() => head('girlDisc', hx, 53.2, hz - 1.2, 31.6, 3, 31.6, neon, 0, -0.18))
        hand('girlLimb', 11.5, 12, 3, 1.4, 12, 1.4, 0x5a6070, 0, 0.5)
        lit(() => hand('girlBall', 11.5, 8, 6, 3.4, 3.4, 3.4, neon))
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
        // A virtual idol: a glowing mic and holographic star clips.
        lit(() => {
          hand('girlBall', -11.5, 17.6, 3, 3.4, 3.4, 3.4, mix(color, white, 0.4))
          for (const side of [-1, 1])
            head('girlEar', side * 12, 55.5, 9, 5, 5, 1.6, mix(color, white, 0.5), side * 0.3)
        })
        // Tinted stage glasses in her member color.
        glasses(white, mix(color, white, 0.35))
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
        // A med-bay nurse: the cross is a lit panel.
        lit(() => {
          head('girlTrim', hx, 58.6, hz + 9.4, 4.4, 1.3, 1, 0xff4a6a, 0, -0.35)
          head('girlTrim', hx, 58.6, hz + 9.4, 1.3, 4.4, 1, 0xff4a6a, 0, -0.35)
        })
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
          for (const x of [-2.6, 2.6]) lit(() => body('girlBall', x, y, 6.3, 1.4, 1.4, 1, neon))
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
        // LED snaps for walking home in the dark.
        lit(() => {
          for (const y of [12, 16, 20, 23.5])
            body('girlBall', 0, y, y < 19 ? 9.5 - (y - 10) * 0.25 : 6.4, 1.8, 1.8, 1, neon)
        })
        head('girlCowl', hx, hy, hz, 35, 31, 31, coat)
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
        // Light-up pom-pom cores.
        lit(() => {
          for (const side of [-1, 1]) hand('girlBall', side * 11.6, 15.8, 4.2, 4, 4, 4, neon)
        })
        // Star-shaped party glasses.
        for (const side of ['L', 'R'] as const) {
          cover(`girlStarRim${side}`, team)
          lit(() => cover(`girlStar${side}`, 0xfff0a0))
        }
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
        // A black lace blindfold tied with her ribbon.
        cover('girlShades', black)
        cover('girlStrap', black)
        // Its lace is fibre optic.
        lit(() => {
          for (const x of [-11, -5.5, 0, 5.5, 11])
            head(
              'girlBall',
              x,
              37.2,
              18.6 - Math.abs(x) * 0.33,
              3.6,
              2,
              1.6,
              mix(ribbon, white, 0.4)
            )
        })
        bow('head', 15.5, 40, 4, ribbon, 0.7)
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
        // The straw hat sits low enough to shade her eyes.
        head('girlDisc', hx, 49, hz + 1, 54, 2, 52, 0xeed39a, 0, 0.22)
        head('girlCap', hx, 55.5, hz, 33, 12, 32, 0xeed39a)
        // A hydroponics farmer's hat, banded with grow-light.
        lit(() => head('girlDisc', hx, 52, hz, 32.6, 3.6, 31.6, neon))
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
        lit(() => hand('girlBall', 11.5, 9.2, 5.8, 4.4, 4.4, 2.4, mix(dress, white, 0.45)))
        for (const side of [-1, 1]) head('girlLock', side * 14, 54, -2, 3, 7, 2, white, side * -0.9)
        // A masquerade mask with jewels on its wings.
        cover('girlDomino', pick(tone, [0x6a3a8a, 0x2f3c66, 0xb03a6a, 0x3a3448]))
        lit(() => {
          for (const side of [-1, 1]) head('girlBall', side * 12.2, 47, 14, 2.6, 2.6, 2, neon)
        })
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
        glasses(0x8a5a3e, mix(neon, white, 0.7))
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
        // Wraparound sports sunglasses with a mirrored stripe.
        cover('girlShades', 0x2a3048)
        lit(() => {
          head('girlTrim', 0, 41.5, 18.5, 14, 0.8, 0.6, neon)
          body('girlTrim', 0, 19.5, 6.6, 0.4, 11, 0.4, neon)
        })
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
          lit(() =>
            body('girlBall', x, y, y < 19 ? 9.6 - (y - 10) * 0.28 : 6.4, 2.2, 2.2, 1, color)
          )
        // A light pen instead of a brush.
        lit(() => hand('girlBall', 11.5, 9.6, 4.4, 1.6, 1.6, 1.6, neon))
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
        // Little round kung-fu sunglasses.
        glasses(gold, mix(0xff4a6a, 0x2a2632, 0.35))
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
        lit(() => head('girlBall', hx, 59, 9.5, 2.6, 2.6, 2, neon))
        // A lace veil falls from the tiara, edged with pearls.
        cover('girlVeil', 0xfbf6f4)
        // Nothing hangs in front of the mouth.
        for (const a of [-0.9, -0.6, -0.3, 0.3, 0.6, 0.9])
          head('girlBall', ...onFace(a, -0.255, 1.11), 2, 2, 1.2, white)
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
        lit(() => body('girlBall', 0, 24, 5.4, 2.6, 2.6, 2.6, neon))
        for (const side of [-1, 1]) {
          head('girlEar', side * 10.5, 59.5, hz - 1, 10, 11, 5, hair, side * -0.32)
          // Cyber cat ears with lit inner panels.
          lit(() => head('girlEar', side * 10.5, 59, hz + 0.4, 5.5, 6.5, 3.4, neon, side * -0.32))
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
          lit(() => {
            head('girlLock', side * 5.5, 65, 0.2, 3.4, 13, 2.8, neon, side * -0.14)
            // Sleepy eyes shown on the display of her sleep mask.
            head('girlTrim', side * 7.3, 39.2, 18.6, 4.5, 0.9, 0.6, neon, side * -0.2)
          })
        }
        cover('girlShades', 0xf8c6d6)
        cover('girlStrap', 0xf8c6d6)
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
        // Ski goggles worn over the beanie.
        cover('girlStrap', 0x3a3448)
        lit(() => cover('girlShades', pick(tone, [0xf2a24a, 0x6fc0e8, 0xb48ae8, 0x7ad0a0])))
        head('girlTrim', -4, 42, 18.4, 7, 0.8, 0.6, white, 0.25)
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
        lit(() => head('girlBall', hx, 56, hz + 17.5, 5, 4, 1.6, neon))
        // Scanner goggles on a leather strap.
        cover('girlStrap', 0x7b4b3a)
        glasses(gold, mix(neon, 0x9fd4e0, 0.5))
      })
      break
    }
    case 'astronaut': {
      const suit = 0xf3f1ec
      const accent = pick(tone, [0xe8605a, 0x4f7fe0, 0xf2a24a, 0x52c1d6])
      top = sleeve = lower = legs = suit
      hands = 0xd8d6d0
      skirtLength = 8
      skirtWidth = 22
      socks = undefined
      shoes = 0xb8bcc6
      hat = true
      details.push(() => {
        body('girlTrim', 0, 19, 6.4, 8, 5, 1.2, 0xc8ccd6)
        for (const [x, color] of [
          [-2.2, accent],
          [0, gold],
          [2.2, 0x52c1d6]
        ] as const)
          lit(() => body('girlBall', x, 19.5, 7, 1.6, 1.6, 1, color))
        body('girlBall', 0, 19, -8, 13, 15, 8, 0xe2e0da)
        body('girlDisc', 0, 27, 0.4, 20, 3, 18, accent)
        // A roomy helmet with its gold sun visor pulled down.
        head('girlHelmet', hx, hy, hz, hw, hh, hd, white)
        cover('girlSunVisor', 0xf2b84a)
        head('girlBall', ...onFace(-0.6, 0.3, 1.33), 3, 1.6, 1, white)
        head('girlLimb', 14, 62, 2, 1.2, 8, 1.2, 0xc8ccd6, -0.3)
        lit(() => head('girlBall', 15.2, 66, 2, 2.6, 2.6, 2.6, accent))
      })
      break
    }
    case 'jiangshi': {
      const robe = pick(tone, [0x2f4a7a, 0x6a2a3a, 0x2f5a4a, 0x4a3a6a])
      top = sleeve = lower = robe
      wideSleeves = true
      cuff = 0xf2e2b0
      skirtLength = 15
      skirtWidth = 20
      socks = white
      shoes = black
      hat = true
      details.push(() => {
        body('girlTorso', 0, 25.6, 0.3, 9, 2.4, 8, gold)
        body('girlTrim', 3, 21, 6.2, 1.2, 9, 1, gold, -0.4)
        // A Qing official's cap with a red knob, and the talisman that holds her still.
        head('girlDisc', hx, 54.5, hz - 1, 38, 3, 37, 0x2a2632)
        head('girlCap', hx, 58, hz - 1, 31, 9, 30, 0x2a2632)
        head('girlBall', hx, 63, hz - 1, 5, 5, 5, 0xd8434f)
        cover('girlOfuda', 0xf2d65c)
        for (const [y, width, height] of [
          [0.2, 7, 1.1],
          [0.08, 1.1, 5],
          [-0.02, 6, 1.1],
          [-0.13, 1.1, 4]
        ])
          lit(() => head('girlTrim', ...onFace(0, y, 1.1), width, height, 0.6, 0xff4a6a))
      })
      break
    }
    case 'cyborg': {
      const glow = pick(tone, [0x5ef0e6, 0xff5ca8, 0x9cff5c, 0xffb84a])
      top = sleeve = lower = 0x2a2f3a
      skirtLength = 7
      legs = 0x3a4050
      socks = undefined
      shoes = 0xe8ecf2
      hands = 0xc8ccd6
      details.push(() => {
        lit(() => {
          for (const side of [-1, 1]) body('girlTrim', side * 4, 19, 6.2, 0.8, 11, 0.6, glow)
          body('girlTorso', 0, 13.6, 0, 16.2, 1, 12.2, glow)
        })
        // A wraparound visor with a running row of lights.
        cover('girlVisor', 0x1c2030)
        lit(() => {
          for (let a = -0.75; a < 0.8; a += 0.25)
            head('girlBall', ...onFace(a, -0.09, 1.11), 2.4, 1.3, 0.8, glow)
        })
        for (const side of [-1, 1]) {
          head('girlBall', side * 17.5, 40, 3, 5, 7, 7, 0xc8ccd6)
          head('girlLimb', side * 18.5, 48, 2, 1, 10, 1, 0xc8ccd6, side * -0.15)
          lit(() => head('girlBall', side * 19.3, 53, 2, 2.2, 2.2, 2.2, glow))
        }
      })
      break
    }
    case 'steampunk': {
      const fabric = pick(tone, [0x7a2f3a, 0x3a4a6a, 0x4a3a2a, 0x2f4a3a])
      top = sleeve = 0xf3e6d0
      lower = fabric
      skirtWidth = 25
      skirtLength = 11
      socks = 0x3a2f2a
      shoes = 0x5a3a2a
      hat = true
      details.push(() => {
        body('girlTorso', 0, 17.5, 0, 16.6, 7, 12.6, 0x6a4535)
        for (const y of [15.5, 18, 20.5]) body('girlTrim', 0, y, 6.9, 4, 0.6, 0.6, gold)
        body('girlBall', 4, 23, 6.4, 3, 3, 1.2, 0xb8863a)
        lit(() => body('girlBall', 4, 23, 7, 1.4, 1.4, 0.6, 0xffb84a))
        // A small top hat, and enormous brass goggles over the eyes.
        head('girlDisc', -1, 58.5, hz - 2, 32, 2, 31, 0x3a2f2a, 0.15)
        head('girlLimb', -2, 65, hz - 2, 20, 14, 19, 0x3a2f2a, 0.15)
        head('girlLimb', -1.4, 60.5, hz - 2, 20.6, 3, 19.6, fabric, 0.15)
        cover('girlStrap', 0x6a4535)
        for (const side of ['L', 'R'] as const) {
          cover(`girlBigRim${side}`, 0xb8863a)
          lit(() =>
            cover(`girlBigLens${side}`, pick(tone, [0x6fd0c0, 0xf2a24a, 0x8ab8f0, 0x9be07a]))
          )
        }
        for (const side of [-1, 1])
          head('girlBall', ...onFace(side * 0.52, 0.02, 1.09), 2.6, 2.6, 1, 0xfffaf0)
      })
      break
    }
    case 'knight': {
      const steel = 0xc8ced8
      const heraldry = pick(tone, [0x3a5ad0, 0xc8384a, 0x2f8a5a, 0x6a4ac8])
      top = sleeve = 0xb8c0cc
      lower = heraldry
      skirtLength = 10
      legs = socks = shoes = hands = 0x8a92a0
      hat = true
      details.push(() => {
        body('girlLock', 0, 15, 8.3, 11, 12, 2, heraldry, 0, -0.3)
        lit(() => {
          body('girlTrim', 0, 16, 9, 1.4, 7, 0.6, neon, 0, -0.3)
          body('girlTrim', 0, 17, 8.7, 5, 1.4, 0.6, neon, 0, -0.3)
        })
        for (const side of [-1, 1]) body('girlBall', side * 9.5, 24.5, 0, 7, 5, 7, steel)
        // A closed helm with a plume and breathing slits.
        head('girlCowl', hx, hy, hz, hw, hh, hd, steel)
        // A mecha pilot's helm: the slits glow, and so does the crest.
        lit(() => {
          for (let a = -0.5; a < 0.6; a += 0.25)
            head('girlTrim', ...onFace(a, 0.02, 1.215), 3.4, 1.1, 0.6, neon)
        })
        head('girlTrim', ...onFace(0, 0.24, 1.21), 1.6, 8, 1.6, 0xdfe4ea)
        head('girlLock', 0, 61.5, -3, 5, 16, 5, heraldry, 0, 0.7)
      })
      break
    }
    case 'mummy': {
      const wrap = 0xefe6d0
      top = sleeve = lower = hands = legs = wrap
      skirtLength = 9
      skirtWidth = 21
      socks = undefined
      shoes = 0xd8ccb0
      details.push(() => {
        for (const [y, tilt] of [
          [11, 0.12],
          [15.5, -0.1],
          [20, 0.08],
          [23.5, -0.12]
        ])
          body('girlTorso', 0, y, 0, 16.6, 1.3, 12.6, 0xd8ccb0, tilt)
        body('girlTrim', 6, 9, 7, 2, 8, 0.6, wrap, 0.3)
        // Loose bandages wound over the eyes, one tail fluttering free.
        head('girlBandage', hx, hy, hz, hw, hh, hd, wrap, 0.08)
        head('girlBandage', hx, hy + 4.5, hz, hw + 0.6, hh + 0.6, hd + 0.6, 0xe4d9be, -0.1)
        head('girlTrim', 17.5, 36, 3, 1, 9, 3, wrap, 0.4)
        // Cryo-sleep wraps, with a status light peeking between the bands.
        lit(() => head('girlBall', ...onFace(0.35, 0.04, 1.14), 2.6, 1.2, 0.8, neon))
      })
      break
    }
    case 'pirate': {
      const coat = pick(tone, [0x7a2f3a, 0x2f3c66, 0x2a2632, 0x2f5a48])
      top = white
      sleeve = cuff = white
      lower = undefined
      shorts = true
      socks = undefined
      shoes = 0x3a2a22
      hat = true
      details.push(() => {
        for (const side of [-1, 1]) body('girlTrim', side * 4.6, 19, 6, 4, 10, 1, coat)
        body('girlTorso', 0, 14, 0, 16.4, 3, 12.4, 0xc8384a)
        body('girlTrim', 5, 10.5, 6.6, 2.4, 6, 0.8, 0xc8384a, 0.2)
        body('girlTorso', 0, 13.8, 0, 15.6, 6, 11.6, 0x2a2632)
        for (const side of [-1, 1]) put('leg', 'girlLimb', side * 4, 5.6, 0.3, 5.6, 8, 5.8, shoes)
        // A tricorne with a skull, and an eyepatch where the fringe doesn't reach.
        head('girlDisc', hx, 55.5, hz - 1, 42, 2.4, 40, 0x2a2632)
        head('girlCap', hx, 58.5, hz - 1, 31, 8, 30, 0x2a2632)
        // A space pirate: a lit skull, and a targeting LED on the eyepatch.
        lit(() => head('girlBall', 0, 58, hz + 14, 4.4, 4, 1.6, neon))
        cover('girlLensL', 0x1c1a22)
        lit(() =>
          head(
            'girlBall',
            ...onFace(-personFace.eyeAngle, personFace.eyeY, 1.08),
            1.8,
            1.8,
            0.6,
            0xff3a4a
          )
        )
        head('girlTrim', ...onFace(-0.05, 0.1, 1.06), 18, 0.9, 0.8, 0x1c1a22, 0.45)
      })
      break
    }
    case 'fortune': {
      const robe = pick(tone, [0x6a3a8a, 0x2f4a6a, 0x8a2f4a, 0x2f6a5a])
      top = sleeve = lower = robe
      wideSleeves = true
      skirtLength = 14
      skirtWidth = 24
      socks = undefined
      shoes = gold
      hairTie = gold
      details.push(() => {
        body('girlTorso', 0, 18.6, 0, 17, 3, 12.8, gold)
        lit(() => hand('girlBall', 11.5, 13, 5, 7, 7, 7, mix(neon, white, 0.5)))
        // A gauze veil hung with coins under a jewelled circlet.
        head('girlHairband', hx, hy, hz, hw, hh, hd, gold)
        lit(() => head('girlBall', ...onFace(0, 0.2, 1.13), 3.4, 3.4, 1.4, neon))
        cover('girlVeil', mix(robe, white, 0.3))
        // Nothing hangs in front of the mouth.
        for (const a of [-0.9, -0.6, -0.3, 0.3, 0.6, 0.9])
          head('girlBall', ...onFace(a, -0.255, 1.11), 2.4, 2.4, 0.8, gold)
      })
      break
    }
    case 'gamer': {
      const glow = pick(tone, [0x5ef0e6, 0xff5ca8, 0x9cff5c, 0xb48ae8])
      top = sleeve = hands = pick(tone, [0x3a3448, 0xf4c6d0, 0x8ad0c0, 0xf2e2b0])
      lower = undefined
      shorts = true
      shoes = white
      details.push(() => {
        body('girlBall', 0, 25, -6.8, 15, 7.5, 8, top)
        body('girlTrim', 0, 15.5, 6.6, 9, 3.6, 1, mix(top, black, 0.2))
        for (const side of [-1, 1]) body('girlTrim', side * 2.4, 21.6, 6.9, 0.9, 5, 0.9, white)
        // A chunky VR headset with a glowing front.
        cover('girlStrap', 0x3a3448)
        head('girlTrim', hx, 41.5, 17, 30, 8.5, 8, 0xf3f1ef)
        head('girlTrim', hx, 41.5, 21.1, 26, 6, 0.4, 0x1c2030)
        lit(() => head('girlTrim', hx, 41.5, 21.4, 18, 1.2, 0.4, glow))
      })
      break
    }
    case 'diver': {
      const fin = pick(tone, [0xf2c55c, 0xe8605a, 0x52c1d6, 0x9be07a])
      top = sleeve = legs = hands = 0x2a3040
      lower = undefined
      shorts = true
      socks = undefined
      shoes = fin
      details.push(() => {
        lit(() => {
          body('girlTrim', 0, 19, 6.3, 1.2, 12, 0.8, fin)
          for (const side of [-1, 1]) body('girlTrim', side * 7.8, 19, 0, 0.8, 12, 6, fin)
        })
        for (const side of [-1, 1]) put('leg', 'girlBall', side * 4, 1.4, 5, 7, 2.4, 14, fin)
        // A diving mask and snorkel.
        cover('girlStrap', 0x2a3040)
        cover('girlDiveRim', 0x2a3040)
        cover('girlDivePane', 0x9fd8ec)
        head('girlTrim', ...onFace(-0.35, 0.03, 1.12), 6, 1, 0.5, white, 0.35)
        head('girlLimb', 17.5, 47, 6, 2.4, 18, 2.4, fin)
        head('girlBall', 17.5, 56, 6, 3, 3, 3, fin)
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
          lit(() =>
            body('girlTrim', 3.5, y, y < 19 ? 9.3 - (y - 6) * 0.28 : 6.4, 0.8, 1.8, 0.8, 0xe5505f)
          )
        body('girlCap', 0, 21.5, 6.6, 3, 2.4, 2.4, 0x8e79d6)
        head('girlCowl', hx, hy, hz, 35, 31, 31, 0xf6f5ff)
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
  head('girlHead', hx, hy, hz, hw, hh, hd, skin)
  head(`girlFace${eyes}` as PersonShape, hx, hy, hz, hw, hh, hd, 0xffffff)
  head(`girlHair_${bangs}`, hx, hy, hz, hw, hh, hd, hair)
  // The glossy ring is a neon streak dyed into the hair.
  lit(() => head('girlHalo', hx, hy, hz, hw, hh, hd, mix(neon, 0xffffff, 0.2)))
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

  // Everyone wears the town's cyber kit: ear modules, a neon waistline, light bands on
  // the sleeves and glowing soles. Riding limbs are posed apart, so they go without.
  if (role !== 'cyborg')
    for (const side of [-1, 1]) {
      // Thick enough to clear the fullest hair and still meet a cropped cut.
      head('girlDisc', side * 21.2, 43, hz + 1, 8, 4.2, 8, 0x2a2f3a, side * (Math.PI / 2))
      lit(() =>
        head('girlDisc', side * 23.4, 43, hz + 1, 4.8, 0.6, 4.8, neon, side * (Math.PI / 2))
      )
      // One antenna, on the right.
      if (side > 0 && tone % 2) {
        head('girlLimb', 22.4, 49, hz + 1, 0.9, 9, 0.9, 0x8a92a0, -0.2)
        lit(() => head('girlBall', 23.3, 53.5, hz + 1, 1.8, 1.8, 1.8, neon))
      }
    }
  lit(() => {
    if (lower !== undefined || shorts) body('girlTorso', 0, 19.6, 0, 16.8, 0.8, 12.8, neon)
    for (const side of [-1, 1]) {
      put('leg', 'girlBall', side * 4, 0.6, 1.2, 6.4, 1.2, 9.4, neon)
      const arm = wideSleeves ? 8 : 5.4
      put(
        'arm',
        'girlLimb',
        side * ((wideSleeves ? 10.6 : 9.8) + 0.45),
        19.6,
        0.1,
        arm + 0.5,
        0.9,
        arm + 0.5,
        neon,
        side * 0.25
      )
    }
  })
  return parts
}

function mix(a: number, b: number, t: number) {
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift
  return channel(16) | channel(8) | channel(0)
}
