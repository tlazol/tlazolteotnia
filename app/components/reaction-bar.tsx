import { useEffect, useRef, useState } from 'react'
import { MdAddReaction } from 'react-icons/md'
import { useFetcher } from 'react-router'
import { mergeReaction, REACTION_EMOJIS, type ReactionCount } from '~/lib/reactions'

type ReactionResponse = {
  reaction?: ReactionCount
  created?: boolean
  error?: string
}

export function ReactionBar({
  reactions,
  slug,
  onReaction
}: {
  reactions: ReactionCount[]
  slug: string
  onReaction?: (reaction: ReactionCount) => void
}) {
  const fetcher = useFetcher<ReactionResponse>()
  const [current, setCurrent] = useState(reactions)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null)
  const previousRef = useRef<ReactionCount[]>(reactions)
  const submissionStartedRef = useRef(false)

  useEffect(() => setCurrent(reactions), [reactions])

  useEffect(() => {
    if (!pendingEmoji) return
    if (fetcher.state !== 'idle') {
      submissionStartedRef.current = true
      return
    }
    if (!submissionStartedRef.current) return
    if (fetcher.data?.reaction) {
      setCurrent((value) => mergeReaction(value, fetcher.data?.reaction as ReactionCount))
      onReaction?.(fetcher.data.reaction)
    } else if (fetcher.data?.error) {
      setCurrent(previousRef.current)
    }
    submissionStartedRef.current = false
    setPendingEmoji(null)
  }, [fetcher.data, fetcher.state, onReaction, pendingEmoji])

  function react(emoji: string) {
    const existing = current.find((reaction) => reaction.emoji === emoji)
    if (pendingEmoji || existing?.reacted) return
    previousRef.current = current
    setCurrent((value) =>
      mergeReaction(value, {
        emoji: emoji as ReactionCount['emoji'],
        count: (existing?.count ?? 0) + 1,
        reacted: true
      })
    )
    setPendingEmoji(emoji)
    setPickerOpen(false)
    fetcher.submit({ emoji }, { action: `/api/reactions/${slug}`, method: 'post' })
  }

  return (
    <div className="mt-5 [font-family:var(--font-ui)]">
      <fieldset className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0">
        <legend className="sr-only">Reactions</legend>
        {current.map((reaction) => (
          <ReactionButton
            key={reaction.emoji}
            onClick={() => react(reaction.emoji)}
            pending={pendingEmoji === reaction.emoji}
            reaction={reaction}
          />
        ))}
        <ReactionPicker
          current={current}
          onClose={() => setPickerOpen(false)}
          onOpen={() => setPickerOpen(true)}
          onReact={react}
          open={pickerOpen}
          pendingEmoji={pendingEmoji}
        />
      </fieldset>
      {fetcher.data?.error && !pendingEmoji && (
        <p className="mt-2 mb-0 text-[0.72rem] text-red-300" role="alert">
          {fetcher.data.error}
        </p>
      )}
    </div>
  )
}

function ReactionButton({
  reaction,
  pending,
  onClick
}: {
  reaction: ReactionCount
  pending: boolean
  onClick: () => void
}) {
  const label = pending
    ? `${reaction.emoji}でリアクションを送信中`
    : reaction.reacted
      ? `${reaction.emoji}にリアクション済み`
      : `${reaction.emoji}でリアクションする`
  return (
    <button
      aria-label={label}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.78rem] font-semibold transition-colors ${
        reaction.reacted
          ? 'border-[var(--post-accent)] bg-[var(--post-accent-wash)] text-[var(--post-accent-soft)]'
          : 'cursor-pointer border-[var(--line)] bg-[rgba(7,16,11,0.72)] text-[var(--text)] hover:border-[var(--post-accent)]'
      } disabled:cursor-not-allowed disabled:opacity-70`}
      disabled={pending || reaction.reacted}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true">{reaction.emoji}</span>
      <span>{reaction.count}</span>
      <span
        aria-hidden="true"
        className={`inline-block w-[0.7em] ${reaction.reacted ? '' : 'invisible'}`}
      >
        ✓
      </span>
    </button>
  )
}

function ReactionPicker({
  current,
  onClose,
  onOpen,
  onReact,
  open,
  pendingEmoji
}: {
  current: ReactionCount[]
  onClose: () => void
  onOpen: () => void
  onReact: (emoji: string) => void
  open: boolean
  pendingEmoji: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
      requestAnimationFrame(() => toggleRef.current?.focus())
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeWithEscape, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeWithEscape, true)
    }
  }, [onClose, open])

  return (
    <div className="reaction-picker relative" ref={ref}>
      <span aria-hidden="true" className="reaction-picker__spark reaction-picker__spark--one">
        ✦
      </span>
      <span aria-hidden="true" className="reaction-picker__spark reaction-picker__spark--two">
        ·
      </span>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="リアクションを追加"
        className="reaction-picker__toggle"
        onClick={open ? onClose : onOpen}
        ref={toggleRef}
        type="button"
      >
        <span className="reaction-picker__icon" aria-hidden="true">
          <MdAddReaction />
        </span>
      </button>
      {open && (
        <div
          className="absolute bottom-10 left-0 z-30 grid w-48 grid-cols-4 gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-2 shadow-2xl"
          onKeyDown={(event) => {
            const buttons = [
              ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ??
                [])
            ]
            const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
            let nextIndex: number | null = null
            if (event.key === 'ArrowRight') {
              nextIndex = (currentIndex + 1) % buttons.length
            } else if (event.key === 'ArrowLeft') {
              nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
            } else if (event.key === 'ArrowDown') {
              nextIndex = (currentIndex + 4) % buttons.length
            } else if (event.key === 'ArrowUp') {
              nextIndex = (currentIndex - 4 + buttons.length) % buttons.length
            } else if (event.key === 'Home') {
              nextIndex = 0
            } else if (event.key === 'End') {
              nextIndex = buttons.length - 1
            }
            if (nextIndex !== null && buttons[nextIndex]) {
              event.preventDefault()
              buttons[nextIndex].focus()
            }
          }}
          ref={menuRef}
          role="menu"
        >
          {REACTION_EMOJIS.map((emoji) => {
            const reacted = current.some((reaction) => reaction.emoji === emoji && reaction.reacted)
            return (
              <button
                aria-label={
                  pendingEmoji === emoji
                    ? `${emoji}でリアクションを送信中`
                    : reacted
                      ? `${emoji}にリアクション済み`
                      : `${emoji}でリアクションする`
                }
                className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-xl hover:bg-[var(--hover)] focus-visible:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={reacted || pendingEmoji === emoji}
                key={emoji}
                onClick={() => onReact(emoji)}
                role="menuitem"
                type="button"
              >
                {emoji}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ReactionSummary({ reactions }: { reactions: ReactionCount[] }) {
  if (reactions.length === 0) return null
  const shown = reactions.slice(0, 4)
  return (
    <ul className="mt-3 flex list-none flex-wrap gap-1.5 p-0" aria-label="Reactions">
      {shown.map((reaction) => (
        <li
          className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[rgba(7,16,11,0.72)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--muted)]"
          key={reaction.emoji}
        >
          <span aria-hidden="true">{reaction.emoji}</span> {reaction.count}
        </li>
      ))}
      {reactions.length > 4 && (
        <li className="px-1 py-1 text-[0.68rem] text-[var(--dim)]">+{reactions.length - 4} more</li>
      )}
    </ul>
  )
}
