import { createClientOnlyFn } from '@tanstack/react-start'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BlogPostSummary } from '#/lib/blog-post'
import { layoutStickers } from '#/lib/sticker-board'
import type { createStickerScene } from '#/lib/sticker-three.client'

const loadRenderer = createClientOnlyFn(() => import('#/lib/sticker-three.client'))

export function ArticleSticker({ post }: { post: BlogPostSummary }) {
  const sticker = useMemo(() => layoutStickers([post]).stickers[0], [post])
  const canvas = useRef<HTMLCanvasElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [ready, setReady] = useState(false)
  const width = sticker.width + 48
  const height = sticker.height + 48

  useEffect(() => {
    const element = heading.current
    const target = canvas.current
    if (!element || !target) return
    let cancelled = false
    let hovered = -1
    let renderer: ReturnType<typeof createStickerScene> | undefined
    setReady(false)

    function update() {
      if (!element) return
      const size = { width: element.clientWidth, height: element.clientHeight }
      renderer?.update(
        { x: size.width / 2, y: size.height / 2, zoom: size.width / width },
        size,
        hovered
      )
    }
    function enter() {
      hovered = 0
      update()
    }
    function leave() {
      hovered = -1
      update()
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    element.addEventListener('pointerenter', enter)
    element.addEventListener('pointerleave', leave)

    async function initialize() {
      try {
        const module = await loadRenderer()
        await document.fonts.load('400 31px "WDXL Lubrifont JP N"', post.title)
        await document.fonts.load('700 12px "IBM Plex Mono"', '0123456789.')
        if (cancelled || !target) return
        renderer = module.createStickerScene(
          target,
          [{ ...sticker, x: 0, y: 0 }],
          () => {
            setReady(false)
          },
          { eyes: true }
        )
        update()
        setReady(true)
      } catch {
        // Keep the real heading visible when fonts or WebGL are unavailable.
        if (!cancelled) setReady(false)
      }
    }
    void initialize()
    return () => {
      cancelled = true
      observer.disconnect()
      element.removeEventListener('pointerenter', enter)
      element.removeEventListener('pointerleave', leave)
      renderer?.dispose()
    }
  }, [post.title, sticker, width])

  return (
    <h1
      ref={heading}
      className={`article-sticker${ready ? ' is-ready' : ''}`}
      style={{ aspectRatio: `${width} / ${height}`, width: Math.min(460, (width / height) * 420) }}
    >
      <span className={ready ? 'sr-only' : 'article-sticker__fallback'}>{post.title}</span>
      <canvas ref={canvas} aria-hidden="true" tabIndex={-1} />
    </h1>
  )
}
