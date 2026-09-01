import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { FaRotate } from 'react-icons/fa6'
import { CommunityLayout } from '#/components/community-layout'
import {
  createSolvableBoard,
  getAffectedCells,
  isBoardCleared,
  LIGHTS_OUT_SIZE,
  pressCell,
  type LightsOutBoard
} from '#/lib/lights-out'
import { siteName } from '#/lib/site'

export const Route = createFileRoute('/app/lights-out')({
  loader: () => ({ initialBoard: createSolvableBoard() }),
  head: () => ({
    meta: [
      { title: `Lights Out | ${siteName}` },
      {
        name: 'description',
        content: '上下左右のライトを反転させ、すべての光を消す5×5のライツアウト。'
      }
    ]
  }),
  component: LightsOutPage
})

function LightsOutPage() {
  const { initialBoard }: { initialBoard: LightsOutBoard } = Route.useLoaderData()
  const [board, setBoard] = useState(initialBoard)
  const [moves, setMoves] = useState(0)
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  const cleared = isBoardCleared(board)
  const litCount = board.filter(Boolean).length
  const affectedCells = new Set(hoveredCell === null ? [] : getAffectedCells(hoveredCell))

  function handlePress(index: number) {
    if (cleared) return
    setBoard((current) => pressCell(current, index))
    setMoves((current) => current + 1)
  }

  function startNewGame() {
    setBoard(createSolvableBoard())
    setMoves(0)
    setHoveredCell(null)
  }

  return (
    <CommunityLayout
      activeSection="lights-out"
      channelLabel="lights-out"
      channelMeta="Turn every signal dark."
      detailsEnabled={false}
      statusLabel={cleared ? 'all clear' : 'game active'}
    >
      <div className="min-h-[calc(100svh-3.5rem)] w-full" data-post-accent="yellow">
        <section className="mx-auto w-full max-w-[860px] px-3 py-4 min-[480px]:px-4 min-[680px]:px-6 min-[680px]:py-6">
          <h1 className="sr-only">Lights Out</h1>
          <div className="lights-out-console mx-auto w-full max-w-[590px]">
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(112,247,255,0.13)] px-3 py-3 min-[480px]:px-5 min-[480px]:py-4">
              <div className="flex min-w-0 items-center gap-5 min-[480px]:gap-8">
                <GameStat label="Turns" value={moves} />
                <GameStat label="Lit" value={litCount} />
              </div>
              <button
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[rgba(112,247,255,0.24)] bg-[rgba(112,247,255,0.06)] px-3 text-[0.68rem] font-bold tracking-[0.06em] text-[var(--cyan)] uppercase transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-[rgba(112,247,255,0.58)] hover:bg-[rgba(112,247,255,0.11)] [font-family:var(--font-mono)]"
                onClick={startNewGame}
                type="button"
              >
                <FaRotate aria-hidden="true" />
                New game
              </button>
            </div>

            <div className="px-2 pt-3 pb-2 min-[480px]:px-5 min-[480px]:pt-5">
              <fieldset
                className="lights-out-board m-0 grid grid-cols-5 gap-[clamp(0.35rem,1.8vw,0.7rem)] border-0 p-[clamp(0.55rem,2.6vw,1rem)]"
                onMouseLeave={() => setHoveredCell(null)}
              >
                <legend className="sr-only">Lights Out board</legend>
                {board.map((lit, index) => {
                  const row = Math.floor(index / LIGHTS_OUT_SIZE) + 1
                  const column = (index % LIGHTS_OUT_SIZE) + 1
                  const previewed = affectedCells.has(index)

                  return (
                    <button
                      aria-label={`Row ${row}, column ${column}: light ${lit ? 'on' : 'off'}`}
                      aria-pressed={lit}
                      className={`lights-out-cell ${lit ? 'lights-out-cell--on' : ''} ${
                        previewed ? 'lights-out-cell--preview' : ''
                      }`}
                      disabled={cleared}
                      key={index}
                      onClick={() => handlePress(index)}
                      onFocus={() => setHoveredCell(index)}
                      onMouseEnter={() => setHoveredCell(index)}
                      onBlur={() => setHoveredCell(null)}
                      type="button"
                    >
                      <span className="lights-out-cell__lamp" aria-hidden="true" />
                    </button>
                  )
                })}
              </fieldset>
            </div>

            <div
              aria-live="polite"
              className={`mx-2 mb-2 flex min-h-14 items-center justify-center border-t px-4 text-center text-[0.72rem] font-bold tracking-[0.12em] uppercase min-[480px]:mx-5 [font-family:var(--font-mono)] ${
                cleared
                  ? 'border-[rgba(255,223,95,0.32)] text-[var(--yellow)] [text-shadow:0_0_14px_rgba(255,223,95,0.6)]'
                  : 'border-[rgba(112,247,255,0.12)] text-[var(--dim)]'
              }`}
            >
              {cleared ? `All clear / ${moves} turns` : `${litCount} lights remain`}
            </div>
          </div>
        </section>
      </div>
    </CommunityLayout>
  )
}

function GameStat({ label, value }: { label: string; value: number }) {
  return (
    <p className="m-0 grid gap-0.5 [font-family:var(--font-mono)]">
      <span className="text-[0.56rem] font-bold tracking-[0.12em] text-[var(--dim)] uppercase">
        {label}
      </span>
      <strong className="text-[1.3rem] leading-none text-[var(--text-strong)]">{value}</strong>
    </p>
  )
}
