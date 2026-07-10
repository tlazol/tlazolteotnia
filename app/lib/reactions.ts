export const REACTION_EMOJIS = [
  '👍',
  '❤️',
  '😂',
  '🎉',
  '🤔',
  '👀',
  '🔥',
  '🚀',
  '✨',
  '⚡',
  '🌈',
  '🛰️',
  '📡',
  '🐾',
  '💡',
  '🌙'
] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export type ReactionCount = {
  emoji: ReactionEmoji
  count: number
  reacted?: boolean
}

const emojiOrder = new Map<string, number>(REACTION_EMOJIS.map((emoji, index) => [emoji, index]))

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === 'string' && emojiOrder.has(value)
}

export function sortReactionCounts<T extends Pick<ReactionCount, 'emoji' | 'count'>>(
  reactions: T[]
): T[] {
  return [...reactions].sort(
    (left, right) =>
      right.count - left.count ||
      (emojiOrder.get(left.emoji) ?? Number.MAX_SAFE_INTEGER) -
        (emojiOrder.get(right.emoji) ?? Number.MAX_SAFE_INTEGER)
  )
}

export function mergeReaction(
  reactions: ReactionCount[],
  nextReaction: ReactionCount
): ReactionCount[] {
  const existingIndex = reactions.findIndex((reaction) => reaction.emoji === nextReaction.emoji)
  if (existingIndex === -1) return [...reactions, nextReaction]

  return reactions.map((reaction, index) => (index === existingIndex ? nextReaction : reaction))
}

export function getReactionTotal(reactions: ReactionCount[]): number {
  return reactions.reduce((total, reaction) => total + reaction.count, 0)
}
