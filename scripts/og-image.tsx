import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { hashSlug, wrapStickerTitle } from '../src/lib/sticker-board'

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
const glitchTextShadow =
  '-8px 1px 0 #00e5ff, 8px -1px 0 #ff2fcf, -2px 0 0 #00e5ff, 2px 0 0 #ff2fcf, 0 0 8px #ffffff'

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
  const seed = hashSlug(title)
  const preferredFontSize = Math.min(84, getTitleFontSize(title))
  const lines = wrapStickerTitle(title, Math.floor(800 / preferredFontSize))
  const fontSize = Math.min(preferredFontSize, 360 / Math.max(1, lines.length) / 1.2)
  const lineHeight = fontSize * 1.2
  const stickerHeight = lines.length * lineHeight + 112
  // Each title row extends the same die-cut silhouette; the eyes and date form small tabs.
  const bands = [
    { width: 160, height: 48 },
    ...lines.map((line) => ({
      width: Math.min(
        1000,
        80 +
          Array.from(line).reduce(
            (width, char) => width + (/[\u0020-\u007e]/.test(char) ? 0.68 : 1) * fontSize,
            0
          )
      ),
      height: lineHeight
    })),
    { width: 300, height: 64 }
  ]
  let bandY = 0
  const edges = bands.map((band) => {
    const top = bandY
    bandY += band.height
    return { left: (1040 - band.width) / 2, right: (1040 + band.width) / 2, top, bottom: bandY }
  })
  const outline = [
    ...edges.flatMap(({ right, top, bottom }) => [`${right},${top}`, `${right},${bottom}`]),
    ...[...edges]
      .reverse()
      .flatMap(({ left, top, bottom }) => [`${left},${bottom}`, `${left},${top}`])
  ].join(' ')

  return satori(
    <div
      style={{
        width: imageWidth,
        height: imageHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#101114',
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
            maskImage:
              'linear-gradient(to right, #000 0%, #000 90%, transparent 97%, transparent 100%)',
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
          left: 0,
          top: 0,
          width: imageWidth,
          height: imageHeight,
          background: '#101114a6'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: (imageHeight - stickerHeight) / 2 - 8,
          width: 1040,
          height: stickerHeight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `rotate(${(seed % 5) - 2 || -2}deg)`
        }}
      >
        <svg
          width={1040}
          height={stickerHeight}
          viewBox={`0 -16 1040 ${stickerHeight + 32}`}
          style={{ position: 'absolute', top: -16, height: stickerHeight + 32 }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="foil" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a7b4ed" />
              <stop offset="18%" stopColor="#efb4d9" />
              <stop offset="34%" stopColor="#f9f4b4" />
              <stop offset="49%" stopColor="#96e5ef" />
              <stop offset="63%" stopColor="#e8c8ff" />
              <stop offset="78%" stopColor="#f9f4b4" />
              <stop offset="100%" stopColor="#96e5ef" />
            </linearGradient>
            <pattern
              id="laminate"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <rect width="1" height="6" fill="#fff" opacity="0.3" />
            </pattern>
          </defs>
          <polygon
            points={outline}
            fill="#00e5ff"
            stroke="#00e5ff"
            strokeWidth="18"
            strokeLinejoin="round"
            transform="translate(-8 5)"
          />
          <polygon
            points={outline}
            fill="#ff2fcf"
            stroke="#ff2fcf"
            strokeWidth="18"
            strokeLinejoin="round"
            transform="translate(8 5)"
          />
          <polygon
            points={outline}
            fill="url(#foil)"
            stroke="#fff"
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <polygon points={outline} fill="url(#laminate)" />
        </svg>
        <div style={{ display: 'flex', height: 48, alignItems: 'center', gap: 14 }}>
          {Array.from({ length: 1 + ((seed >>> 16) % 4) }, (_, index) => (
            <div key={index} style={{ width: 9, height: 20, background: '#27213b' }} />
          ))}
        </div>
        {lines.map((line, index) => (
          <div
            key={`${index}-${line}`}
            style={{
              display: 'flex',
              height: lineHeight,
              alignItems: 'center',
              justifyContent: 'center',
              fontSize,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              color: index % 2 ? '#fff7e1' : '#f4e9ff',
              WebkitTextStroke: '2px #27213b',
              textShadow: '3px 4px 0 #27213b, -3px 0 0 #00e5ff, 3px 0 0 #ff2fcf'
            }}
          >
            {line.trim()}
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            height: 64,
            alignItems: 'center',
            fontSize: 22,
            letterSpacing: '0.12em',
            color: '#27213b'
          }}
        >
          {dateLabel}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 36,
          bottom: 22,
          display: 'flex',
          background: '#101114',
          color: textColor,
          fontSize: 20,
          letterSpacing: '0.08em',
          textShadow: '-2px 0 0 #00e5ff, 2px 0 0 #ff2fcf'
        }}
      >
        TL AZ OL TE OT NIA / 0RGA.ORG
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
