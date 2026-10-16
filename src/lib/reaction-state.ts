import { mergeReaction, type ReactionCount } from './reactions'

type ReactionState = {
  reactions: ReactionCount[]
  pendingEmoji: string | null
  errorMessage: string | null
}

// Each article/data snapshot gets its own owner. Replaced owners abort their request.
export function createReactionState(slug: string, reactions: ReactionCount[]) {
  let state: ReactionState = { reactions, pendingEmoji: null, errorMessage: null }
  const initialState = state
  const listeners = new Set<() => void>()
  let request: AbortController | null = null

  function publish(next: ReactionState) {
    state = next
    for (const listener of listeners) listener()
  }

  async function send(emoji: ReactionCount['emoji'], controller: AbortController) {
    const previous = state.reactions
    const existing = previous.find((reaction) => reaction.emoji === emoji)
    publish({
      reactions: mergeReaction(previous, {
        emoji,
        count: (existing?.count ?? 0) + 1,
        reacted: true
      }),
      pendingEmoji: emoji,
      errorMessage: null
    })
    const formData = new FormData()
    formData.set('emoji', emoji)
    try {
      const response = await fetch(`/api/reactions/${encodeURIComponent(slug)}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })
      const result = (await response.json()) as { reaction?: ReactionCount; error?: string }
      if (controller.signal.aborted) return
      if (!response.ok || !result.reaction)
        throw new Error(result.error ?? 'リアクションを送信できませんでした。')
      publish({
        reactions: mergeReaction(state.reactions, result.reaction),
        pendingEmoji: null,
        errorMessage: null
      })
    } catch (error) {
      if (controller.signal.aborted) return
      publish({
        reactions: previous,
        pendingEmoji: null,
        errorMessage:
          error instanceof Error ? error.message : 'リアクションを送信できませんでした。'
      })
    } finally {
      if (request === controller) request = null
    }
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initialState,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    react(emoji: ReactionCount['emoji']) {
      if (
        request ||
        state.reactions.some((reaction) => reaction.emoji === emoji && reaction.reacted)
      )
        return false
      request = new AbortController()
      void send(emoji, request)
      return true
    },
    cancel() {
      request?.abort()
    }
  }
}
