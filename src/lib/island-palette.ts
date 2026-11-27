// The island's colors, grouped into ramps that run from shadow to highlight.
// A lit surface keeps its ramp and only steps along it, so each material shows
// a handful of tones and the scene as a whole a limited palette.

// Tinted glass goes from its colored edge to the bright face toward the bulb.
export const lampRamps = {
  lagoonGlass: ['#447e8e', '#70baca', '#cee9db'],
  honeyGlass: ['#cb8648', '#ffcf80', '#fff7d3'],
  pearlGlass: ['#a19a77', '#e7d7a9', '#fff0c8'],
  urchinShell: ['#8d7087', '#c0a1ba', '#dbbfd2'],
  tideGlass: ['#163b8c', '#2465b5', '#299fcc', '#67dadb', '#caf9ea']
} as const
export type LampGlass = keyof typeof lampRamps

export const ramps = {
  ink: ['#2b2236'],
  // Ground.
  sand: ['#8a5e2c', '#b17d3c', '#d6a45a', '#e2bb76', '#efd08c', '#fbe7ae', '#fff7d6'],
  whiteSand: ['#a89c80', '#c4b593', '#d6c7a4', '#e8dcc0', '#fbf5e4', '#ffffff'],
  blackSand: ['#1d1b23', '#2f2d37', '#3d3b45', '#504e58', '#6c6a76', '#8a8894'],
  grass: ['#173f22', '#25602d', '#357e38', '#48973e', '#5cad43', '#7bc650', '#aadc6a', '#d4f08e'],
  moss: ['#16351f', '#214b30', '#2f653b', '#3f7a45', '#4f8f4d', '#66a659', '#8cc070'],
  dryGrass: [
    '#4f411e',
    '#6b592b',
    '#8d7838',
    '#ad9746',
    '#c8b356',
    '#dccb72',
    '#efe29b',
    '#f6efc8'
  ],
  clover: ['#1d4a24', '#34803a', '#4a9c40', '#5fb548', '#7fd05a', '#b4e77c'],
  path: ['#7e5530', '#b17d44', '#d09e5e', '#e8c080', '#f7da9f', '#fff0c8'],
  soil: ['#4a2c1b', '#684029', '#87583a', '#a3714a', '#b98a5e', '#cfa47a'],
  clay: ['#55241a', '#783420', '#a04c2c', '#bf6239', '#d67f52', '#e89c70'],
  mud: ['#2a2019', '#3e2f25', '#584536', '#6d5846', '#836c57', '#9a8470'],
  puddle: ['#3c464b', '#5b666b', '#7d8d92', '#a3b6ba', '#cfe0e2'],
  gravel: ['#3f3a33', '#59534a', '#6d665b', '#918a7b', '#b3ab9a', '#d1cab9', '#e8e2d4'],
  pebble: ['#7d5f45', '#a98463', '#d0ac88', '#e8c9a8'],
  rock: ['#2f322b', '#44483f', '#53584f', '#72776a', '#8e9387', '#a9ae9f', '#c5c9bb'],
  lichen: ['#8e9666', '#bcc58d', '#dbe2ae'],
  lava: ['#0a0809', '#121011', '#181415', '#2b2628', '#3c3638', '#564d4f', '#6e6467'],
  fire: ['#c2410c', '#ff7a2e', '#ffd166', '#fff3b0'],
  brick: ['#4c1f16', '#6c2e21', '#964231', '#b8573f', '#cf7159', '#e38e75'],
  mortar: ['#8f7a5c', '#b89f7c', '#d9c5a3', '#efe1c4'],
  cobble: ['#4f4d48', '#6a6862', '#87847d', '#a9a69e', '#c9c4b5', '#e1ddd0'],
  joint: ['#5e4e37', '#8d7653', '#c0a273', '#dcc594'],
  deck: ['#3d2414', '#5e3620', '#6f4827', '#986838', '#bd8950', '#deb078', '#f0cc98'],
  bank: ['#4f3a25', '#7a5a3a', '#9a7a55'],
  springBank: ['#5e5850', '#8b8478', '#aaa397'],
  pad: ['#2f6b34', '#4f9641', '#8ccb55', '#b9e47c'],
  lake: ['#1d5f9c', '#2a7fc8', '#3d9bdc', '#72c4ee', '#d8f4fb'],
  bloom: ['#d98aa0', '#f1d3df', '#f7bccb', '#ffe1e8'],
  white: ['#8f9399', '#cfc6b2', '#f1ece0', '#ffffff'],
  shell: ['#c97a73', '#f7a9a0', '#ffd0c8'],
  star: ['#b85a2a', '#f08a4b', '#ffb27a'],
  shellSand: ['#9c8656', '#c9b27c', '#e2cfa0'],
  // Plants.
  leaf: ['#0f3320', '#1b5230', '#2a7036', '#3b8e3c', '#58ad47', '#86cb5c', '#bfe888'],
  palmLeaf: ['#173f22', '#2a6630', '#3f8a38', '#62aa42', '#8fc854', '#c0e27a'],
  bark: ['#24160f', '#3a2517', '#553620', '#744d2d', '#94683e', '#b48654'],
  palmBark: ['#3d2b1a', '#5e452b', '#836540', '#a98a5c', '#cdb184', '#e6d1a8'],
  bamboo: ['#24401a', '#3a6227', '#548434', '#76a642', '#a0c65a', '#cde38a'],
  deadWood: ['#2e2622', '#4a3e37', '#695a51', '#8a7b70', '#ac9e92', '#cfc3b6'],
  jungle: ['#0b2e1e', '#125030', '#1b6e3c', '#2a8e48', '#46ae5c', '#7ed07e'],
  cactus: ['#183d24', '#265e33', '#377f40', '#4f9f4f', '#76bd66', '#a6dc8c'],
  // Plants drawn true to life: muted, with long ramps for leaf-by-leaf light.
  oak: [
    '#13241a',
    '#1c3420',
    '#28472a',
    '#365c31',
    '#47723a',
    '#5c8a43',
    '#77a24f',
    '#97ba5f',
    '#bfd27c'
  ],
  pine: ['#0f1d1a', '#162a23', '#1f3a2c', '#2a4b37', '#365d42', '#467050', '#5b8661', '#77a077'],
  savanna: ['#1f2414', '#2d351b', '#3e4923', '#525e2c', '#677536', '#7f8c43', '#9ca456', '#bcbd72'],
  frond: ['#132117', '#1c321d', '#284625', '#365c2e', '#477238', '#5c8943', '#77a152', '#9bbb6a'],
  trunk: ['#1f1712', '#2e231b', '#3f3125', '#544231', '#6b5640', '#846d53', '#9f8869', '#bba788'],
  birch: ['#25221f', '#4a453f', '#7d786f', '#a9a499', '#cfcabe', '#e9e6dc', '#faf8f2', '#ffffff'],
  birchLeaf: [
    '#1d2b15',
    '#2c401d',
    '#3f5926',
    '#567431',
    '#6f8e3d',
    '#8daa4e',
    '#adc566',
    '#d1de8a'
  ],
  palmTrunk: ['#2a2219', '#3d3226', '#524435', '#6a5a46', '#837259', '#9d8d73', '#bbab90'],
  // Small fires drawn as signs: a few flat, bright colors in a bold line.
  flame: ['#b5301f', '#ec5a2a', '#ff9530', '#ffd04a', '#fff4bd'],
  cuteStone: ['#4f4a4c', '#817a7a', '#aea7a3', '#d8d2cb', '#f4f0ea'],
  cuteLog: ['#4e2c1b', '#80492a', '#ab6a3b', '#d08f55', '#ecbe85'],
  cuteRing: ['#a8723f', '#d9a463', '#f4d29a'],
  // Stone and things people made.
  relic: ['#2a2730', '#423d4a', '#5d5766', '#7c7586', '#9d96a6', '#c0bac8', '#dedae3'],
  rust: ['#3b1f12', '#6b3a1f', '#9a5a2c'],
  red: ['#5c1418', '#9a2a28', '#d0403a', '#f0604d', '#ff9a85'],
  tan: ['#4f3620', '#6a4a2e', '#9a6e45', '#c99a6a', '#e8c49a'],
  violet: ['#33245e', '#4a3484', '#8565c4', '#b79ae8', '#dccaff'],
  amber: ['#6a3a10', '#9a5418', '#e08a2a', '#ffc04d', '#ffe08a'],
  yellow: ['#7a5a12', '#b08a1a', '#e8c030', '#ffe066', '#fff4b0'],
  blue: ['#2c2c78', '#4a4aa8', '#6a7ae0', '#9aaaf8', '#cfd8ff'],
  coral: ['#6a1f3a', '#a03a5c', '#e0668a', '#ff9fb5', '#ffd9e2'],
  peach: ['#6a3010', '#a85018', '#e07a2a', '#ffad5c', '#ffe2b8'],
  lilac: ['#3a2470', '#5a3a9a', '#8660cf', '#b99af0', '#e9d9ff'],
  steel: ['#15171c', '#1f2228', '#3d424b', '#5a606b', '#7c838f'],
  firefly: ['#4f7a1a', '#7fae2a', '#b9e85a', '#e8ff9a'],
  relicInlay: ['#799c9c', '#56aba7', '#73dace'],
  bronze: ['#312e2b', '#4c4133', '#7f7257', '#b49a68', '#dfc48c'],
  ...lampRamps
} as const satisfies Record<string, readonly string[]>

export type RampName = keyof typeof ramps

export type PaletteColor = { r: number; g: number; b: number; ramp: number; step: number }

const rampNames = Object.keys(ramps) as RampName[]
const rampSlots: number[][] = []
export const palette: PaletteColor[] = []
const exact = new Map<number, number>()
for (const [rampIndex, name] of rampNames.entries()) {
  const slots: number[] = []
  for (const [step, value] of ramps[name].entries()) {
    const rgb = Number.parseInt(value.slice(1), 16)
    // A color listed twice keeps the ramp it was first listed in.
    let slot = exact.get(rgb)
    if (slot === undefined) {
      slot = palette.length
      palette.push({ r: rgb >> 16, g: (rgb >> 8) & 255, b: rgb & 255, ramp: rampIndex, step })
      exact.set(rgb, slot)
    }
    slots.push(slot)
  }
  rampSlots.push(slots)
}

// The palette slot nearest an arbitrary color, by a weighted RGB distance
// that tracks perceived difference well enough for picking among neighbors.
const nearestCache = new Map<number, number>()
export function nearestSlot(r: number, g: number, b: number) {
  const key = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
  const known = exact.get(key) ?? nearestCache.get(key)
  if (known !== undefined) return known
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i < palette.length; i++) {
    const color = palette[i]
    const mean = (r + color.r) / 2
    const dr = r - color.r
    const dg = g - color.g
    const db = b - color.b
    const distance = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  nearestCache.set(key, best)
  return best
}

// The slot for a color on a ground of the named ramp: its own slot if the
// palette has it, otherwise the nearest step of that ramp, so in-between tones
// stay in the ground's hue instead of picking up another material's.
export function slotOnRamp(r: number, g: number, b: number, name: RampName) {
  const known = exact.get((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b))
  if (known !== undefined) return known
  let best = rampSlots[rampNames.indexOf(name)][0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const slot of rampSlots[rampNames.indexOf(name)]) {
    const color = palette[slot]
    const distance = 2 * (r - color.r) ** 2 + 4 * (g - color.g) ** 2 + 3 * (b - color.b) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = slot
    }
  }
  return best
}

// The slot `steps` along the ramp from `slot`, stopping at either end.
export function stepSlot(slot: number, steps: number) {
  const color = palette[slot]
  const slots = rampSlots[color.ramp]
  return slots[Math.max(0, Math.min(slots.length - 1, color.step + steps))]
}

// The slot at `step` of a named ramp, counted from the dark end.
export function rampSlot(name: RampName, step: number) {
  const slots = rampSlots[rampNames.indexOf(name)]
  return slots[Math.max(0, Math.min(slots.length - 1, step))]
}

// The stone at the edge catches a little light; the center supplies its own.
const emissionStrengths = new Float32Array(palette.length)
for (const [step, strength] of [0.18, 0.56, 1].entries()) {
  emissionStrengths[rampSlot('relicInlay', step)] = strength
}
for (const ramp of Object.keys(lampRamps) as LampGlass[]) {
  for (let step = 0; step < lampRamps[ramp].length; step++) {
    emissionStrengths[rampSlot(ramp, step)] = 0.55 + (0.45 * step) / (lampRamps[ramp].length - 1)
  }
}
export function surfaceEmission(slot: number) {
  return emissionStrengths[slot]
}

// Leaf tones: the same tree, read on another foliage ramp, so a wood of one
// kind of tree is not all one green. Tone 0 is as drawn. A tone moves each
// foliage ramp onto another (and some steps along it) at the same place from
// dark to light; bark and everything else keep their colors.
export const LEAF_TONES = 4
const leafTones: Array<Partial<Record<RampName, readonly [RampName, number]>>> = [
  {},
  // Deep and cool.
  {
    oak: ['pine', 1],
    frond: ['pine', 1],
    birchLeaf: ['oak', 0],
    savanna: ['oak', 0],
    palmLeaf: ['pine', 1],
    pine: ['pine', -1]
  },
  // Fresh and bright.
  {
    oak: ['birchLeaf', 0],
    frond: ['birchLeaf', 0],
    birchLeaf: ['birchLeaf', 1],
    savanna: ['birchLeaf', -1],
    palmLeaf: ['bamboo', 0],
    pine: ['oak', 0]
  },
  // Olive, a little dry.
  {
    oak: ['savanna', 0],
    frond: ['savanna', 0],
    birchLeaf: ['savanna', 1],
    savanna: ['savanna', -1],
    palmLeaf: ['birchLeaf', 0],
    pine: ['frond', -1]
  }
]
// For each tone, every palette slot's slot in that tone.
const leafToneSlots = leafTones.map((tone) => {
  const table = new Uint16Array(palette.length)
  for (let slot = 0; slot < palette.length; slot++) {
    const { ramp, step } = palette[slot]
    const move = tone[rampNames[ramp]]
    if (!move) {
      table[slot] = slot
      continue
    }
    const [name, shift] = move
    const from = ramps[rampNames[ramp]].length - 1
    const to = ramps[name].length - 1
    table[slot] = rampSlot(name, Math.round((step * to) / from) + shift)
  }
  return table
})

// The slot `slot` is drawn in under leaf tone `tone`.
export function leafToneSlot(slot: number, tone: number) {
  return tone ? leafToneSlots[tone][slot] : slot
}

// How a silhouette is edged: a few steps darker than the color beside it, as
// a painter would shade a turning edge ('soft'), the darkest of its ramp
// ('ramp'), a bold ink line ('ink'), or not at all.
export type Outline = 'soft' | 'ramp' | 'ink' | 'none'
