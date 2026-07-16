import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'

const imageWidth = 1200
const imageHeight = 630

const rowTemplates = [
  { fontSize: 170, height: 118 },
  { fontSize: 40, height: 32 },
  { fontSize: 120, height: 84 },
  { fontSize: 60, height: 45 },
  { fontSize: 150, height: 101 },
  { fontSize: 34, height: 26 },
  { fontSize: 92, height: 66 },
  { fontSize: 52, height: 40 },
  { fontSize: 130, height: 88 },
  { fontSize: 42, height: 30 }
]
const neonColors = ['#effff4', '#70f7ff', '#31ff80', '#fa73da', '#ffdf5f', '#2dacf9']

export function getTitleFontSize(title: string) {
  const length = [...title].length

  if (length <= 26) return 105
  if (length <= 42) return 88
  if (length <= 60) return 70
  return 56
}

function splitTitle(title: string) {
  const words = title
    .toUpperCase()
    .split(/[\s、。！？!?・:：]+/)
    .filter(Boolean)

  if (words.length > 1) return words

  return (words[0] ?? title).match(/.{1,7}/gu) ?? [title]
}

function makeRowText(words: string[], rowIndex: number) {
  const text: string[] = []
  let length = 0
  let index = rowIndex

  while (length < 42) {
    const word = words[index % words.length]
    text.push(word)
    length += [...word].length + 1
    index += 1
  }

  return text.join('  ')
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
  const colors = shuffle(neonColors, next)

  return shuffle(rowTemplates, next).map((template, index) => ({
    ...template,
    color: colors[index % colors.length]
  }))
}

export async function renderSvg(title: string, date: string, font: Buffer) {
  const words = splitTitle(title)
  const dateLabel = date.replaceAll('-', '.')
  const rowStyles = getRowStyles(title)

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
            color: style.color,
            fontSize: style.fontSize,
            lineHeight: 1,
            letterSpacing: '-0.08em',
            overflow: 'hidden',
            textShadow: `0 0 12px ${style.color}`,
            whiteSpace: 'nowrap'
          }}
        >
          {makeRowText(words, index)}
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 9,
          display: 'flex',
          background: '#111111',
          color: '#70f7ff',
          fontSize: 15,
          letterSpacing: '0.08em'
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

export async function renderOgPng(title: string, date: string, font: Buffer) {
  const svg = await renderSvg(title, date, font)

  return new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: false }
  })
    .render()
    .asPng()
}
