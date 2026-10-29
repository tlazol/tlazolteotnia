// Halloween dresses the whole town: this one switch recolors the scenery and brings out
// the pumpkins, graves, bats, ghosts and the residents' costume pieces.
export const townHalloween = true

export const halloween = {
  pumpkin: 0xf07a1e,
  stem: 0x5a4a2a,
  candle: 0xffb23a,
  grave: 0x8f8a99,
  mound: 0x5e4a3c,
  witch: 0x2a2236,
  purple: 0x7a3fb8,
  slime: 0x8be04a,
  blood: 0xb8282e,
  bone: 0xf2ead8
} as const

// The neon trims swap to candlelight, potion purple and slime green.
const neonSwap = new Map<number, number>([
  [0x5ef0e6, 0xff8a1f],
  [0xff5ca8, 0xc46bff],
  [0x9cff5c, 0x9cff5c],
  [0xffb84a, 0xffb84a],
  [0xb48aff, 0xa86bff],
  [0x5ea8ff, 0xff6a3a]
])

export function halloweenNeon(hex: number) {
  return townHalloween ? (neonSwap.get(hex) ?? hex) : hex
}

function toHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return (channel(0) << 16) | (channel(8) << 8) | channel(4)
}

// Greens wither to rust and straw, blues and cyans sink into violet, yellows ripen to
// pumpkin, pinks turn to potion purple and pale neutrals take a dusky lavender cast.
function recolor(hex: number) {
  const r = ((hex >> 16) & 255) / 255
  const g = ((hex >> 8) & 255) / 255
  const b = (hex & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d > 0)
    h =
      max === r
        ? 60 * (((g - b) / d + 6) % 6)
        : max === g
          ? 60 * ((b - r) / d + 2)
          : 60 * ((r - g) / d + 4)
  if (s < 0.15) return toHex(270, s * 0.5 + 0.08, l * 0.86)
  if (h >= 75 && h < 170) return toHex(22 + (h - 75) * 0.25, s * 0.7, l * 0.75)
  if (h >= 170 && h < 255) return toHex(262 + (h - 170) * 0.25, s * 0.8, l * 0.85)
  if (h >= 255 && h < 300) return toHex(h, s, l * 0.92)
  if (h >= 300 && h < 345) return toHex(290, s * 0.9, l * 0.9)
  if (h >= 40 && h < 75) return toHex(28 + (h - 40) * 0.3, s, l * 0.95)
  return hex
}

const recolored = new Map<number, number>()
export function halloweenColor(hex: number) {
  if (!townHalloween) return hex
  let value = recolored.get(hex)
  if (value === undefined) {
    value = recolor(hex)
    recolored.set(hex, value)
  }
  return value
}
