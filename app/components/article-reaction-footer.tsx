import { ReactionBar } from '~/components/reaction-bar'
import type { ReactionCount } from '~/lib/reactions'

export function ArticleReactionFooter({
  onReaction,
  reactions,
  slug
}: {
  onReaction: (reaction: ReactionCount) => void
  reactions: ReactionCount[]
  slug: string
}) {
  const headingId = `article-reactions-heading-${slug}`

  return (
    <section
      aria-labelledby={headingId}
      className="mt-14 mb-4 border-t border-[color-mix(in_srgb,var(--post-accent)_28%,var(--line))] pt-7 pb-2 [font-family:var(--font-ui)]"
    >
      <p className="m-0 text-[0.62rem] font-bold tracking-[0.14em] text-[var(--post-accent)] uppercase [font-family:var(--font-mono)]">
        End of transmission
      </p>
      <h2
        className="mt-2 mb-0 text-[1.25rem] font-bold tracking-[-0.025em] text-[var(--text-strong)] [font-family:var(--font-display)]"
        id={headingId}
      >
        読んだ気分を、絵文字でぽちっと。
      </h2>
      <p className="mt-2 mb-0 text-[0.82rem] leading-[1.7] text-[var(--muted)]">
        好きな絵文字をいくつでもどうぞ。
      </p>
      <ReactionBar onReaction={onReaction} reactions={reactions} slug={slug} />
    </section>
  )
}
