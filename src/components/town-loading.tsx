import { type CSSProperties, useEffect, useLayoutEffect, useState } from 'react'
import type { PixelBuffer } from '../lib/island-art'
import { BOAT_FRAME, BOAT_FRAMES, paintLoadingArt, SEA_TILE } from '../lib/island-loading'
import { designResidents, type ResidentDesign } from '../lib/island-residents'

type Status = 'loading' | 'ready' | 'failed'

const fallbackRower: ResidentDesign = {
  hair: 'short',
  accessory: 'strawHat',
  outfit: 'pants',
  hairColor: '#6a4535',
  top: '#e0574f',
  bottom: '#f4f0e6',
  accent: '#f2c84b',
  skin: '#fbd7bd'
}

function toDataUrl(buffer: PixelBuffer) {
  const canvas = document.createElement('canvas')
  canvas.width = buffer.width
  canvas.height = buffer.height
  const context = canvas.getContext('2d')
  if (!context) return null
  const image = context.createImageData(buffer.width, buffer.height)
  image.data.set(buffer.data)
  context.putImageData(image, 0, 0)
  return `url(${canvas.toDataURL()})`
}

// The newest resident rows across the island's own sea while the renderer starts.
export function TownLoading({
  status,
  posts,
  newestSlug
}: {
  status: Status
  posts: Array<{ slug: string; date: string }>
  newestSlug?: string
}) {
  const [leaving, setLeaving] = useState(false)
  const [done, setDone] = useState(false)
  const [art, setArt] = useState<CSSProperties | null>(null)
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
  // Painted before the first paint after hydration; until then the plain sea shows.
  useLayoutEffect(() => {
    const rower = (newestSlug && designResidents(posts).get(newestSlug)) || fallbackRower
    const painted = paintLoadingArt(rower)
    const [sea, shimmer, boat] = [painted.sea, painted.shimmer, painted.boat].map(toDataUrl)
    if (!sea || !shimmer || !boat) return
    setArt({
      '--loading-sea': sea,
      '--loading-shimmer': shimmer,
      '--loading-boat': boat,
      '--loading-tile': SEA_TILE,
      '--loading-boat-w': BOAT_FRAME.width,
      '--loading-boat-h': BOAT_FRAME.height,
      '--loading-boat-frames': BOAT_FRAMES
    } as CSSProperties)
    // The rower is chosen once: the art must not repaint under a running animation.
  }, [])
  if (done) return null
  return (
    <div
      className={`island-loading${leaving ? ' is-leaving' : ''}${art ? ' is-painted' : ''}`}
      style={art ?? undefined}
      role="status"
    >
      <div className="island-loading__sea" aria-hidden="true" />
      <div className="island-loading__shimmer" aria-hidden="true" />
      <div className="island-loading__stage">
        <div className="island-loading__boat" aria-hidden="true">
          <div className="island-loading__boat-frames" />
        </div>
        <p className="island-loading__label">
          島へ向かっています
          <span className="island-loading__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
      </div>
    </div>
  )
}
