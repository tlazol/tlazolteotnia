import {
  CanvasTexture,
  DataTexture,
  LinearMipmapLinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  type Texture
} from 'three'

// Shop signs, the town clock and a few posters share one texture with a white
// block, so that every static surface can use a single material.
export const townLabels = {
  'TOWN HALL': ['#24345f', '#f6d77c'],
  LIBRARY: ['#2f5d50', '#fff4d6'],
  HOSPITAL: ['#ffffff', '#d8434e'],
  HOTEL: ['#5b2e52', '#ffd98a'],
  POLICE: ['#24407a', '#ffffff'],
  'FIRE DEPT': ['#b8322f', '#fff1c4'],
  POST: ['#d9452f', '#ffffff'],
  CAFE: ['#3e2b26', '#ffe2b0'],
  BAKERY: ['#f4d6a0', '#7a3f22'],
  BURGER: ['#f1b532', '#b22a24'],
  CINEMA: ['#1d1d34', '#ff6b8b'],
  ARCADE: ['#30205e', '#6ff2ff'],
  MARKET: ['#2d7d5a', '#ffffff'],
  DRUGS: ['#ffffff', '#2c7fc1'],
  BOOKS: ['#6b3f2b', '#ffe9c2'],
  FLOWERS: ['#f6cfe0', '#a03c6c'],
  'FISH MARKET': ['#1f5f8b', '#ffffff'],
  STATION: ['#ffffff', '#21416b'],
  SCHOOL: ['#f3ead2', '#2a4d7a'],
  DINER: ['#cf3b45', '#ffffff'],
  'ICE CREAM': ['#ffd3e2', '#d1457d'],
  PIZZA: ['#2e6b3a', '#fff0d0'],
  TOYS: ['#ffe066', '#3f62c7'],
  BOATS: ['#e9f3fb', '#1d5f8f']
} as const
export type TownLabel = keyof typeof townLabels

export type UvRect = readonly [number, number, number, number]
const size = 1024
const cellWidth = 336
const cellHeight = 96
const white: readonly [number, number] = [16 / size, 1 - 16 / size]

function rect(x: number, y: number, width: number, height: number): UvRect {
  // Inset half a texel so that filtering never samples a neighbouring entry.
  return [(x + 1) / size, 1 - (y + height - 1) / size, (x + width - 1) / size, 1 - (y + 1) / size]
}

const labelRects = Object.fromEntries(
  Object.keys(townLabels).map((label, index) => [
    label,
    rect((index % 3) * cellWidth, 80 + Math.floor(index / 3) * cellHeight, cellWidth, cellHeight)
  ])
) as Record<TownLabel, UvRect>

export const townAtlasRects = {
  labels: labelRects,
  clock: rect(0, 864, 128, 128),
  cross: rect(144, 864, 128, 128),
  posters: [rect(288, 864, 96, 128), rect(400, 864, 96, 128), rect(512, 864, 96, 128)],
  marquee: rect(624, 864, 384, 64)
}

export function townLabelAspect() {
  return cellWidth / cellHeight
}

function drawAtlas(context: CanvasRenderingContext2D) {
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size, size)
  for (const [index, [label, [background, foreground]]] of Object.entries(townLabels).entries()) {
    const x = (index % 3) * cellWidth
    const y = 80 + Math.floor(index / 3) * cellHeight
    context.fillStyle = background
    context.fillRect(x, y, cellWidth, cellHeight)
    context.strokeStyle = foreground
    context.globalAlpha = 0.55
    context.lineWidth = 5
    context.strokeRect(x + 9, y + 9, cellWidth - 18, cellHeight - 18)
    context.globalAlpha = 1
    context.fillStyle = foreground
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    let fontSize = 54
    do {
      context.font = `800 ${fontSize}px "Avenir Next", "Helvetica Neue", Arial, sans-serif`
      fontSize -= 2
    } while (context.measureText(label).width > cellWidth - 52 && fontSize > 20)
    context.fillText(label, x + cellWidth / 2, y + cellHeight / 2 + 3)
  }

  // A cream clock face with hour marks; the hands are modelled in 3D.
  context.fillStyle = '#3b3550'
  context.fillRect(0, 864, 128, 128)
  context.fillStyle = '#fff7e2'
  context.beginPath()
  context.arc(64, 928, 58, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#3b3550'
  for (let hour = 0; hour < 12; hour++) {
    const angle = (hour / 12) * Math.PI * 2
    const long = hour % 3 === 0
    context.save()
    context.translate(64, 928)
    context.rotate(angle)
    context.fillRect(-2, -54, 4, long ? 14 : 8)
    context.restore()
  }

  context.fillStyle = '#ffffff'
  context.fillRect(144, 864, 128, 128)
  context.fillStyle = '#e04452'
  context.fillRect(144 + 46, 864 + 16, 36, 96)
  context.fillRect(144 + 16, 864 + 46, 96, 36)

  // Small posters for shop windows and the cinema.
  const posters = [
    ['#ffcf5c', '#e0567b', '#3f62c7'],
    ['#7fd6c2', '#2a4d7a', '#ffffff'],
    ['#f38ba0', '#ffe6a7', '#5b2e52']
  ]
  for (const [index, [background, shape, accent]] of posters.entries()) {
    const x = 288 + index * 112
    context.fillStyle = background
    context.fillRect(x, 864, 96, 128)
    context.fillStyle = shape
    context.beginPath()
    context.arc(x + 48, 864 + 52, 28, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = accent
    context.fillRect(x + 14, 864 + 96, 68, 10)
    context.fillRect(x + 24, 864 + 110, 48, 6)
  }

  // A row of marquee bulbs.
  context.fillStyle = '#2a1830'
  context.fillRect(624, 864, 384, 64)
  for (let bulb = 0; bulb < 16; bulb++) {
    context.fillStyle = bulb % 2 ? '#ffe9a8' : '#ffc96b'
    context.beginPath()
    context.arc(624 + 12 + bulb * 24, 896, 8, 0, Math.PI * 2)
    context.fill()
  }
}

export function createTownAtlas(): { texture: Texture; white: readonly [number, number] } {
  if (typeof document === 'undefined') {
    const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat)
    texture.needsUpdate = true
    return { texture, white }
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (context) drawAtlas(context)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  return { texture, white }
}
