import { hashSlug } from './scene-math'
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

// Coordinated cloth, dark trim and ribbon palettes, selected by article identity.
const palettes = [
  [0x739bc3, 0x303d61, 0xf0c978],
  [0xd99ab3, 0x6d405d, 0xffd7e1],
  [0x89bcb0, 0x355c65, 0xf7d59a],
  [0xb39ccb, 0x51476e, 0xedbdcf],
  [0xc98479, 0x583e4c, 0xf3cdaa],
  [0xe8c484, 0x556083, 0xa3d9db],
  [0x819db5, 0x303d55, 0xf0a4b6],
  [0xa7b980, 0x43564e, 0xf6d7aa]
] as const
const skinTones = [0xffe2d3, 0xf7d3c0, 0xe8b49b, 0xcc9279, 0xa86f5d]
const ivory = 0xfff4e6
const metal = 0xc9d9e5
const gold = 0xecc780

export function createPersonParts(variant: number, identity: string, riding = false) {
  const style = townPersonStyle(variant)
  const { role } = style
  const {
    hair: hairstyle,
    hairColor: hair,
    headwear,
    fringe,
    shortFringe
  } = townPersonAppearance(variant, identity)
  const [cloth, dark, ribbon] = palettes[(hashSlug(`top:${identity}`) >>> 8) % palettes.length]
  const skin = skinTones[(hashSlug(`skin:${identity}`) >>> 8) % skinTones.length]
  const parts: PersonPart[] = []
  const add = (
    shape: PersonPart['shape'],
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: number,
    angle = 0,
    pitch = 0
  ) => {
    const part: PersonPart = { shape, x, y, z, width, height, depth, color, angle, pitch }
    parts.push(part)
    return part
  }
  const lift = riding ? 10 : 0
  const lean = riding ? -7 : 0
  const piece = (
    shape: PersonPart['shape'],
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    angle = 0,
    pitch = 0
  ) => add(shape, x, y + lift, z + lean, w, h, d, color, angle, pitch)
  const round = (x: number, y: number, z: number, w: number, h: number, d: number, c: number) =>
    piece('girlRound', x, y, z, w, h, d, c)
  const trim = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: number,
    angle = 0
  ) => piece('girlTrim', x, y, z, w, h, d, c, angle)
  const lock = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    angle = 0,
    c: number = hair
  ) => piece('girlLock', x, y, z, w, h, d, c, angle)
  const bow = (x: number, y: number, z: number, c: number = ribbon, size = 1) => {
    for (const side of [-1, 1])
      piece('girlLock', x + side * 3 * size, y, z, 6 * size, 6 * size, 3 * size, c, side * 1.2)
    round(x, y, z + 0.8, 3 * size, 3 * size, 3 * size, gold)
  }
  const skirt = (c: number = dark, length = 10) => {
    if (riding) return
    piece('girlSkirt', 0, 22 - (length - 10) / 2, 0, 23, length, 17, c)
    piece('girlSkirt', 0, 17.4 - (length - 10), 0, 24, 2, 18, ivory)
  }
  const coat = (c: number) => piece('girlBody', 0, 29, 0, 18, 21, 13, c)
  const brimHat = (c: number = dark, width = 40) => {
    piece('girlBrim', 0, 67.5, 1, width, 2.5, 37, c)
    piece('girlCap', 0, 71, 1, 36, 12, 40, c)
    trim(0, 68.5, 12, 18, 2.5, 1, ribbon)
  }
  const backpack = (c: number = dark) => {
    round(0, 30, -10, 14, 16, 8, c)
    trim(0, 32, -14, 10, 2, 1, gold)
    for (const side of [-1, 1]) trim(side * 5, 31, 5.7, 1.5, 13, 1, c)
  }
  const cape = (c: number = cloth) => {
    piece('girlSkirt', 0, riding ? 31 : 27, -8, 25, riding ? 17 : 25, 7, c)
    bow(0, 36, 6.5)
  }
  const staff = (broom = false) => {
    const z = riding ? -15 : 3
    const shaft = piece('girlLimb', 15, 29, z, 2.6, 39, 2.6, dark)
    const tip = piece(
      broom ? 'girlLock' : 'girlRound',
      15,
      broom ? 13 : 50,
      z,
      broom ? 10 : 8,
      broom ? 17 : 9,
      7,
      broom ? gold : ribbon
    )
    if (!riding) shaft.motion = tip.motion = 'arm'
  }

  // The white-hooded traveller from this article's original illustration.
  if (identity === 'give-the-ai-precise-instructions') {
    const white = 0xf3f2ff
    const ink = 0x171e37
    const blue = 0x407bea
    piece('girlSkirt', 0, 27, 0, 27, 28, 21, white)
    round(0, 53, -1, 38, 42, 36, white)
    round(0, 51, 13, 27, 29, 11, ink)
    for (const side of [-1, 1]) {
      trim(side * 5.5, 50, 18.7, 3, 8, 1.5, 0x69e6ff)
      trim(side * 4, 34, 10, 1.2, 9, 1.2, blue)
      add('girlLimb', side * 5, 10, 0, 4, 15, 4, ink).motion = 'leg'
      add('girlRound', side * 5, 3, 2, 7, 6, 10, ink).motion = 'leg'
      add('girlLimb', side * 12, 29, 0, 9, 20, 10, white, side * 0.12).motion = 'arm'
      add('girlRound', side * 13, 20, 1, 5, 5, 5, ink).motion = 'arm'
    }
    for (const [x, y] of [
      [-8, 62],
      [0, 63],
      [8, 62]
    ])
      lock(x, y, 17, 10, 13, 5, -0.65, blue)
    // A small violet mushroom brooch recalls the jewel beside the traveller.
    trim(0, 28, 11, 2, 5, 2, 0xbcc8fa)
    piece('girlCap', 0, 31, 11, 8, 5, 5, 0x8e79d6)
    return parts
  }

  // A taller cranium and tapered jaw keep the face readable from the town camera.
  piece('girlBody', 0, 30, 0, 16, 17, 11, cloth)
  round(0, riding ? 26.5 : 24, 0, 13, 8, 10, dark)
  piece('girlLimb', 0, 38, 0, 5, 7, 5, skin)
  piece('girlHead', 0, 54, 1, 30, 36, 30, skin)
  piece(`girlFace${style.face}`, 0, 54, 1, 30, 36, 30, 0xffffff)
  const crown = shortFringe
    ? 'girlCrownShort'
    : (
        {
          straight: 'girlCrownStraight',
          swept: 'girlCrownSwept',
          round: 'girlCrownRound',
          locks: 'girlCrown',
          pointed: 'girlCrownPointed',
          curtain: 'girlCrownCurtain'
        } as const
      )[fringe]
  piece(crown, 0, 54.3, 1, 32, 38, 32, hair)
  for (const side of [-1, 1]) round(side * 14, 51, 1, 4, 6, 5, skin)

  // Back/side masses and pointed strands, rather than a cap of cuboids.
  const long = hairstyle === 'long' || hairstyle === 'waves' || hairstyle === 'wolf'
  if (
    role !== 'astronaut' &&
    (long || hairstyle === 'bob' || hairstyle === 'short' || hairstyle === 'flipped-bob')
  ) {
    const length = hairstyle === 'wolf' ? 23 : long ? 31 : hairstyle === 'short' ? 12 : 18
    for (const x of [-10, -5, 0, 5, 10])
      lock(
        x,
        52 - length * 0.2,
        headwear === 'knit' ? -10 : -13,
        headwear === 'knit' ? 8 : 10,
        length + 6,
        headwear === 'knit' ? 7 : 9,
        -x * 0.012
      )
  }
  for (const side of [-1, 1]) {
    if (role !== 'astronaut') lock(side * 14, long ? 47 : 51, 3, 6, long ? 31 : 23, 9, side * -0.08)
    if (hairstyle === 'flipped-bob' || hairstyle === 'wolf') {
      lock(side * 17, hairstyle === 'wolf' ? 36 : 42, -2, 9, 14, 9, side * -0.75)
    }
    if (hairstyle === 'curly-twintails') {
      for (let i = 0; i < 4; i++) {
        round(side * (20 + (i % 2) * 2), 56 - i * 7, -5, 14 - i, 12, 13 - i, hair)
      }
      bow(side * 18, 63, -1, ribbon, 0.8)
    } else if (hairstyle === 'twintails') {
      lock(side * 19, 44, -4, 12, 39, 12, side * 0.15)
      bow(side * 17, 61, -1, ribbon, 0.75)
    } else if (hairstyle === 'braids') {
      for (let i = 0; i < 4; i++)
        round(side * (15 + i * 0.7), 50 - i * 5, -4, 7 - i * 0.6, 7, 7, hair)
      bow(side * 17, 33, -2, ribbon, 0.65)
    } else if (hairstyle === 'bun') {
      round(side * 13, 68, -6, 12, 12, 12, hair)
      bow(side * 14, 68, 0, ribbon, 0.65)
    } else if (hairstyle === 'waves') {
      lock(side * 17, 35, -4, 9, 17, 10, side * 0.3)
    }
  }
  if (hairstyle === 'ponytail') {
    round(0, 66, -16, 12, 10, 10, hair)
    lock(2, 46, -19, 15, 39, 13, -0.14)
    bow(0, 65, -20)
  }
  if (hairstyle === 'sidetail') {
    round(17, 49, -8, 10, 10, 10, hair)
    lock(20, 36, -9, 13, 31, 12, -0.2)
    bow(19, 50, -3, ribbon, 0.85)
  }
  if (shortFringe) {
    if (role !== 'astronaut') for (const x of [-9, 0, 9]) lock(x, 63, 12, 10, 10, 6, -0.15)
  } else if (fringe === 'swept') {
    // Broad overlapping sections sweep from one temple toward the opposite cheek.
    lock(-7, 58, 14, 15, 25, 8, -0.65)
    lock(1, 56, 15, 14, 24, 8, -0.65)
    lock(9, 54, 13, 10, 21, 7, -0.5)
  } else if (fringe === 'locks') {
    // Narrow, uneven tips make a tousled zigzag instead of a uniform comb.
    for (const [i, x] of [-11, -6, -1, 4, 10].entries())
      lock(x, 56 + (i % 2) * 2, 15, 7, i % 2 ? 19 : 24, 6, i % 2 ? -0.2 : 0.18)
  } else if (fringe === 'round') {
    // Three soft lobes have rounded ends, with the middle one hanging lower.
    for (const x of [-9, 0, 9]) round(x, x === 0 ? 55 : 57, 14, 12, 21, 9, hair)
  } else if (fringe === 'pointed') {
    lock(-9, 58, 13, 11, 20, 7, -0.25)
    lock(9, 58, 13, 11, 20, 7, 0.25)
    lock(-1.5, 57, 15, 19, 25, 9, 0.05)
  } else if (fringe === 'curtain') {
    // The part stays above the eyes; the two fans overlap across the eye line.
    lock(-7, 56, 14, 18, 25, 8, -0.3)
    lock(7, 56, 14, 18, 25, 8, 0.5)
  } else {
    // Shallow strands end above the continuous, level blunt hem.
    for (const x of [-9, -3, 3, 9]) lock(x, 58, 13, 6, 17, 4)
  }
  // A side clip gives even simple hairstyles a readable accent.
  if (!shortFringe) trim(12, 59, 14.5, 4, 1.5, 1.5, gold, -0.35)

  if (style.skirt) skirt()
  else if (!riding) piece('girlBody', 0, 22, 0, 15, 8, 11, dark)
  for (const side of [-1, 1]) {
    if (riding) {
      for (const motion of ['thigh', 'shin', 'shoe'] as const) {
        const pose = bicyclePose(motion, side, 0)
        add(
          motion === 'shoe' ? 'girlRound' : 'girlLimb',
          side * 7,
          pose.y,
          pose.z,
          motion === 'shoe' ? 7 : 6,
          pose.height,
          motion === 'shoe' ? 11 : 6,
          motion === 'shin' ? skin : dark,
          0,
          pose.pitch
        ).motion = motion
      }
      const shoulder = { y: 44, z: -7 }
      const elbow = { y: 37, z: 5 }
      for (const [from, to, width, color] of [
        [elbow, shoulder, 7, cloth],
        [bicycleGrip, elbow, 4.5, skin]
      ] as const) {
        const pose = bicycleSegment(from, to)
        add('girlLimb', side * 10, pose.y, pose.z, width, pose.height, width, color, 0, pose.pitch)
      }
      add('girlRound', side * 10, elbow.y, elbow.z, 5, 5, 5, skin)
      add('girlRound', side * 10, bicycleGrip.y + 1, bicycleGrip.z, 5, 5, 7, skin)
    } else {
      add('girlLimb', side * 4.6, 15, 0, 6, 15, 6, skin).motion = 'leg'
      add('girlLimb', side * 4.6, 7.5, 0, 5.6, 9, 5.6, ivory).motion = 'leg'
      add('girlRound', side * 4.6, 3, 2, 7.5, 6, 11, dark).motion = 'leg'
      add('girlRound', side * 4.6, 1, 2, 7.5, 2, 10.5, ivory).motion = 'leg'
      add('girlLimb', side * 9, 33, 0, 7, 10, 8, cloth, side * 0.12).motion = 'arm'
      add('girlLimb', side * 10, 26, 0.5, 4.5, 9, 5, skin).motion = 'arm'
      add('girlRound', side * 10, 22, 1, 5, 5, 5, skin).motion = 'arm'
    }
  }

  switch (role) {
    case 'cap-child':
      piece('girlCap', 0, 70, 1, 36, 13, 40, cloth)
      piece('girlBrim', 0, 66, 16, 27, 2, 16, cloth)
      for (const y of [28, 33]) trim(0, y, 5.8, 13, 2, 1, ivory)
      backpack()
      break
    case 'dress-child':
      bow(0, 35, 6)
      trim(0, 28, 6, 10, 10, 1, ivory)
      break
    case 'casual':
      trim(-6, 31, 6, 2, 17, 1, dark, -0.25)
      round(-11, 23, 2, 7, 10, 9, ribbon)
      break
    case 'dress':
      bow(0, 28, 7)
      if (headwear === 'none') bow(-12, 67, 5, ribbon, 1.1)
      break
    case 'hoodie':
      round(0, 36, -5, 20, 8, 12, cloth)
      for (const side of [-1, 1]) trim(side * 3, 33, 6, 1, 7, 1, ivory)
      trim(0, 27, 6, 10, 4, 1, ribbon)
      break
    case 'cardigan':
      for (const side of [-1, 1]) trim(side * 5, 31, 5.7, 4, 14, 1, ivory)
      bow(0, 36, 6.5)
      break
    case 'kindergartner':
      brimHat(gold)
      coat(cloth)
      bow(0, 36, 7, ivory)
      round(-11, 24, 1, 8, 11, 8, gold)
      break
    case 'schoolchild':
      brimHat()
      backpack(ribbon)
      bow(0, 35, 7, ivory)
      break
    case 'student':
      for (const side of [-1, 1]) trim(side * 4, 36, 6, 6, 4, 1, ivory, side * -0.35)
      bow(0, 33, 7)
      backpack()
      break
    case 'salaryman':
    case 'office-lady':
      coat(dark)
      trim(0, 32, 6.5, 6, 12, 1, ivory)
      if (role === 'salaryman') lock(0, 32, 7.5, 3, 10, 2, 0, ribbon)
      else bow(0, 36, 7)
      if (riding) backpack()
      else round(-12, 20, 2, 7, 11, 12, dark).motion = 'arm'
      break
    case 'doctor':
    case 'nurse':
      coat(ivory)
      trim(0, 31, 6.5, 5, 13, 1, cloth)
      if (role === 'doctor') {
        for (const side of [-1, 1]) trim(side * 5, 33, 6.8, 1, 8, 1, dark)
        round(5, 28, 7.5, 3, 3, 2, metal)
      } else {
        round(0, 69, 0, 26, 9, 21, ivory)
        trim(0, 70, 10, 7, 2, 1, ribbon)
        trim(0, 70, 10.1, 2, 6, 1, ribbon)
      }
      break
    case 'chef':
      piece('girlBrim', 0, 68, 0, 29, 5, 26, ivory)
      for (const x of [-8, 0, 8]) round(x, 75, 0, 15, 15, 23, ivory)
      coat(ivory)
      bow(0, 37, 6.5)
      trim(0, 26, 7, 11, 11, 1, ivory)
      for (const x of [-4, 4]) for (const y of [29, 33]) round(x, y, 7, 1.5, 1.5, 1, dark)
      break
    case 'firefighter':
    case 'builder':
      brimHat(gold)
      coat(role === 'firefighter' ? cloth : ribbon)
      for (const side of [-1, 1]) trim(side * 5, 30, 6.5, 2, 16, 1, gold)
      trim(0, 24, 7, 16, 2, 1, ivory)
      if (role === 'firefighter')
        for (const side of [-1, 1]) piece('girlLimb', side * 5, 30, -11, 7, 21, 8, metal)
      else round(-10, 22, 1, 6, 9, 8, dark)
      break
    case 'police':
      brimHat(dark, 33)
      trim(0, 69, 12.5, 5, 5, 1, gold)
      trim(-4, 34, 6, 3, 4, 1, gold)
      trim(0, 24, 6, 15, 2, 1, dark)
      break
    case 'farmer':
      brimHat(gold, 42)
      trim(0, 28, 6, 12, 12, 1, dark)
      for (const side of [-1, 1]) trim(side * 5, 35, 6, 2, 8, 1, dark)
      backpack()
      break
    case 'astronaut':
      coat(ivory)
      // The visor covers the eyes between the ear modules.
      piece('girlBrim', 0, 38, 0, 31, 4, 25, ivory)
      for (const side of [-1, 1]) {
        round(side * 17, 52, 0, 7, 16, 18, ivory)
        round(side * 20, 52, 2, 2, 8, 8, cloth)
      }
      piece('girlCrownShort', 0, 54.8, 0.2, 34, 40, 34, ivory)
      backpack(ivory)
      trim(0, 31, 7, 10, 8, 1, cloth)
      break
    case 'alien':
      for (const side of [-1, 1]) {
        piece('girlLimb', side * 10, 75, 0, 2, 11, 2, metal)
        round(side * 10, 81, 0, 5, 5, 5, ribbon)
      }
      piece('girlBrim', 0, 37, 0, 22, 3, 16, metal)
      bow(0, 29, 7)
      break
    case 'magical-girl':
      bow(0, 36, 7, ribbon, 1.1)
      trim(0, 68, 12, 18, 2, 2, gold)
      round(0, 70, 12, 4, 5, 3, ribbon)
      staff()
      break
    case 'hero':
    case 'knight':
      cape(dark)
      coat(role === 'knight' ? metal : cloth)
      bow(0, 36, 7)
      trim(0, 24, 7, 15, 2, 1, gold)
      round(-13, 29, 1, 5, 17, 14, metal)
      piece('girlLimb', 10, 35, -13, 3, 30, 3, metal)
      trim(10, 49, -13, 10, 2, 4, gold)
      if (role === 'knight') {
        trim(0, 68, 12, 23, 3, 2, metal)
        lock(0, 74, -4, 8, 17, 7, -0.3, ribbon)
      }
      break
    case 'wizard':
    case 'witch':
      cape()
      piece('girlBrim', 0, 67.5, 0, 42, 3, 41, dark)
      piece('girlBentHat', 0, 80, 1, 36, 25, 40, dark)
      bow(8, 72, 9, ribbon, 0.85)
      staff(role === 'witch')
      break
    case 'ninja':
      trim(0, 68, 12, 26, 3, 2, dark)
      trim(0, 68, 13.2, 5, 3, 1, metal)
      lock(13, 44, -9, 5, 22, 3, -0.4, ribbon)
      bow(0, 36, 7)
      piece('girlLimb', 9, 34, -12, 3, 29, 3, dark)
      break
    case 'pirate':
      brimHat(dark, 41)
      piece('girlHat', 0, 73, 2, 27, 10, 15, dark)
      trim(0, 72, 10, 5, 5, 1, ivory)
      bow(0, 35, 7)
      round(-13, 41, 0, 6, 9, 7, cloth)
      round(-13, 46, 2, 6, 6, 7, ribbon)
      break
    case 'fairy':
      for (const side of [-1, 1]) {
        piece('girlLock', side * 15, 38, -9, 17, 24, 3, 0xb6e4e6, side * -0.5)
        piece('girlLock', side * 12, 26, -9, 13, 15, 3, 0xe8c1dc, side * 0.7)
      }
      bow(0, 34, 7)
      staff()
      break
    case 'vampire':
      cape(dark)
      trim(0, 31, 6.5, 6, 12, 1, ivory)
      bow(0, 36, 7, ribbon)
      bow(-12, 67, 4, dark)
      break
    case 'robot':
      coat(metal)
      trim(0, 30, 7, 9, 8, 1, dark)
      round(0, 31, 8, 4, 4, 1, ribbon)
      for (const side of [-1, 1]) {
        round(side * 17, 53, 0, 6, 11, 12, metal)
        trim(side * 19, 54, 4, 2, 6, 2, ribbon)
        piece('girlHat', side * 12, 70, 0, 8, 12, 8, metal)
      }
      break
  }

  switch (headwear) {
    case 'casquette':
      piece('girlCap', 0, 70, -1, 41, 16, 38, dark, -0.1)
      piece('girlBrim', 0, 63, 14, 34, 3, 22, dark, 0, 0.12)
      trim(0, 66, 17, 23, 3, 2, ribbon)
      round(9, 68, 17, 3, 3, 2, gold)
      break
    case 'knit':
      // Enclose the fringe and side locks, including their upper, wider sections.
      piece('girlCap', 0, 70, 1, 40, 23, 43, cloth)
      piece('girlVisor', 0, 57, 1, 40, 12, 43, cloth)
      round(0, 83, 0, 11, 10, 11, ivory)
      for (const side of [-1, 1]) {
        round(side * 17, 50, 1, 8, 16, 13, cloth)
        lock(side * 18, 37, 1, 3, 15, 3, 0, ivory)
      }
      break
    case 'bucket':
      piece('girlCap', 0, 69, 0, 40, 17, 41, cloth)
      piece('girlBucketBrim', 0, 61, 1, 45, 9, 43, cloth)
      trim(0, 68, 20, 7, 4, 2, ivory)
      break
    case 'beret':
      piece('girlCap', -3, 72, 0, 41, 13, 38, dark, -0.15)
      piece('girlBrim', 0, 67, 0, 32, 3, 31, dark)
      lock(-6, 80, -1, 3, 6, 3, -0.35, dark)
      round(-14, 72, 12, 4, 4, 3, gold)
      break
    case 'goggles':
      // Opaque lenses sit on the eyes, with a bridge and side straps.
      for (const side of [-1, 1]) {
        trim(side * 16, 53, 0, 2, 5, 27, dark)
        round(side * 7.4, 53, 14, 16, 17, 9, gold)
        round(side * 7.4, 53, 17.5, 12.5, 13.5, 5, 0x355768)
        round(side * 7.4 - 2, 56, 19.7, 3, 4, 1, 0xb9dfdf)
      }
      trim(0, 54, 18, 4, 3, 2, gold)
      break
    case 'mirror':
    case 'visor':
      piece('girlVisor', 0, 53, 1, 37, 16, 37, headwear === 'mirror' ? ivory : metal)
      piece('girlVisor', 0, 53, 2, 35, 12, 37, headwear === 'mirror' ? 0x796793 : 0x344c67)
      trim(-6, 56, 20.6, 8, 1.5, 1, 0xb6e4e6, 0.12)
      trim(7, 50, 20.6, 4, 1, 1, ribbon)
      break
    case 'knight':
      piece('girlVisor', 0, 53, 1, 36, 15, 36, metal)
      for (const x of [-9, -4.5, 0, 4.5, 9]) trim(x, 53, 19, 1.5, 5, 1, dark)
      for (const side of [-1, 1]) round(side * 17, 54, 3, 4, 4, 4, gold)
      break
  }
  return parts
}
