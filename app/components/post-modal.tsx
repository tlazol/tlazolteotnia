import { lazy, Suspense, useEffect, useRef } from 'react'
import { FaArrowUpRightFromSquare, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router'
import { TagList } from '~/components/tag-list'
import type { BlogPost, BlogPostSummary } from '~/lib/blog.server'

const MarkdownBody = lazy(() =>
  import('~/components/markdown-body').then(({ MarkdownBody }) => ({ default: MarkdownBody }))
)

type PostModalProps = {
  post: BlogPost | null
  summary: BlogPostSummary
  onClose: () => void
}

export function PostModal({ post, summary, onClose }: PostModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const descriptionId = `post-modal-description-${summary.slug}`
  const titleId = `post-modal-title-${summary.slug}`

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow

    if (!dialog) {
      return
    }

    document.body.style.overflow = 'hidden'
    dialog.showModal()
    closeButtonRef.current?.focus({ preventScroll: true })

    return () => {
      document.body.style.overflow = previousOverflow

      if (dialog.open) {
        dialog.close()
      }

      previouslyFocused?.focus()
    }
  }, [])

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="fixed inset-0 m-auto h-[calc(100svh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[900px] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--green)_32%,var(--line))] bg-[rgba(3,10,6,0.46)] p-0 text-[var(--text)] shadow-[0_28px_100px_rgba(0,0,0,0.72),0_0_44px_rgba(49,255,128,0.08)] backdrop:bg-[rgba(0,2,1,0.28)] backdrop:backdrop-blur-sm min-[680px]:h-[calc(100svh-3rem)] min-[680px]:w-[calc(100%-3rem)]"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      ref={dialogRef}
    >
      <div className="flex h-full flex-col">
        <div className="h-1 shrink-0 [background:var(--spectrum)]" />
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] bg-[rgba(7,16,11,0.44)] px-4 min-[680px]:px-6">
          <p className="m-0 min-w-0 truncate text-[0.7rem] font-bold text-[var(--muted)] uppercase">
            reader://content/blog/{summary.slug}.md
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              aria-label="Open post page"
              className="inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-[var(--green-soft)] no-underline hover:text-[var(--green)]"
              to={`/blog/${summary.slug}`}
            >
              <span className="hidden min-[520px]:inline">Open post page</span>
              <FaArrowUpRightFromSquare aria-hidden="true" className="size-3.5" />
            </Link>
            <button
              aria-label="Close article"
              className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-transparent text-[var(--muted)] transition-colors hover:border-[var(--green)] hover:bg-[rgba(49,255,128,0.08)] hover:text-[var(--green-soft)]"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              <FaXmark aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-10 min-[680px]:px-10 min-[680px]:pb-14">
          <article className="mx-auto w-full max-w-[720px]">
            <header className="relative border-b border-[var(--line)] pt-9 pb-7 after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-px after:opacity-50 after:content-[''] after:[background:var(--spectrum)] min-[680px]:pt-12">
              <time
                className="text-[0.78rem] font-bold text-[var(--yellow)]"
                dateTime={summary.date}
              >
                {summary.date}
              </time>
              <h1
                className="mt-5 mb-5 text-[clamp(1.65rem,6vw,3.2rem)] leading-[1.12] font-bold text-[var(--green-soft)] [overflow-wrap:anywhere] [font-family:var(--font-display)]"
                id={titleId}
              >
                {summary.title}
              </h1>
              <TagList tags={summary.tags} />
              <p
                className="mt-5 mb-0 max-w-[680px] text-[0.92rem] leading-[1.7] text-[var(--muted)] min-[680px]:text-base"
                id={descriptionId}
              >
                {summary.description}
              </p>
            </header>

            {post ? (
              <Suspense fallback={<PostLoadingState />}>
                <MarkdownBody body={post.body} />
              </Suspense>
            ) : (
              <PostLoadingState />
            )}
          </article>
        </div>
      </div>
    </dialog>
  )
}

function PostLoadingState() {
  return (
    <p
      className="my-0 py-16 text-center text-[0.78rem] font-bold tracking-[0.08em] text-[var(--green)] uppercase"
      role="status"
    >
      Loading article…
    </p>
  )
}
