import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { boardSession } from '#/lib/sticker-board'

export function BackToBoard() {
  const [search, setSearch] = useState<{ topic?: string; q?: string }>({})
  useEffect(() => {
    setSearch(boardSession.search ?? {})
  }, [])
  return (
    <Link className="back-to-board" to="/" search={search}>
      ← ステッカーボードに戻る
    </Link>
  )
}
