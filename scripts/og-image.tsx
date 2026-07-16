import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'

const imageWidth = 1200
const imageHeight = 630
const rowTextRepeatCount = 8

const rowTemplates = [
  { fontSize: 116, height: 118 },
  { fontSize: 31, height: 32 },
  { fontSize: 82, height: 84 },
  { fontSize: 44, height: 45 },
  { fontSize: 99, height: 101 },
  { fontSize: 25, height: 26 },
  { fontSize: 65, height: 66 },
  { fontSize: 39, height: 40 },
  { fontSize: 86, height: 88 },
  { fontSize: 29, height: 30 }
]
const textColor = '#ffffff'
const glitchTextShadow = '-4px 0 0 #00e5ff, 4px 0 0 #ff2fcf, 0 0 10px #ffffff'

export function getTitleFontSize(title: string) {
  const length = [...title].length

  if (length <= 26) return 105
  if (length <= 42) return 88
  if (length <= 60) return 70
  return 56
}

export function makeRowTexts(title: string, description: string) {
  const source = [
    ...`${title} ${description}`
      .toUpperCase()
      .replace(/[、。]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  ]
  const totalLength = Math.max(source.length, rowTemplates.length * 42)
  const characters = Array.from(
    { length: totalLength },
    (_, index) => source[index % source.length]
  )
  const rowLength = Math.floor(totalLength / rowTemplates.length)
  const longerRows = totalLength % rowTemplates.length
  let offset = 0

  return rowTemplates.map((_, index) => {
    const length = rowLength + (index < longerRows ? 1 : 0)
    const text = characters.slice(offset, offset + length).join('')
    offset += length
    return text
  })
}

export function fillRowText(text: string) {
  return text.repeat(rowTextRepeatCount)
}

function shuffle<T>(items: T[], next: () => number) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(next() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

function getRowStyles(title: string) {
  let state = [...title].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    7
  )
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 2 ** 32
  }
  return shuffle(rowTemplates, next)
}

export async function renderSvg(title: string, description: string, date: string, font: Buffer) {
  const rowTexts = makeRowTexts(title, description)
  const dateLabel = date.replaceAll('-', '.')
  const rowStyles = getRowStyles(`${title}\n${description}`)

  return satori(
    <div
      style={{
        width: imageWidth,
        height: imageHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#111111',
        color: '#f7f5ef',
        fontFamily: 'Noto Sans JP',
        fontWeight: 700
      }}
    >
      {rowStyles.map((style, index) => (
        <div
          key={`${style.fontSize}-${style.height}`}
          style={{
            width: imageWidth,
            height: style.height,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            color: textColor,
            fontSize: style.fontSize,
            lineHeight: 1,
            letterSpacing: '-0.12em',
            overflow: 'hidden',
            textShadow: glitchTextShadow,
            whiteSpace: 'nowrap'
          }}
        >
          {fillRowText(rowTexts[index])}
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          right: 14,
          bottom: 12,
          display: 'flex',
          background: '#111111',
          color: textColor,
          fontSize: 20,
          letterSpacing: '0.08em',
          textShadow: glitchTextShadow
        }}
      >
        {dateLabel} / TL AZ OL TE OT NIA
      </div>
    </div>,
    {
      width: imageWidth,
      height: imageHeight,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: font,
          weight: 700,
          style: 'normal'
        }
      ]
    }
  )
}

export async function renderOgPng(title: string, description: string, date: string, font: Buffer) {
  const svg = await renderSvg(title, description, date, font)

  return new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: false }
  })
    .render()
    .asPng()
}
