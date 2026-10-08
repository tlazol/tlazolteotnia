import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { artStationUrl, authorAccount, authorName, siteName, xUrl } from '#/lib/site'

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const header = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <header className="site-header" ref={header}>
      <div className="site-header__bar">
        <Link className="site-wordmark" to="/" aria-label={`${siteName} — ホーム`}>
          {siteName}
          <span aria-hidden="true">✳</span>
        </Link>
        <button
          ref={toggle}
          type="button"
          className="site-menu-toggle"
          aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? '−' : '+'}
        </button>
      </div>
      {open && (
        <div className="site-menu" id="site-menu">
          <div className="site-menu__profile">
            <strong>{authorName}</strong>
            <span>@{authorAccount} · Art, code & little experiments.</span>
          </div>
          <nav
            aria-label="サイトメニュー"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest('a')) setOpen(false)
            }}
          >
            <Link to="/">Town</Link>
            <Link to="/app/lights-out">Lights Out ↗</Link>
            <a href={artStationUrl}>ArtStation ↗</a>
            <a href={xUrl}>X / Twitter ↗</a>
            <a href="/rss.xml">RSS</a>
            <a href="/atom.xml">Atom</a>
          </nav>
        </div>
      )}
    </header>
  )
}
