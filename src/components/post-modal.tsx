import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getModalPostData } from '#/lib/blog.functions'
import type { BlogPostSummary } from '#/lib/blog-post'
import { getPostAccent } from '#/lib/post-accent'
import { ArticleContent } from './article-content'

export function PostModal({ post, onClose }: { post: BlogPostSummary; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [data, setData] = useState<Awaited<ReturnType<typeof getModalPostData>>>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    closeButton.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getModalPostData({ data: { slug: post.slug } })
      .then((result) => {
        if (cancelled) return
        setData(result)
        setFailed(!result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [post.slug])

  return (
    <dialog
      ref={dialog}
      className="post-modal"
      aria-label={post.title}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose()
      }}
    >
      <button
        className="post-modal__backdrop"
        type="button"
        aria-label="記事を閉じてボードに戻る"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="post-modal__panel" data-post-accent={getPostAccent(post.slug)}>
        <div className="post-modal__toolbar">
          <Link to="/blog/$slug" params={{ slug: post.slug }}>
            記事ページを開く ↗
          </Link>
          <button
            ref={closeButton}
            className="post-modal__close"
            type="button"
            aria-label="記事を閉じる"
            onClick={onClose}
          />
        </div>
        <div className="article-page post-modal__article">
          {data ? (
            <ArticleContent post={data.post} reactions={data.reactions} onTagNavigate={onClose} />
          ) : failed ? (
            <p className="post-modal__status" role="alert">
              記事を読み込めませんでした。上のリンクから記事ページを開いてください。
            </p>
          ) : (
            <p className="post-modal__status" role="status">
              記事を読み込んでいます…
            </p>
          )}
        </div>
      </div>
    </dialog>
  )
}
