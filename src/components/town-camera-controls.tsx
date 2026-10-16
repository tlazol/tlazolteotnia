export function TownCameraControls({
  rotateMode,
  zoom,
  onToggleRotate,
  onZoom,
  onFit,
  onReset
}: {
  rotateMode: boolean
  zoom: number
  onToggleRotate: () => void
  onZoom: (factor: number) => void
  onFit: () => void
  onReset: () => void
}) {
  return (
    <fieldset className="board-controls" aria-label="街の表示操作">
      <button
        className="town-camera-mode"
        type="button"
        aria-label="回転モード"
        aria-pressed={rotateMode}
        title="移動／回転を切り替え（タッチでは常に2本指で回転）"
        onClick={onToggleRotate}
      >
        {rotateMode ? '回転' : '移動'}
      </button>
      <button type="button" aria-label="縮小" onClick={() => onZoom(1 / 1.25)}>
        −
      </button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="拡大" onClick={() => onZoom(1.25)}>
        +
      </button>
      <button type="button" aria-label="全体表示" onClick={onFit}>
        ⛶
      </button>
      <button type="button" aria-label="初期位置に戻る" onClick={onReset}>
        ↺
      </button>
    </fieldset>
  )
}
