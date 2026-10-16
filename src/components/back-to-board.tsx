import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { townSession } from '#/lib/town-view'

export function BackToBoard() {
  const [search, setSearch] = useState<{ topic?: string; q?: string }>({})
  useEffect(() => {
    setSearch(townSession.search ?? {})
  }, [])
  return (
    <Link className="back-to-board" to="/" search={search}>
      ← 街に戻る
    </Link>
  )
}
