import { type CSSProperties, memo, type RefObject, useEffect, useRef, useState } from 'react'
import { townHalloween } from '#/lib/town-halloween'

type Status = 'loading' | 'ready' | 'failed'
type Phase = 'loading' | 'complete' | 'leaving' | 'done'

const TILE_X = 22
const TILE_Y = 11
const COMPLETE_MS = 450
const IRIS_MS = 800
// Where the newcomer stands in the stage's viewBox once it has walked in.
const NEWCOMER = { x: 0, y: 58 }

const lines = [
  '街に灯りをともしています',
  '住人たちが身じたくをしています',
  townHalloween ? 'かぼちゃにろうそくを入れています' : '広場をほうきではいています',
  'あたらしい住人が、だれかを待っています…'
]

function point(i: number, j: number, z = 0) {
  return `${(i - j) * TILE_X},${(i + j) * TILE_Y - z}`
}

function polygon(...corners: [number, number, number][]) {
  return corners.map(([i, j, z]) => point(i, j, z)).join(' ')
}

type Building = {
  i: number
  j: number
  w: number
  d: number
  h: number
  roof: string
}

const buildings: Building[] = [
  { i: 0.4, j: 0.6, w: 1.6, d: 1.6, h: 70, roof: '#7a3fb8' },
  { i: 0.6, j: 4.4, w: 1.8, d: 1.8, h: 38, roof: '#5e4a7c' },
  { i: 4.4, j: 0.6, w: 1.8, d: 1.8, h: 46, roof: '#8f4a2a' },
  { i: 2.6, j: 0.5, w: 1.2, d: 1.2, h: 26, roof: '#4a6b5c' },
  { i: 4.6, j: 4.8, w: 1.4, d: 1.4, h: 20, roof: '#b8282e' },
  { i: 5.6, j: 2.8, w: 1.2, d: 1.4, h: 30, roof: '#5e4a7c' }
]

// Windows are spread over both visible walls so each building lights up floor by floor.
function windows({ i, j, w, d, h }: Building) {
  const panes: string[] = []
  for (let z = 8; z + 8 <= h - 4; z += 13) {
    for (let a = 0.25; a + 0.3 <= w - 0.15; a += 0.55) {
      panes.push(
        polygon(
          [i + a, j + d, z],
          [i + a + 0.3, j + d, z],
          [i + a + 0.3, j + d, z + 7],
          [i + a, j + d, z + 7]
        )
      )
    }
    for (let a = 0.25; a + 0.3 <= d - 0.15; a += 0.55) {
      panes.push(
        polygon(
          [i + w, j + a, z],
          [i + w, j + a + 0.3, z],
          [i + w, j + a + 0.3, z + 7],
          [i + w, j + a, z + 7]
        )
      )
    }
  }
  return panes
}

const lamps: [number, number][] = [
  [2.7, 2.7],
  [4.5, 3.2],
  [2.6, 4.6]
]
const pumpkins: [number, number][] = [
  [1.4, 3.1],
  [3.2, 5.9],
  [5.9, 1.4],
  [3.9, 2.2],
  [6.3, 4.4]
]
const stars: [number, number, number][] = [
  [-140, -70, 0],
  [-96, -96, 1],
  [-40, -84, 2],
  [60, -100, 3],
  [118, -64, 4],
  [150, -20, 5],
  [-160, 4, 6],
  [100, 6, 7]
]

function custom(name: string, value: number | string) {
  return { [name]: value } as CSSProperties
}

function teaser(title: string | undefined) {
  if (!title) return ''
  const glyphs = Array.from(title)
  return glyphs.length > 3 ? `${glyphs.slice(0, 3).join('')}…` : title
}

// The stage is static markup driven by CSS, so the ticking counter and typing do not re-render it.
const TownLoadingStage = memo(function TownLoadingStage({
  complete,
  stage
}: {
  complete: boolean
  stage: RefObject<SVGSVGElement | null>
}) {
  return (
    <svg ref={stage} className="town-loading__stage" viewBox="-180 -120 360 290" aria-hidden="true">
      <g className="town-loading__sky">
        {stars.map(([x, y, n]) => (
          <circle key={n} cx={x} cy={y} r={n % 3 ? 1.2 : 1.8} style={custom('--n', n)} />
        ))}
        {townHalloween && (
          <g className="town-loading__bats">
            <path d="M-118 -44 q6 -6 10 0 q4 -6 10 0 q-4 0 -5 4 q-1 -4 -5 0 q-1 -4 -5 0 z" />
            <path d="M96 -78 q5 -5 8 0 q3 -5 8 0 q-3 0 -4 3 q-1 -3 -4 0 q-1 -3 -4 0 z" />
          </g>
        )}
      </g>
      <g className="town-loading__ground">
        <polygon
          className="is-side-left"
          points={polygon([0, 7, 0], [7, 7, 0], [7, 7, -10], [0, 7, -10])}
        />
        <polygon
          className="is-side-right"
          points={polygon([7, 0, 0], [7, 7, 0], [7, 7, -10], [7, 0, -10])}
        />
        <polygon className="is-top" points={polygon([0, 0, 0], [7, 0, 0], [7, 7, 0], [0, 7, 0])} />
        <polygon className="is-road" points={polygon([3, 0, 0], [4, 0, 0], [4, 7, 0], [3, 7, 0])} />
        <polygon className="is-road" points={polygon([0, 3, 0], [7, 3, 0], [7, 4, 0], [0, 4, 0])} />
      </g>
      {buildings.map((building, n) => {
        const { i, j, w, d, h, roof } = building
        return (
          <g key={n} className="town-loading__building" style={custom('--n', n)}>
            <polygon
              className="is-wall-left"
              points={polygon([i, j + d, 0], [i + w, j + d, 0], [i + w, j + d, h], [i, j + d, h])}
            />
            <polygon
              className="is-wall-right"
              points={polygon([i + w, j, 0], [i + w, j + d, 0], [i + w, j + d, h], [i + w, j, h])}
            />
            <polygon
              points={polygon([i, j, h], [i + w, j, h], [i + w, j + d, h], [i, j + d, h])}
              fill={roof}
            />
            {windows(building).map((points, pane) => (
              <polygon
                key={pane}
                className="town-loading__window"
                points={points}
                style={custom('--n', n * 0.6 + pane * 0.13)}
              />
            ))}
          </g>
        )
      })}
      {lamps.map(([i, j], n) => (
        <g key={n} className="town-loading__lamp" style={custom('--n', n)}>
          <line
            x1={(i - j) * TILE_X}
            y1={(i + j) * TILE_Y}
            x2={(i - j) * TILE_X}
            y2={(i + j) * TILE_Y - 18}
          />
          <circle cx={(i - j) * TILE_X} cy={(i + j) * TILE_Y - 20} r="3" />
        </g>
      ))}
      {townHalloween &&
        pumpkins.map(([i, j], n) => (
          <g key={n} className="town-loading__pumpkin" style={custom('--n', n)}>
            <ellipse cx={(i - j) * TILE_X} cy={(i + j) * TILE_Y - 4} rx="6" ry="4.5" />
            <rect x={(i - j) * TILE_X - 1} y={(i + j) * TILE_Y - 10.5} width="2" height="3" />
          </g>
        ))}
      <g className="town-loading__newcomer">
        <g className="town-loading__walker">
          <ellipse className="town-loading__shadow" cx="0" cy="77" rx="10" ry="4" />
          <g className="town-loading__body">
            <rect x="-7" y="58" width="14" height="17" rx="5" />
            <circle cx="0" cy="48" r="11" />
          </g>
          <g className="town-loading__question">
            <rect x="-11" y="14" width="22" height="20" rx="2" />
            <path d="M-3 34 h6 v3 h-2 v3 h-2 v-3 h-2 z" />
            <text x="0" y="29.5">
              {complete ? '!' : '?'}
            </text>
          </g>
          <g className="town-loading__new">
            <rect x="-15" y="-4" width="30" height="13" rx="4" />
            <text x="0" y="5.5">
              New
            </text>
          </g>
        </g>
      </g>
      <defs>
        <linearGradient id="town-loading-new" x1="0" x2="1" y1="0" y2="0.3">
          <stop offset="0" stopColor="#96e5ef" />
          <stop offset="0.5" stopColor="#e8c8ff" />
          <stop offset="1" stopColor="#fff5d4" />
        </linearGradient>
      </defs>
    </svg>
  )
})

export function TownLoading({
  status,
  residents,
  newestTitle
}: {
  status: Status
  residents: number
  newestTitle?: string
}) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [arrived, setArrived] = useState(0)
  // The server-rendered first line is complete, so the box is not empty before hydration.
  const [typing, setTyping] = useState({ line: 0, chars: lines[0].length })
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<SVGSVGElement>(null)
  const total = Math.max(residents, 1)

  useEffect(() => {
    if (status === 'loading') {
      setPhase('loading')
      return
    }
    if (status === 'failed') {
      setPhase('done')
      return
    }
    setPhase('complete')
    // The iris opens from the newcomer's resting spot, even if it was still walking in.
    const element = root.current
    const matrix = stage.current?.getScreenCTM()
    if (element && matrix) {
      const center = new DOMPoint(NEWCOMER.x, NEWCOMER.y).matrixTransform(matrix)
      const bounds = element.getBoundingClientRect()
      element.style.setProperty('--iris-x', `${center.x - bounds.left}px`)
      element.style.setProperty('--iris-y', `${center.y - bounds.top}px`)
    }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const leave = setTimeout(() => setPhase('leaving'), reduce ? 0 : COMPLETE_MS)
    const done = setTimeout(() => setPhase('done'), reduce ? 250 : COMPLETE_MS + IRIS_MS)
    return () => {
      clearTimeout(leave)
      clearTimeout(done)
    }
  }, [status, total])

  // Residents arrive quickly at first, but the last one waits for the town to open.
  useEffect(() => {
    if (phase !== 'loading') return
    const start = performance.now()
    const timer = setInterval(() => {
      const elapsed = performance.now() - start
      setArrived(Math.round((total - 1) * (1 - Math.exp(-elapsed / 700))))
    }, 60)
    return () => clearInterval(timer)
  }, [phase, total])

  useEffect(() => {
    if (phase !== 'loading') return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const timer = setInterval(
        () => setTyping(({ line }) => ({ line: (line + 1) % lines.length, chars: Infinity })),
        2400
      )
      setTyping({ line: 0, chars: Infinity })
      return () => clearInterval(timer)
    }
    const hold = 26
    const timer = setInterval(() => {
      setTyping(({ line, chars }) =>
        chars < lines[line].length + hold
          ? { line, chars: chars + 1 }
          : { line: (line + 1) % lines.length, chars: 0 }
      )
    }, 55)
    return () => clearInterval(timer)
  }, [phase])

  if (phase === 'done') return null
  const complete = phase !== 'loading'
  const line = complete ? '全員そろいました！ ようこそ' : lines[typing.line]
  const shown = complete ? line : line.slice(0, typing.chars)
  const present = complete ? total : arrived
  const segments = 12
  const filled = Math.round((present / total) * segments)
  const rumor = teaser(newestTitle)

  return (
    <div ref={root} className="town-loading" data-phase={phase} role="status">
      <p className="sr-only">{complete ? '街の準備ができました' : '街を読み込んでいます'}</p>
      <TownLoadingStage complete={complete} stage={stage} />
      <div className="town-loading__window-box" aria-hidden="true">
        <p className="town-loading__message">
          {shown}
          <span className="town-loading__caret">▼</span>
        </p>
        <div className="town-loading__meter">
          <span className="town-loading__segments">
            {Array.from({ length: segments }, (_, n) => (
              <span key={n} className={n < filled ? 'is-filled' : undefined} />
            ))}
          </span>
          <span className="town-loading__count">
            住人 {String(present).padStart(2, '0')}/{String(total).padStart(2, '0')}
          </span>
        </div>
        <p className="town-loading__hint">
          {complete
            ? 'さあ、街へ'
            : total - present === 1
              ? 'あと1人… 最後はうわさの新入りです'
              : rumor
                ? `うわさの新入りは「${rumor}」の話をするらしい`
                : 'だれが待っているかな？'}
        </p>
      </div>
    </div>
  )
}
