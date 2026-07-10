import { describe, expect, it } from 'vitest'
import {
  isReactionEmoji,
  mergeReaction,
  REACTION_EMOJIS,
  sortReactionCounts
} from '~/lib/reactions'

describe('reactions', () => {
  it('uses the specified 16 emoji as its allowlist', () => {
    expect(REACTION_EMOJIS).toEqual([
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
    ])
    expect(isReactionEmoji('👍')).toBe(true)
    expect(isReactionEmoji('❌')).toBe(false)
    expect(isReactionEmoji('')).toBe(false)
  })

  it('sorts by count then allowlist order', () => {
    expect(
      sortReactionCounts([
        { emoji: '🎉', count: 2 },
        { emoji: '❤️', count: 2 },
        { emoji: '👍', count: 1 }
      ]).map(({ emoji }) => emoji)
    ).toEqual(['❤️', '🎉', '👍'])
  })

  it('merges the confirmed count without changing the displayed order', () => {
    expect(
      mergeReaction(
        [
          { emoji: '👍', count: 2 },
          { emoji: '❤️', count: 1 }
        ],
        { emoji: '❤️', count: 3, reacted: true }
      )
    ).toEqual([
      { emoji: '👍', count: 2 },
      { emoji: '❤️', count: 3, reacted: true }
    ])
  })

  it('appends a newly used emoji to the displayed reactions', () => {
    expect(
      mergeReaction([{ emoji: '👍', count: 1 }], { emoji: '❤️', count: 3, reacted: true })
    ).toEqual([
      { emoji: '👍', count: 1 },
      { emoji: '❤️', count: 3, reacted: true }
    ])
  })
})
