import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BlogPostSummary } from '../src/lib/blog-post'
import { hashSlug, layoutStickers, type Sticker } from '../src/lib/sticker-board'
import { foilPalettes, palettes, stickerMaterial } from '../src/lib/sticker-colors'

const imageWidth = 1200
const imageHeight = 630
const fontOptions = {
  loadSystemFonts: false,
  fontFiles: [
    fileURLToPath(new URL('./assets/WDXLLubrifontJPN-Regular.ttf', import.meta.url)),
    fileURLToPath(new URL('./assets/IBMPlexMono-Bold.ttf', import.meta.url)),
    fileURLToPath(new URL('./assets/NotoSansCJKjp-Bold.otf', import.meta.url))
  ]
}

function svg(children: ReactNode, title = 'Article sticker') {
  return renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={imageWidth} height={imageHeight}>
      <title>{title}</title>
      {children}
    </svg>
  )
}

function makeLettering(sticker: Sticker) {
  const { width, seed, lines, fontSize } = sticker
  const outlineWidth = seed % 3 === 1 ? 4 : 5
  return lines.map((line, index) => {
    const direction = (index + seed) % 2 ? 1 : -1
    const size = fontSize * (1.13 + ((seed + index * 7) % 4) * 0.03)
    const rhythm = [1.16, 0.92, 1.04, 0.98, 1.1, 0.94]
    const glyphs = Array.from(line.trim()).map((char, charIndex) => {
      const beat = (charIndex + index * 2 + (seed % rhythm.length)) % rhythm.length
      const emphasis = /[A-Za-z0-9]/.test(char) ? 1 + (rhythm[beat] - 1) * 0.5 : rhythm[beat]
      const glyphSize = size * emphasis
      return {
        char,
        size: glyphSize,
        y: (size - glyphSize) * 0.4,
        stroke: beat === 0 || beat === 4 ? glyphSize * 0.018 : 0
      }
    })
    const text = (outline = false) => (
      <text fontFamily="WDXL Lubrifont JP N" letterSpacing={-size * 0.015}>
        {glyphs.map((glyph, charIndex) => (
          <tspan
            key={charIndex}
            fontSize={glyph.size}
            strokeWidth={(outline ? outlineWidth : 0) + glyph.stroke}
          >
            {glyph.char}
          </tspan>
        ))}
      </text>
    )
    const bounds = new Resvg(svg(text()), { font: fontOptions }).getBBox()
    if (!bounds) throw new Error(`Unable to measure sticker title: ${line}`)
    const scaleX = Math.min(1.35, (width - 58 - ((seed + index * 13) % 3) * 9) / bounds.width)
    const x = width / 2 + direction * 7
    const y = 64 + index * fontSize * 1.22
    const angle = direction * (0.5 + ((seed >>> 4) % 3) * 0.3)
    return {
      text,
      width: bounds.width * scaleX,
      x,
      cutTop: Math.min(...glyphs.map((glyph) => glyph.y - glyph.size / 2), 0) - 2,
      cutBottom: Math.max(...glyphs.map((glyph) => glyph.y + glyph.size / 2), 0) + 4,
      cutTransform: `translate(${x} ${y}) rotate(${angle}) skewX(-3)`,
      transform: `translate(${x} ${y}) rotate(${angle}) skewX(-3) scale(${scaleX} 1) translate(${-bounds.x - bounds.width / 2} ${-bounds.y - bounds.height / 2})`
    }
  })
}

function silhouette(sticker: Sticker, rows: ReturnType<typeof makeLettering>) {
  const { width, height, shape } = sticker
  const left = Math.min(width / 2 - 52, ...rows.map((row) => row.x - row.width / 2)) - 12
  const right = Math.max(width / 2 + 52, ...rows.map((row) => row.x + row.width / 2)) + 12
  const top = 23
  const bottom = height - 20
  const middle = (top + bottom) / 2
  switch (shape) {
    case 'die-cut':
      return (
        <>
          {rows.map((row, index) => (
            <rect
              key={index}
              x={-row.width / 2 - 7}
              y={row.cutTop}
              width={row.width + 14}
              height={row.cutBottom - row.cutTop}
              rx={12}
              transform={row.cutTransform}
            />
          ))}
          <rect x={width / 2 - 54} y={23} width={108} height={34} rx={14} />
          <rect x={width / 2 - 52} y={height - 59} width={104} height={39} rx={12} />
        </>
      )
    case 'rounded':
      return (
        <path
          d={`M${left + 26} ${top}H${right - 12}Q${right} ${top} ${right} ${top + 12}V${bottom - 26}Q${right} ${bottom} ${right - 26} ${bottom}H${left + 12}Q${left} ${bottom} ${left} ${bottom - 12}V${top + 26}Q${left} ${top} ${left + 26} ${top}Z`}
        />
      )
    case 'ticket':
      return (
        <path
          d={`M${left + 8} ${top}H${right - 8}Q${right} ${top} ${right} ${top + 8}V${middle - 8}A8 8 0 0 0 ${right} ${middle + 8}V${bottom - 8}Q${right} ${bottom} ${right - 8} ${bottom}H${left + 8}Q${left} ${bottom} ${left} ${bottom - 8}V${middle + 8}A8 8 0 0 0 ${left} ${middle - 8}V${top + 8}Q${left} ${top} ${left + 8} ${top}Z`}
        />
      )
    case 'beveled':
      return (
        <polygon
          points={`${left + 16},${top} ${right - 16},${top} ${right},${top + 16} ${right},${bottom - 16} ${right - 16},${bottom} ${left + 16},${bottom} ${left},${bottom - 16} ${left},${top + 16}`}
        />
      )
    case 'ribbon':
      return (
        <polygon
          points={`${left},${top} ${right},${top} ${right - 9},${middle} ${right},${bottom} ${left},${bottom} ${left + 9},${middle}`}
        />
      )
    case 'scalloped': {
      const corners = [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom]
      ]
      let path = `M${left} ${top}`
      corners.forEach(([x, y], index) => {
        const [endX, endY] = corners[(index + 1) % corners.length]
        const dx = endX - x
        const dy = endY - y
        const length = Math.hypot(dx, dy)
        const steps = Math.max(1, Math.round(length / 18))
        for (let step = 1; step <= steps; step++) {
          const midpoint = (step - 0.5) / steps
          path += `Q${x + dx * midpoint - (dy / length) * 7} ${y + dy * midpoint + (dx / length) * 7} ${x + (dx * step) / steps} ${y + (dy * step) / steps}`
        }
      })
      return <path d={`${path}Z`} />
    }
  }
}

function foilPattern(sticker: Sticker) {
  const { width, height, seed, hologram } = sticker
  const color = (index: number) => `hsl(${hashSlug(`${seed}:${index}`) % 360} 95% 60%)`
  switch (hologram) {
    case 'prism':
      return Array.from({ length: Math.ceil(width / 24) * Math.ceil(height / 24) }, (_, index) => {
        const x = (index % Math.ceil(width / 24)) * 24
        const y = Math.floor(index / Math.ceil(width / 24)) * 24
        return (
          <g key={index} stroke="#fff" strokeOpacity={0.8} strokeWidth={0.45}>
            <path d={`M${x} ${y}h24v24Z`} fill={color(index * 2)} />
            <path d={`M${x} ${y}v24h24Z`} fill={color(index * 2 + 1)} />
            <path d={`M${x} ${y}h24v24Z`} fill="url(#facet)" opacity={0.85} />
            <path d={`M${x} ${y}v24h24Z`} fill="url(#facet)" opacity={0.45} />
          </g>
        )
      })
    case 'glitter':
      return Array.from({ length: Math.ceil((width * height) / 4) }, (_, index) => {
        const random = hashSlug(`${seed}:grain:${index}`)
        return (
          <circle
            key={index}
            cx={((random % 10000) / 10000) * width}
            cy={(((random >>> 16) % 10000) / 10000) * height}
            r={index % 9 === 0 ? 1 : 0.4}
            fill={index % 3 === 0 ? '#fff' : index % 3 === 1 ? '#232048' : color(index)}
          />
        )
      })
    case 'aurora':
      return Array.from({ length: 7 }, (_, index) => (
        <g key={index} fill="none">
          <path
            d={`M${index * 75 - 180} -30C${index * 75 + 140} ${height * 0.4} ${index * 75 - 100} ${height * 0.6} ${index * 75 + 180} ${height + 30}`}
            stroke="url(#diffraction)"
            strokeWidth={70}
          />
          <path
            d={`M${index * 75 - 180} -30C${index * 75 + 140} ${height * 0.4} ${index * 75 - 100} ${height * 0.6} ${index * 75 + 180} ${height + 30}`}
            stroke="url(#facet)"
            strokeWidth={3}
          />
        </g>
      ))
    case 'laser':
      return Array.from({ length: Math.ceil(width / 48) * Math.ceil(height / 48) }, (_, index) => (
        <g
          key={index}
          transform={`translate(${(index % Math.ceil(width / 48)) * 48 + 24} ${Math.floor(index / Math.ceil(width / 48)) * 48 + 24})`}
        >
          {Array.from({ length: 8 }, (_, ring) => (
            <circle
              key={ring}
              r={3 + ring * 3}
              fill="none"
              stroke={ring % 3 === 0 ? 'url(#facet)' : 'url(#diffraction)'}
              strokeWidth={ring % 3 === 0 ? 1 : 2.5}
            />
          ))}
        </g>
      ))
  }
}

export async function renderSvg(post: BlogPostSummary) {
  const sticker = layoutStickers([post]).stickers[0]
  const { width, height, seed, angle, eyeCount } = sticker
  const rows = makeLettering(sticker)
  const outline = silhouette(sticker, rows)
  const colors = foilPalettes[hashSlug(`foil:${post.slug}`) % foilPalettes.length]
  const finish = seed % 3
  const glossVector = { x: 0.64 / width, y: -0.76 / height }
  const glossLength = 1.4 / (glossVector.x ** 2 + glossVector.y ** 2)
  // Account for rotation and the vinyl edge when fitting a portrait sticker into OG.
  const rotatedWidth = Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height
  const rotatedHeight = Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height
  const scale = Math.min(1040 / (rotatedWidth + 20), 540 / (rotatedHeight + 20))
  return svg(
    <>
      <desc>{post.description}</desc>
      <defs>
        <filter id="contact-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={1.5} />
          <feOffset dy={3} result="offset" />
          <feFlood floodColor="#000" floodOpacity={0.65} />
          <feComposite in2="offset" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="grid" width={64} height={64} patternUnits="userSpaceOnUse">
          <path
            d="M0 .5H64M.5 0V64"
            fill="none"
            stroke="#686868"
            strokeOpacity={0.5}
            strokeDasharray="1 7"
            strokeLinecap="round"
          />
        </pattern>
        <linearGradient id="foil" x1="0%" y1="100%" x2="100%" y2="0%">
          {[colors[0], colors[1], colors[2], colors[1], colors[0]].map((color, index) => (
            <stop key={index} offset={`${index * 25}%`} stopColor={color} />
          ))}
        </linearGradient>
        {/* Steep light/dark transitions make the rainbow read as reflective metal. */}
        <linearGradient id="diffraction" x1="0%" y1="0%" x2="100%" y2="100%">
          {[
            [0, '#211745'],
            [10, '#7650ff'],
            [22, '#ff58d0'],
            [32, '#fff5ba'],
            [38, '#fff'],
            [42, '#9bfff2'],
            [53, '#38bfee'],
            [61, '#393674'],
            [68, '#e287ff'],
            [77, '#ff91c8'],
            [85, '#fffac4'],
            [90, '#fff'],
            [100, '#77eeeb']
          ].map(([offset, color]) => (
            <stop key={offset} offset={`${offset}%`} stopColor={String(color)} />
          ))}
        </linearGradient>
        <linearGradient id="facet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#191431" stopOpacity={0.85} />
          <stop offset="36%" stopColor="#fff" stopOpacity={0.05} />
          <stop offset="49%" stopColor="#fff" stopOpacity={0.95} />
          <stop offset="53%" stopColor="#fff" stopOpacity={0.1} />
          <stop offset="80%" stopColor="#25234b" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0.9} />
        </linearGradient>
        <pattern id="foil-grain" width={32} height={32} patternUnits="userSpaceOnUse">
          {Array.from({ length: 160 }, (_, index) => {
            const random = hashSlug(`${seed}:foil-grain:${index}`)
            return (
              <circle
                key={index}
                cx={(random % 3200) / 100}
                cy={((random >>> 16) % 3200) / 100}
                r={index % 8 === 0 ? 0.45 : 0.2}
                fill={index % 3 === 0 ? '#302547' : '#fff'}
                opacity={index % 8 === 0 ? 0.8 : 0.4}
              />
            )
          })}
        </pattern>
        <radialGradient id="glint">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="18%" stopColor="#e9faff" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#e9faff" stopOpacity={0} />
        </radialGradient>
        <linearGradient
          id="gloss"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={height}
          x2={glossVector.x * glossLength}
          y2={height + glossVector.y * glossLength}
        >
          {/* Freeze the same broad softbox, narrow edge, and secondary reflection as the film. */}
          {Array.from({ length: 141 }, (_, index) => {
            const position = index / 100
            const reflection = (center: number, width: number) =>
              Math.exp(-(((position - center) / width) ** 2))
            const opacity =
              reflection(0.72, 0.19) * 0.24 +
              reflection(0.55, 0.018) * 0.32 +
              reflection(1.12, 0.07) * 0.12
            return <stop key={index} offset={index / 140} stopColor="#fff" stopOpacity={opacity} />
          })}
        </linearGradient>
        <clipPath id="cut">{outline}</clipPath>
        {rows.map((_, index) => (
          <linearGradient key={index} id={`ink-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
            {(finish === 2
              ? ['#fff', '#dce9f1', '#fafcff', '#798ca8', '#e3e4f5']
              : finish === 1
                ? ['#fff7e1', '#ffe2ad']
                : palettes[(seed + index) % palettes.length].slice(0, 2)
            ).map((color, stop, all) => (
              <stop
                key={stop}
                offset={`${finish === 2 ? [0, 42, 49, 53, 100][stop] : (stop / (all.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </linearGradient>
        ))}
      </defs>
      <rect width={imageWidth} height={imageHeight} fill="#101114" />
      <rect width={imageWidth} height={imageHeight} fill="url(#grid)" />
      <g
        transform={`translate(600 302) scale(${scale}) rotate(${(angle * 180) / Math.PI}) translate(${-width / 2} ${-height / 2})`}
      >
        <g
          fill={stickerMaterial.edge}
          stroke={stickerMaterial.edge}
          strokeWidth={15}
          strokeLinejoin="round"
          filter="url(#contact-shadow)"
        >
          {outline}
        </g>
        <g clipPath="url(#cut)">
          <rect width={width} height={height} fill="url(#foil)" />
          <rect width={width} height={height} fill="url(#diffraction)" opacity={0.24} />
          <g opacity={0.65}>{foilPattern(sticker)}</g>
          <rect width={width} height={height} fill="url(#foil)" opacity={0.28} />
          <rect width={width} height={height} fill="url(#facet)" opacity={0.16} />
          <rect
            width={width}
            height={height}
            fill="url(#foil-grain)"
            opacity={
              sticker.hologram === 'glitter' ? 1 : sticker.hologram === 'aurora' ? 0.07 : 0.18
            }
          />
          {/* Freeze small specular flashes around the print, so the title stays crisp. */}
          {[
            [width * 0.2, 33],
            [width - 25, height * 0.43],
            [30, height * 0.7],
            [width * 0.76, height - 28]
          ].map(([x, y], index) => (
            <g key={index} transform={`translate(${x} ${y})`}>
              <circle r={15} fill="url(#glint)" />
              <path d="M0 -8L1.4 -1.4L8 0L1.4 1.4L0 8L-1.4 1.4L-8 0L-1.4 -1.4Z" fill="#fff" />
            </g>
          ))}
        </g>
        {rows.map((row, index) => (
          <g
            key={index}
            transform={row.transform}
            fill="none"
            stroke={
              finish === 1 ? palettes[(seed >>> 8) % palettes.length][2] : stickerMaterial.keyline
            }
            strokeLinejoin="round"
          >
            {[2, 1, 0].map((depth) => (
              <g key={depth} transform={`translate(${depth * 0.45} ${depth})`}>
                {row.text(true)}
              </g>
            ))}
          </g>
        ))}
        {rows.map((row, index) => (
          <g
            key={index}
            transform={row.transform}
            fill={`url(#ink-${index})`}
            stroke={`url(#ink-${index})`}
            strokeLinejoin="round"
          >
            {row.text()}
          </g>
        ))}
        {Array.from({ length: eyeCount }, (_, index) => (
          <g
            key={index}
            transform={`translate(${width / 2 + (index - (eyeCount - 1) / 2) * (eyeCount > 3 ? 18 : 24)} 35)`}
          >
            <rect
              x={-4.8}
              y={-8}
              width={9.6}
              height={16}
              rx={2.2}
              fill="#060606"
              stroke="#fff"
              strokeWidth={1.6}
              paintOrder="stroke fill"
            />
            <rect x={-2.5} y={-5.7} width={5} height={9.2} rx={0.6} fill="#fff" />
          </g>
        ))}
        <text
          x={width / 2}
          y={height - 26}
          textAnchor="middle"
          fontFamily="IBM Plex Mono"
          fontWeight={700}
          fontSize={12}
          fill={stickerMaterial.keyline}
        >
          {post.date.replaceAll('-', '.')}
        </text>
        <path
          d={`M${width / 2 - 46} 30l1.4 4.6 4.6 1.4-4.6 1.4-1.4 4.6-1.4-4.6-4.6-1.4 4.6-1.4Z`}
          fill={stickerMaterial.edge}
        />
        <path
          d="M0 -5L1.2 -1.2L5 0L1.2 1.2L0 5L-1.2 1.2L-5 0L-1.2 -1.2Z"
          transform={`translate(${width / 2 + 46} ${height - 30})`}
          fill={stickerMaterial.edge}
        />
        <g clipPath="url(#cut)">
          <rect width={width} height={height} fill="url(#gloss)" opacity={0.48} />
        </g>
      </g>
      <text
        x={1160}
        y={596}
        textAnchor="end"
        fontFamily="Noto Sans CJK JP"
        fontWeight={700}
        fontSize={18}
        fill="#c1beca"
      >
        Tlazolteotnia / 0RGA.ORG
      </text>
    </>,
    post.title
  )
}

export async function renderOgPng(post: BlogPostSummary) {
  return new Resvg(await renderSvg(post), { font: fontOptions }).render().asPng()
}
