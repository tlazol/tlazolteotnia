import { useEffect, useState } from 'react'

type Status = 'loading' | 'ready' | 'failed'

// A small pixel island bobbing on the waves while the renderer starts.
export function TownLoading({ status }: { status: Status }) {
  const [leaving, setLeaving] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (status === 'loading') {
      setLeaving(false)
      setDone(false)
      return
    }
    if (status === 'failed') {
      setDone(true)
      return
    }
    setLeaving(true)
    const timer = setTimeout(() => setDone(true), 450)
    return () => clearTimeout(timer)
  }, [status])
  if (done) return null
  return (
    <div className={`island-loading${leaving ? ' is-leaving' : ''}`} role="status">
      <svg
        className="island-loading__art"
        viewBox="0 0 32 20"
        width="160"
        height="100"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <path className="island-loading__sand" d="M7 12h18v1h2v2h-2v1H7v-1H5v-2h2z" />
        <path className="island-loading__grass" d="M10 10h12v1h2v2H8v-2h2z" />
        <path className="island-loading__trunk" d="M15 5h2v6h-2z" />
        <path
          className="island-loading__leaf"
          d="M11 3h4v1h2V3h4v1h1v1h-4v1h-2V5h-1v1h-4V5h-1V4h1z"
        />
        <path
          className="island-loading__wave"
          d="M2 17h3v1H2zM9 18h4v1H9zM20 18h3v1h-3zM27 17h3v1h-3z"
        />
      </svg>
      <p>島へ向かっています…</p>
    </div>
  )
}
