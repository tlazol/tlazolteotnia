import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { FaLightbulb, FaRotate } from 'react-icons/fa6'
import { CommunityLayout } from '#/components/community-layout'
import { LightsOutCube, LightsOutCubeFallback } from '#/components/lights-out-cube'
import {
  createSolvableBoard,
  findShortestSolution,
  isBoardCleared,
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
        content: '立方体の辺を越えて上下左右のライトを反転させ、すべての光を消す3Dライツアウト。'
      }
    ]
  }),
  component: LightsOutPage
})

function LightsOutPage() {
  const { initialBoard }: { initialBoard: LightsOutBoard } = Route.useLoaderData()
  const [board, setBoard] = useState(initialBoard)
  const [moves, setMoves] = useState(0)
  const [hintsRemaining, setHintsRemaining] = useState(3)
  const [hintedCell, setHintedCell] = useState<number | null>(null)
  const cleared = isBoardCleared(board)
  const litCount = board.filter(Boolean).length

  function handlePress(index: number) {
    if (cleared) return
    setBoard((current) => pressCell(current, index))
    setMoves((current) => current + 1)
    setHintedCell(null)
  }

  function showHint() {
    if (cleared || hintsRemaining === 0 || hintedCell !== null) return
    const nextCell = findShortestSolution(board)?.[0]
    if (nextCell === undefined) return
    setHintedCell(nextCell)
    setHintsRemaining((current) => current - 1)
  }

  function startNewGame() {
    setBoard(createSolvableBoard())
    setMoves(0)
    setHintsRemaining(3)
    setHintedCell(null)
  }

  return (
    <CommunityLayout
      activeSection="lights-out"
      channelLabel="lights-out"
      channelMeta="Turn every signal dark."
      detailsEnabled={false}
      headerOverlay
      statusLabel={cleared ? 'all clear' : 'game active'}
    >
      <div className="min-h-svh w-full" data-post-accent="pink">
        <section className="w-full">
          <h1 className="sr-only">Lights Out</h1>
          <div className="lights-out-console w-full">
            <div className="pointer-events-none absolute inset-x-3 top-[4.25rem] z-[3] flex items-start justify-between gap-3 min-[480px]:inset-x-5 min-[680px]:inset-x-7">
              <div className="flex min-w-0 items-center gap-5 py-2 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)] min-[480px]:gap-8">
                <GameStat label="Turns" value={moves} />
                <GameStat label="Lit" value={litCount} />
              </div>
              <div className="pointer-events-auto flex shrink-0 items-center gap-3 min-[480px]:gap-5">
                <button
                  aria-label={`Show hint, ${hintsRemaining} remaining`}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 border-0 bg-transparent px-0 text-[0.68rem] font-bold tracking-[0.06em] text-[var(--cyan)] uppercase [text-shadow:0_2px_12px_rgba(0,0,0,0.9)] transition-[color,text-shadow,transform] hover:-translate-y-0.5 hover:text-white hover:[text-shadow:0_0_14px_rgba(112,247,255,0.72)] focus-visible:text-white focus-visible:outline-none focus-visible:[text-shadow:0_0_14px_rgba(112,247,255,0.9)] disabled:cursor-default disabled:text-[var(--dim)] disabled:hover:translate-y-0 disabled:hover:[text-shadow:0_2px_12px_rgba(0,0,0,0.9)] [font-family:var(--font-mono)]"
                  disabled={cleared || hintsRemaining === 0 || hintedCell !== null}
                  onClick={showHint}
                  type="button"
                >
                  <FaLightbulb aria-hidden="true" />
                  Hint {hintsRemaining}
                </button>
                <button
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 border-0 bg-transparent px-0 text-[0.68rem] font-bold tracking-[0.06em] text-[var(--cyan)] uppercase [text-shadow:0_2px_12px_rgba(0,0,0,0.9)] transition-[color,text-shadow,transform] hover:-translate-y-0.5 hover:text-white hover:[text-shadow:0_0_14px_rgba(112,247,255,0.72)] focus-visible:text-white focus-visible:outline-none focus-visible:[text-shadow:0_0_14px_rgba(112,247,255,0.9)] [font-family:var(--font-mono)]"
                  onClick={startNewGame}
                  type="button"
                >
                  <FaRotate aria-hidden="true" />
                  New game
                </button>
              </div>
            </div>

            <div className="relative z-[1] h-svh min-h-0">
              <ClientOnly fallback={<LightsOutCubeFallback />}>
                <LightsOutCube
                  board={board}
                  cleared={cleared}
                  hintedCell={hintedCell}
                  onPress={handlePress}
                />
              </ClientOnly>
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
