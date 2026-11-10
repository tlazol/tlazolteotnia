import { useEffect, useState } from 'react'
import { type EditOptions, type IslandTool, toolNames } from '#/lib/island-edit'
import { decorVariants } from '#/lib/island-sprites'
import {
  DECK,
  type DecorKind,
  decorGroups,
  decorKinds,
  decorNames,
  GRASS,
  groundNames,
  type LandGround,
  landGrounds,
  PATH
} from '#/lib/island-world'
import { type IconName, PixelIcon } from './island-icons'

const tools: Array<{ tool: IslandTool; icon: IconName; short: string; key: string }> = [
  { tool: 'land', icon: 'land', short: '土地', key: '1' },
  { tool: 'erase', icon: 'erase', short: '削る', key: '2' },
  { tool: 'ground', icon: 'ground', short: '地面', key: '3' },
  { tool: 'decor', icon: 'decor', short: '装飾', key: '4' },
  { tool: 'remove', icon: 'remove', short: '撤去', key: '5' }
]
export const toolShortcuts = Object.fromEntries(tools.map(({ key, tool }) => [key, tool]))

const groundSwatch: Record<LandGround, string> = {
  [GRASS]: 'is-grass',
  1: 'is-sand',
  [PATH]: 'is-path',
  [DECK]: 'is-deck'
}

// Decoration thumbnails drawn from the same sprites as the island.
function useDecorThumbnails() {
  const [thumbnails, setThumbnails] = useState<Partial<Record<DecorKind, string>>>({})
  useEffect(() => {
    const next: Partial<Record<DecorKind, string>> = {}
    for (const kind of decorKinds) {
      const { buffer } = decorVariants[kind][0]
      const canvas = document.createElement('canvas')
      canvas.width = buffer.width
      canvas.height = buffer.height
      const context = canvas.getContext('2d')
      if (!context) continue
      context.putImageData(
        new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height),
        0,
        0
      )
      next[kind] = canvas.toDataURL()
    }
    setThumbnails(next)
  }, [])
  return thumbnails
}

export function IslandToolbar({
  options,
  onOptions,
  panTool,
  onPanTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  status,
  statusTone
}: {
  options: EditOptions
  onOptions: (options: EditOptions) => void
  panTool: boolean
  onPanTool: (value: boolean) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
  status: string
  statusTone: 'hint' | 'blocked' | 'saved'
}) {
  const thumbnails = useDecorThumbnails()
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => {
    if (!confirmReset) return
    const timer = setTimeout(() => setConfirmReset(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmReset])
  const showGround = options.tool === 'land' || options.tool === 'ground'
  const showBrush = options.tool !== 'decor' && options.tool !== 'remove'

  return (
    <section className="island-toolbar" aria-label="島の編集ツール" data-island-ui>
      <div className="island-toolbar__options">
        {showGround && (
          <fieldset className="island-chips">
            <legend className="sr-only">
              {options.tool === 'land' ? '足す土地の種類' : '塗る地面の種類'}
            </legend>
            {landGrounds.map((ground) => (
              <button
                key={ground}
                type="button"
                aria-pressed={options.ground === ground}
                onClick={() => onOptions({ ...options, ground })}
              >
                <span className={`island-swatch ${groundSwatch[ground]}`} aria-hidden="true" />
                {groundNames[ground]}
              </button>
            ))}
          </fieldset>
        )}
        {options.tool === 'decor' && (
          <div className="island-palette">
            {decorGroups.map((group) => (
              <fieldset key={group.name} className="island-chips island-chips--decor">
                <legend>{group.name}</legend>
                {group.kinds.map((decor) => (
                  <button
                    key={decor}
                    type="button"
                    aria-pressed={options.decor === decor}
                    aria-label={decorNames[decor]}
                    title={decorNames[decor]}
                    onClick={() => onOptions({ ...options, decor })}
                  >
                    {thumbnails[decor] ? (
                      <img className="island-thumb" src={thumbnails[decor]} alt="" />
                    ) : (
                      <span className="island-thumb" aria-hidden="true" />
                    )}
                    <span>{decorNames[decor]}</span>
                  </button>
                ))}
              </fieldset>
            ))}
          </div>
        )}
        {options.tool === 'remove' && (
          <p className="island-toolbar__note">木や岩、コテージや船などに触れると片付けます</p>
        )}
        {showBrush && (
          <fieldset className="island-chips island-chips--brush">
            <legend className="sr-only">ブラシの大きさ</legend>
            {([1, 3] as const).map((brush) => (
              <button
                key={brush}
                type="button"
                aria-pressed={options.brush === brush}
                aria-label={brush === 1 ? 'ブラシ 小（1マス）' : 'ブラシ 大（3×3マス）'}
                title="ブラシの大きさ（B）"
                onClick={() => onOptions({ ...options, brush })}
              >
                <span className={`island-brush is-${brush}`} aria-hidden="true" />
                {brush === 1 ? '小' : '大'}
              </button>
            ))}
          </fieldset>
        )}
      </div>
      <div className="island-toolbar__main">
        <fieldset className="island-tools">
          <legend className="sr-only">ツール</legend>
          {tools.map(({ tool, icon, short, key }) => (
            <button
              key={tool}
              type="button"
              className="island-tool"
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
        <fieldset className="island-history">
          <legend className="sr-only">履歴</legend>
          <button
            type="button"
            className="island-tool"
            disabled={!canUndo}
            aria-label="元に戻す（Ctrl+Z）"
            title="元に戻す（Ctrl+Z）"
            onClick={onUndo}
          >
            <PixelIcon name="undo" />
            <span>戻す</span>
          </button>
          <button
            type="button"
            className="island-tool"
            disabled={!canRedo}
            aria-label="やり直す（Ctrl+Shift+Z）"
            title="やり直す（Ctrl+Shift+Z）"
            onClick={onRedo}
          >
            <PixelIcon name="redo" />
            <span>進む</span>
          </button>
          <button
            type="button"
            className={`island-tool island-tool--reset${confirmReset ? ' is-confirming' : ''}`}
            aria-label={confirmReset ? '本当に最初の島に戻す（もう一度押す）' : '最初の島に戻す'}
            title="最初の島に戻す（戻すで取り消せます）"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true)
                return
              }
              setConfirmReset(false)
              onReset()
            }}
          >
            <PixelIcon name="reset" />
            <span>{confirmReset ? '本当に？' : '初期化'}</span>
          </button>
        </fieldset>
      </div>
      <p className={`island-toolbar__status is-${statusTone}`} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  )
}
