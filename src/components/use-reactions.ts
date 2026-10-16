import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createReactionState } from '#/lib/reaction-state'
import type { ReactionCount } from '#/lib/reactions'

export function useReactions(slug: string, reactions: ReactionCount[]) {
  // A new slug or new server data replaces the entire optimistic state.
  const owner = useMemo(() => createReactionState(slug, reactions), [slug, reactions])
  useEffect(() => () => owner.cancel(), [owner])
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot)
  return { ...state, react: owner.react }
}
