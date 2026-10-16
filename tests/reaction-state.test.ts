import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReactionState } from '../src/lib/reaction-state'
import type { ReactionCount } from '../src/lib/reactions'

const initial: ReactionCount[] = [{ emoji: '👍', count: 2, reacted: false }]
function pendingRequest() {
  let resolve!: (response: Response) => void
  let reject!: (error: Error) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>((yes, no) => {
        resolve = yes
        reject = no
      })
  )
  vi.stubGlobal('fetch', fetch)
  return {
    fetch,
    resolve: (response: Response) => resolve(response),
    reject: (error: Error) => reject(error)
  }
}
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
afterEach(() => vi.unstubAllGlobals())
describe('reaction state owner', () => {
  it.each([true, false])(
    'optimistically updates once and uses the authoritative response (created=%s)',
    async (created) => {
      const request = pendingRequest()
      const owner = createReactionState('a/b', initial)
      const changed = vi.fn()
      const unsubscribe = owner.subscribe(changed)
      expect(owner.react('👍')).toBe(true)
      expect(owner.getSnapshot()).toEqual({
        reactions: [{ emoji: '👍', count: 3, reacted: true }],
        pendingEmoji: '👍',
        errorMessage: null
      })
      expect(owner.react('👍')).toBe(false)
      expect(owner.react('❤️')).toBe(false)
      expect(request.fetch).toHaveBeenCalledOnce()
      expect(request.fetch.mock.calls[0]).toEqual([
        '/api/reactions/a%2Fb',
        expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) })
      ])
      request.resolve(
        Response.json({ created, reaction: { emoji: '👍', count: 8, reacted: true } })
      )
      await settle()
      expect(owner.getSnapshot()).toEqual({
        reactions: [{ emoji: '👍', count: 8, reacted: true }],
        pendingEmoji: null,
        errorMessage: null
      })
      expect(owner.react('👍')).toBe(false)
      expect(initial[0].count).toBe(2)
      expect(changed).toHaveBeenCalledTimes(2)
      unsubscribe()
    }
  )
  it.each(['http', 'network', 'missing reaction'])(
    'restores the previous state on %s failure and permits retry',
    async (failure) => {
      const request = pendingRequest()
      const owner = createReactionState('post', initial)
      owner.react('❤️')
      if (failure === 'network') request.reject(new Error('offline'))
      else
        request.resolve(
          Response.json({ error: 'unavailable' }, { status: failure === 'http' ? 503 : 200 })
        )
      await settle()
      expect(owner.getSnapshot().reactions).toBe(initial)
      expect(owner.getSnapshot().pendingEmoji).toBeNull()
      expect(owner.getSnapshot().errorMessage).toBe(
        failure === 'network' ? 'offline' : 'unavailable'
      )
      expect(owner.react('❤️')).toBe(true)
      expect(owner.getSnapshot().errorMessage).toBeNull()
      owner.cancel()
    }
  )
  it.each(['success', 'failure'])(
    'ignores late %s after replacing the article or initial data',
    async (outcome) => {
      const request = pendingRequest()
      const old = createReactionState('old', initial)
      const changed = vi.fn()
      old.subscribe(changed)
      old.react('👍')
      old.cancel()
      const replacement = createReactionState('new', [{ emoji: '👍', count: 9, reacted: false }])
      if (outcome === 'success')
        request.resolve(Response.json({ reaction: { emoji: '👍', count: 50, reacted: true } }))
      else request.reject(new Error('late failure'))
      await settle()
      expect(changed).toHaveBeenCalledOnce()
      expect(replacement.getSnapshot().reactions).toEqual([
        { emoji: '👍', count: 9, reacted: false }
      ])
      expect(replacement.getSnapshot().pendingEmoji).toBeNull()
      expect(replacement.getSnapshot().errorMessage).toBeNull()
    }
  )
})
