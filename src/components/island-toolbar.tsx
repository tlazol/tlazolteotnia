import { useEffect, useId, useRef, useState } from 'react'
import type { PixelBuffer } from '#/lib/island-art'
import { type EditOptions, type IslandTool, toolNames } from '#/lib/island-edit'
import { type ConnectionState, type EditBlock, editBlock, estimateActor } from '#/lib/island-status'
import type { ThumbnailRequest, ThumbnailResponse } from '#/lib/island-thumbnails.worker'
import {
  type DecorKind,
  decorGroups,
  decorInfo,
  decorKinds,
  groundGroups,
  groundNames,
  type LandGround,
  landGrounds,
  resortLightNames
} from '#/lib/island-world'
import { type IconName, PixelIcon } from './island-icons'

const tools: Array<{ tool: IslandTool; icon: IconName; short: string; key: string }> = [
  { tool: 'land', icon: 'land', short: '土地', key: '1' },
  { tool: 'erase', icon: 'erase', short: '削る', key: '2' },
  { tool: 'decor', icon: 'decor', short: '装飾', key: '3' },
  { tool: 'remove', icon: 'remove', short: '撤去', key: '4' }
]
const heightTools = [
  { tool: 'raise', icon: 'plus', short: '盛る', key: '5' },
  { tool: 'lower', icon: 'minus', short: '掘る', key: '6' }
] as const
export const toolShortcuts = Object.fromEntries(
  [...tools, ...heightTools].map(({ key, tool }) => [key, tool])
)

// Pixels of ground across a swatch; it is shown at two screen pixels each, as
// the island is at its first zoom.
const GROUND_SWATCH = 9

function GroundSwatch({ src }: { src: string | undefined }) {
  return src ? (
    <img className="island-swatch" src={src} alt="" />
  ) : (
    <span className="island-swatch" aria-hidden="true" />
  )
}

type Thumbnails = {
  grounds: Partial<Record<LandGround, string>>
  decor: Partial<Record<DecorKind, string[]>>
}

// Pictures of every ground and every look of every decoration, drawn in a
// worker the way the island draws them. Nothing is drawn until the toolbar is
// first opened; the decoration picked then comes first.
function useThumbnails(open: boolean, firstKind: DecorKind) {
  const [thumbnails, setThumbnails] = useState<Thumbnails>({ grounds: {}, decor: {} })
  const firstKindRef = useRef(firstKind)
  firstKindRef.current = firstKind
  const [started, setStarted] = useState(false)
  if (open && !started) setStarted(true)
  useEffect(() => {
    if (!started) return
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return
    const toUrl = ({ width, height, data }: PixelBuffer) => {
      canvas.width = width
      canvas.height = height
      context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0)
      return canvas.toDataURL()
    }
    const worker = new Worker(new URL('../lib/island-thumbnails.worker.ts', import.meta.url), {
      type: 'module'
    })
    worker.onmessage = (event: MessageEvent<ThumbnailResponse>) => {
      const message = event.data
      if (message.type === 'grounds') {
        const grounds = Object.fromEntries(
          message.grounds.map(([ground, buffer]) => [ground, toUrl(buffer)])
        )
        setThumbnails((previous) => ({ ...previous, grounds }))
      } else if (message.type === 'decor') {
        const looks = message.looks.map(toUrl)
        setThumbnails((previous) => ({
          ...previous,
          decor: { ...previous.decor, [message.kind]: looks }
        }))
      } else {
        console.error('Palette thumbnails failed:', message.message)
      }
    }
    const first = firstKindRef.current
    const request: ThumbnailRequest = {
      grounds: landGrounds,
      groundSize: GROUND_SWATCH,
      kinds: [first, ...decorKinds.filter((kind) => kind !== first)]
    }
    worker.postMessage(request)
    return () => worker.terminate()
  }, [started])
  return thumbnails
}

export function IslandToolbar({
  open,
  options,
  onOptions,
  panTool,
  onPanTool,
  shared,
  now
}: {
  open: boolean
  options: EditOptions
  onOptions: (options: EditOptions) => void
  panTool: boolean
  onPanTool: (value: boolean) => void
  shared: ConnectionState | null
  // Monotonic milliseconds, the clock the connection uses.
  now: () => number
}) {
  const { grounds: swatches, decor: thumbnails } = useThumbnails(open, options.decor)
  const [, tick] = useState(0)
  // Countdowns and refills repaint once a second; nothing is sent for them.
  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => tick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [open])
  const block: EditBlock = shared ? editBlock(shared, now()) : 'connecting'
  const showGround = options.tool === 'land'
  const groundGroup =
    groundGroups.find((group) => group.grounds.includes(options.ground)) ?? groundGroups[0]
  const heightTool = options.tool === 'raise' || options.tool === 'lower'
  const showHeight = heightTool && !panTool
  const heightId = useId()
  // While waiting for an answer the tools stay usable to pick, but not to edit.
  const disabled = block !== null && block !== 'pending'

  return (
    <section
      id="island-toolbar"
      className="island-toolbar"
      aria-label="島の編集ツール"
      inert={!open}
      data-island-ui
    >
      {(showGround || showHeight || options.tool === 'decor') && (
        <div className="island-toolbar__options">
          {showHeight && (
            <fieldset className="island-chips" id={heightId}>
              <legend className="sr-only">高さ</legend>
              {heightTools.map(({ tool, icon, short, key }) => (
                <button
                  key={tool}
                  type="button"
                  disabled={disabled}
                  aria-pressed={options.tool === tool}
                  aria-keyshortcuts={key}
                  title={`${toolNames[tool]}（${key}）`}
                  onClick={() => onOptions({ ...options, tool })}
                >
                  <PixelIcon name={icon} size={14} />
                  {short}
                </button>
              ))}
            </fieldset>
          )}
          {showGround && (
            <div className="island-ground-picker">
              <fieldset className="island-chips island-ground-categories">
                <legend className="sr-only">土地のカテゴリ</legend>
                {groundGroups.map((group) => (
                  <button
                    key={group.name}
                    type="button"
                    disabled={disabled}
                    aria-pressed={group === groundGroup}
                    onClick={() => {
                      if (group !== groundGroup) onOptions({ ...options, ground: group.grounds[0] })
                    }}
                  >
                    <GroundSwatch src={swatches[group.grounds[0]]} />
                    {group.name}
                  </button>
                ))}
              </fieldset>
              <fieldset className="island-chips">
                <legend className="sr-only">{groundGroup.name}の種類</legend>
                {groundGroup.grounds.map((ground) => (
                  <button
                    key={ground}
                    type="button"
                    disabled={disabled}
                    aria-pressed={options.ground === ground}
                    onClick={() => onOptions({ ...options, ground })}
                  >
                    <GroundSwatch src={swatches[ground]} />
                    {groundNames[ground]}
                  </button>
                ))}
              </fieldset>
            </div>
          )}
          {options.tool === 'decor' && (
            <DecorLooks
              kind={options.decor}
              thumbnails={thumbnails[options.decor]}
              selected={options.looks?.[options.decor] ?? 0}
              disabled={disabled}
              onSelect={(look) =>
                onOptions({ ...options, looks: { ...options.looks, [options.decor]: look } })
              }
            />
          )}
          {options.tool === 'decor' && (
            <div className="island-palette">
              {decorGroups.map((group) => (
                <fieldset key={group.name} className="island-chips island-chips--decor">
                  <legend className="sr-only">{group.name}</legend>
                  {group.kinds.map((decor) => (
                    <button
                      key={decor}
                      type="button"
                      disabled={disabled}
                      aria-pressed={options.decor === decor}
                      aria-label={decorInfo[decor].name}
                      title={decorInfo[decor].name}
                      onClick={() => onOptions({ ...options, decor })}
                    >
                      {thumbnails[decor] ? (
                        <img
                          className="island-thumb"
                          src={thumbnails[decor][options.looks?.[decor] ?? 0]}
                          alt=""
                        />
                      ) : (
                        <span className="island-thumb" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </fieldset>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="island-toolbar__main">
        <fieldset className="island-tools">
          <legend className="sr-only">ツール</legend>
          {tools.map(({ tool, icon, short, key }) => (
            <button
              key={tool}
              type="button"
              className={`island-tool${block === 'pending' && !panTool && options.tool === tool ? ' is-pending' : ''}`}
              disabled={disabled}
              aria-busy={block === 'pending' && !panTool && options.tool === tool}
              aria-pressed={!panTool && options.tool === tool}
              aria-label={`${toolNames[tool]}（${key}）`}
              title={`${toolNames[tool]}（${key}）`}
              onClick={() => {
                onPanTool(false)
                onOptions({ ...options, tool })
              }}
            >
              <PixelIcon name={icon} />
              <span>{short}</span>
            </button>
          ))}
          <button
            type="button"
            className={`island-tool${block === 'pending' && showHeight ? ' is-pending' : ''}`}
            disabled={disabled}
            aria-expanded={showHeight}
            aria-pressed={showHeight}
            aria-controls={showHeight ? heightId : undefined}
            aria-busy={block === 'pending' && showHeight}
            onClick={() => {
              onPanTool(false)
              if (!heightTool) onOptions({ ...options, tool: 'raise' })
            }}
          >
            <PixelIcon name="height" />
            <span>高さ</span>
          </button>
          <button
            type="button"
            className="island-tool island-tool--hand"
            aria-pressed={panTool}
            aria-label="手のひら：ドラッグで地図を動かす（Space 長押しでも可）"
            title="手のひら（Space 長押し）"
            onClick={() => onPanTool(!panTool)}
          >
            <PixelIcon name="hand" />
            <span>移動</span>
          </button>
        </fieldset>
        <IslandStatus shared={shared} block={block} now={now} />
      </div>
    </section>
  )
}

// The chosen decoration's name and looks, shown above the palette. The first
// look is picked until the visitor chooses another.
function DecorLooks({
  kind,
  thumbnails,
  selected,
  disabled,
  onSelect
}: {
  kind: DecorKind
  thumbnails: string[] | undefined
  selected: number
  disabled: boolean
  onSelect: (look: number) => void
}) {
  const nameId = useId()
  const name = decorInfo[kind].name
  const lookName = (look: number) =>
    kind === 'resortLight' ? resortLightNames[look] : `${name}（${look + 1}）`
  return (
    <fieldset className="island-looks" aria-labelledby={nameId}>
      <p id={nameId} className="island-looks__name">
        {kind === 'resortLight' ? lookName(selected) : name}
      </p>
      <div className="island-chips island-chips--decor island-looks__list">
        {Array.from({ length: decorInfo[kind].looks }, (_, look) => (
          <button
            key={look}
            type="button"
            disabled={disabled}
            aria-pressed={selected === look}
            aria-label={lookName(look)}
            title={lookName(look)}
            onClick={() => onSelect(look)}
          >
            {thumbnails?.[look] ? (
              <img className="island-thumb" src={thumbnails[look]} alt="" />
            ) : (
              <span className="island-thumb" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const pad = (value: number) => String(value).padStart(2, '0')
// "0:43" for a countdown, from milliseconds.
export function formatCountdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`
}
// Wall-clock time in Japan for a UTC timestamp, e.g. "9:00".
export function formatJst(time: number) {
  const date = new Date(time + 9 * 60 * 60 * 1000)
  return `${date.getUTCHours()}:${pad(date.getUTCMinutes())}`
}
const number = new Intl.NumberFormat('ja-JP')

const connectionLabels: Partial<Record<NonNullable<EditBlock>, string>> = {
  connecting: '接続中',
  syncing: '同期中',
  waiting: '未接続',
  limited: '待機中',
  storage: '同期エラー',
  daily: '本日終了',
  busy: '混雑中'
}

// Quota gauge, refill countdown, connection state and the island-wide count.
function IslandStatus({
  shared,
  block,
  now
}: {
  shared: ConnectionState | null
  block: EditBlock
  now: () => number
}) {
  const [details, setDetails] = useState(false)
  const detailsId = useId()
  const monotonic = now()
  const serverNow = monotonic + (shared?.serverOffset ?? 0)
  const actor = shared?.actor ? estimateActor(shared.actor, serverNow) : null
  const max = 30
  const available = actor?.available ?? 0
  const refillIn = actor?.nextRefillAt ? actor.nextRefillAt - serverNow : null
  const global = shared?.global ?? null
  const online = block === null || block === 'pending' || block === 'empty'
  const label = block ? connectionLabels[block] : undefined
  const retryIn =
    block === 'limited' && shared?.retryAt ? formatCountdown(shared.retryAt - monotonic) : null
  const resumeAt = block === 'daily' && global ? `再開 ${formatJst(global.resetsAt)} JST` : null

  return (
    <div className="island-status" data-state={block ?? 'ready'}>
      <div className={`island-quota${available < 1 ? ' is-empty' : ''}`}>
        <meter
          className="sr-only"
          min={0}
          max={max}
          value={actor ? available : 0}
          aria-label={actor ? `編集残量 ${available} / ${max}マス` : '編集残量 不明'}
        />
        <span className="island-quota__bar" aria-hidden="true">
          <span style={{ width: `${(available / max) * 100}%` }} />
        </span>
        <span className="island-quota__count" aria-hidden="true">
          {actor ? available : '–'} / {max}
        </span>
      </div>
      {refillIn !== null && actor && available < max && (
        <span
          className="island-refill"
          role="img"
          aria-label={`次の回復まで ${formatCountdown(refillIn)}`}
        >
          <PixelIcon name="clock" size={14} />
          <span aria-hidden="true">{formatCountdown(refillIn)}</span>
        </span>
      )}
      <span
        className={`island-connection${online ? ' is-online' : ''}${block === 'connecting' || block === 'syncing' ? ' is-busy' : ''}`}
        role="img"
        aria-label={label ? [label, retryIn, resumeAt].filter(Boolean).join(' ') : '接続済み'}
      >
        <PixelIcon name={online ? 'signal' : 'offline'} size={14} />
        {label && (
          <span aria-hidden="true">
            {label}
            {retryIn && ` ${retryIn}`}
            {resumeAt && <small>{resumeAt}</small>}
          </span>
        )}
      </span>
      <button
        type="button"
        className="island-global-toggle"
        aria-expanded={details}
        aria-controls={detailsId}
        aria-label="島全体の残り"
        title="島全体の残り"
        onClick={() => setDetails((open) => !open)}
      >
        <PixelIcon name="island" size={14} />
      </button>
      <span className="sr-only" role="status">
        {label ?? ''}
      </span>
      <span id={detailsId} className="island-global" hidden={!details}>
        島全体{' '}
        {global
          ? `${number.format(Math.max(0, global.limit - global.used))} / ${number.format(global.limit)}`
          : '–'}
      </span>
    </div>
  )
}
