import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { getPostAccent } from '#/lib/post-accent'

export function PostModal({
  slug,
  title,
  onClose,
  fallbackFocus,
  children
}: {
  slug: string
  title: string
  onClose: () => void
  // Used when nothing had focus before opening, e.g. a post opened by URL.
  fallbackFocus?: () => HTMLElement | null | undefined
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const fallback = useRef(fallbackFocus)
  fallback.current = fallbackFocus

  // Before paint, so the dialog never shows a frame as a non-modal (open attribute) dialog.
  useLayoutEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    // SSR renders the dialog open so the article is readable before hydration;
    // reopen it as a modal. The resulting close event is ignored below.
    if (element?.open) element.close()
    element?.showModal()
    closeButton.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      const target =
        // Strict Mode remounts can record the modal's own close button.
        previousFocus instanceof HTMLElement &&
        previousFocus !== document.body &&
        !element?.contains(previousFocus)
          ? previousFocus
          : fallback.current?.()
      target?.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className="post-modal"
      aria-label={title}
      open
      onClose={(event) => {
        if (!event.currentTarget.open) onClose()
      }}
    >
      <button
        className="post-modal__backdrop"
        type="button"
        aria-label="記事を閉じて街に戻る"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="post-modal__panel" data-post-accent={getPostAccent(slug)}>
        <div className="post-modal__toolbar">
          <button
            ref={closeButton}
            className="post-modal__close"
            type="button"
            aria-label="記事を閉じる"
            onClick={onClose}
          />
        </div>
        <div className="article-page post-modal__article">{children}</div>
      </div>
    </dialog>
  )
}
