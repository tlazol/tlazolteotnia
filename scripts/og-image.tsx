import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { siteName, siteOrigin } from '../app/lib/site'

const imageWidth = 1200
const imageHeight = 630

export function getTitleFontSize(title: string) {
  const length = [...title].length

  if (length <= 26) {
    return 70
  }

  if (length <= 42) {
    return 60
  }

  if (length <= 60) {
    return 50
  }

  return 44
}

export async function renderSvg(title: string, date: string, font: Buffer) {
  const titleFontSize = getTitleFontSize(title)
  const signalColors = ['#ff3b81', '#ff7a3d', '#ffe34d', '#65ff8f', '#3ce7ff', '#7857ff']
  const ornaments = [
    { top: 48, left: 50, width: 102, height: 24, radius: 24, color: '#ff3b81', rotate: -8 },
    { top: 26, left: 202, width: 54, height: 54, radius: 54, color: '#ffb13d', rotate: 18 },
    { top: 54, left: 316, width: 88, height: 18, radius: 18, color: '#ffe34d', rotate: 5 },
    { top: 18, left: 452, width: 26, height: 26, radius: 26, color: '#65ff8f', rotate: 0 },
    { top: 58, left: 536, width: 28, height: 28, radius: 6, color: '#3ce7ff', rotate: 45 },
    { top: 24, left: 674, width: 18, height: 18, radius: 18, color: '#7857ff', rotate: 0 },
    { top: 60, left: 770, width: 26, height: 26, radius: 7, color: '#ff3b81', rotate: 16 },
    { top: 34, left: 892, width: 76, height: 22, radius: 22, color: '#3ce7ff', rotate: -12 },
    { top: 54, left: 1024, width: 62, height: 42, radius: 42, color: '#7857ff', rotate: 14 },
    { top: 166, left: 18, width: 26, height: 26, radius: 26, color: '#3ce7ff', rotate: 0 },
    { top: 302, left: 28, width: 18, height: 18, radius: 5, color: '#ffe34d', rotate: 45 },
    { top: 442, left: 16, width: 32, height: 32, radius: 8, color: '#ff3b81', rotate: 14 },
    { top: 154, left: 1158, width: 30, height: 30, radius: 30, color: '#65ff8f', rotate: 0 },
    { top: 302, left: 1152, width: 20, height: 20, radius: 20, color: '#ffb13d', rotate: 0 },
    { top: 448, left: 1158, width: 28, height: 28, radius: 7, color: '#3ce7ff', rotate: -14 },
    { top: 548, left: 78, width: 68, height: 30, radius: 30, color: '#7857ff', rotate: 9 },
    { top: 570, left: 218, width: 112, height: 18, radius: 18, color: '#3ce7ff', rotate: -6 },
    { top: 556, left: 398, width: 22, height: 22, radius: 22, color: '#ff3b81', rotate: 0 },
    { top: 540, left: 520, width: 28, height: 28, radius: 7, color: '#ffb13d', rotate: 45 },
    { top: 574, left: 700, width: 18, height: 18, radius: 18, color: '#7857ff', rotate: 0 },
    { top: 540, left: 786, width: 30, height: 30, radius: 7, color: '#ffe34d', rotate: 18 },
    { top: 546, left: 870, width: 86, height: 28, radius: 28, color: '#65ff8f', rotate: 12 },
    { top: 570, left: 1036, width: 100, height: 18, radius: 18, color: '#ff3b81', rotate: -7 }
  ]

  return satori(
    <div
      style={{
        width: imageWidth,
        height: imageHeight,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: '#070511',
        color: '#faf8ff',
        fontFamily: 'Noto Sans JP',
        fontWeight: 700
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage:
            'radial-gradient(circle at 14% 8%, rgba(120, 87, 255, 0.35), transparent 29%), radial-gradient(circle at 90% 92%, rgba(255, 59, 129, 0.25), transparent 30%), linear-gradient(135deg, #0b0820 0%, #05040d 54%, #10061d 100%)'
        }}
      />

      {/* This SVG is rendered by Satori to a PNG and is never mounted in the browser DOM. */}
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: raster image source, not DOM content */}
      <svg
        width={imageWidth}
        height={imageHeight}
        viewBox={`0 0 ${imageWidth} ${imageHeight}`}
        style={{
          position: 'absolute',
          inset: 0
        }}
      >
        <defs>
          <linearGradient id="rainbow-signal" x1="0" y1="0" x2="1" y2="0">
            {signalColors.map((color, index) => (
              <stop
                key={color}
                offset={`${(index / (signalColors.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </linearGradient>
          <filter id="neon-glow" x="-30%" y="-100%" width="160%" height="300%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M -40 112 C 150 -38, 274 112, 410 46 C 560 -28, 676 136, 838 54 C 1000 -30, 1088 110, 1240 30"
          fill="none"
          stroke="url(#rainbow-signal)"
          strokeLinecap="round"
          strokeWidth="6"
          opacity="0.9"
          filter="url(#neon-glow)"
        />
        <path
          d="M -24 594 C 148 494, 304 654, 456 572 C 594 498, 750 648, 900 566 C 1030 496, 1130 590, 1234 522"
          fill="none"
          stroke="url(#rainbow-signal)"
          strokeLinecap="round"
          strokeWidth="6"
          opacity="0.82"
          filter="url(#neon-glow)"
        />
      </svg>

      {ornaments.map((ornament) => (
        <div
          key={`${ornament.top}-${ornament.left}`}
          style={{
            position: 'absolute',
            top: ornament.top,
            left: ornament.left,
            width: ornament.width,
            height: ornament.height,
            display: 'flex',
            border: `2px solid ${ornament.color}`,
            borderRadius: ornament.radius,
            background: `${ornament.color}22`,
            boxShadow: `0 0 8px ${ornament.color}, 0 0 24px ${ornament.color}88`,
            transform: `rotate(${ornament.rotate}deg)`
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          top: 104,
          right: 70,
          bottom: 104,
          left: 70,
          display: 'flex',
          border: '1px solid rgba(196, 177, 255, 0.42)',
          borderRadius: 30,
          background: 'rgba(11, 8, 31, 0.94)',
          boxShadow: '0 0 28px rgba(120, 87, 255, 0.24), inset 0 0 32px rgba(60, 231, 255, 0.06)'
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 105,
          left: 108,
          width: 164,
          height: 5,
          display: 'flex',
          borderRadius: 6,
          background:
            'linear-gradient(90deg, #ff3b81, #ffb13d, #ffe34d, #65ff8f, #3ce7ff, #7857ff)',
          boxShadow: '0 0 18px rgba(60, 231, 255, 0.85)'
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 138,
          left: 116,
          display: 'flex',
          alignItems: 'center',
          color: '#9e94c4',
          fontSize: 19,
          letterSpacing: '0.16em'
        }}
      >
        <span style={{ marginRight: 12, color: '#3ce7ff' }}>●</span>
        ARTICLE / {date.replaceAll('-', '.')}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 184,
          right: 116,
          bottom: 190,
          left: 116,
          display: 'flex',
          alignItems: 'center',
          color: '#faf8ff',
          fontSize: titleFontSize,
          lineHeight: 1.16,
          letterSpacing: '-0.045em',
          overflowWrap: 'anywhere'
        }}
      >
        {title}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 135,
          left: 116,
          display: 'flex',
          alignItems: 'center',
          color: '#d6d0ef',
          fontSize: 22,
          letterSpacing: '0.12em'
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            marginRight: 16,
            display: 'flex',
            border: '2px solid #ff3b81',
            transform: 'rotate(45deg)'
          }}
        />
        {siteName}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 116,
          bottom: 135,
          display: 'flex',
          alignItems: 'center',
          color: '#81789f',
          fontSize: 18,
          letterSpacing: '0.16em'
        }}
      >
        {new URL(siteOrigin).host.toUpperCase()}
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
