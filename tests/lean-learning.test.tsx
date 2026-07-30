import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCodeGuide, LeanCode } from '../app/components/lean-learning-shell'
import {
  getLeanLesson,
  getLeanLessonNeighbors,
  leanLessonHref,
  leanLessons,
  leanReferenceAudit
} from '../app/lib/lean-learning'

describe('Lean learning curriculum', () => {
  it('keeps the eleven lessons in the intended learning order', () => {
    expect(leanLessons.map((lesson) => lesson.slug)).toEqual([
      'what-is-lean',
      'what-lean-checks',
      'types-and-functions',
      'data-and-recursion',
      'dependent-types',
      'propositions',
      'goals-and-tactics',
      'induction-and-simplification',
      'verified-program',
      'typescript-integration',
      'trust-boundary'
    ])
    expect(leanLessons.map((lesson) => lesson.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('resolves lessons and rejects unknown slugs', () => {
    expect(getLeanLesson('what-is-lean')?.title).toBe('そもそもLeanとは何か')
    expect(getLeanLesson('missing')).toBeUndefined()
    expect(getLeanLesson(undefined)).toBeUndefined()
  })

  it('builds stable lesson URLs', () => {
    expect(leanLessonHref('propositions')).toBe('/app/lean-learning/propositions')
  })

  it('publishes the Lean reference version used for the content audit', () => {
    expect(leanReferenceAudit).toEqual({
      version: '4.33.0-rc1',
      checkedAt: '2026-07-30',
      checkedAtLabel: '2026年7月30日',
      href: 'https://lean-lang.org/doc/reference/latest/'
    })
  })

  it('links every lesson to its immediate neighbors', () => {
    expect(getLeanLessonNeighbors('what-is-lean')).toEqual({
      previous: undefined,
      next: leanLessons[1]
    })
    expect(getLeanLessonNeighbors('propositions')).toEqual({
      previous: leanLessons[4],
      next: leanLessons[6]
    })
    expect(getLeanLessonNeighbors('trust-boundary')).toEqual({
      previous: leanLessons[9],
      next: undefined
    })
  })
})

describe('Lean code guide', () => {
  it('explains the declaration name, input, types, and definition body separator', () => {
    const guide = buildCodeGuide('def double (n : Nat) : Nat :=\n  n + n')

    expect(guide).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: 'def' }),
        expect.objectContaining({ token: 'double' }),
        expect.objectContaining({ token: '(n : Nat)' }),
        expect.objectContaining({ token: 'Nat' }),
        expect.objectContaining({ token: ':=' })
      ])
    )
  })

  it('explains non-Lean examples with their own language vocabulary', () => {
    expect(buildCodeGuide('const result: unknown = JSON.parse(stdout)', 'typescript')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: 'unknown' }),
        expect.objectContaining({ token: 'JSON.parse' })
      ])
    )
  })

  it('keeps an explanation available for a short expression without known keywords', () => {
    expect(buildCodeGuide('someUnknownExpression')).toEqual([
      expect.objectContaining({ token: 'コード全体' })
    ])
  })
})

describe('Lean syntax highlighting', () => {
  it('highlights Lean keywords, declaration names, builtins, and comments with Prism', () => {
    const html = renderToStaticMarkup(
      <LeanCode label="Main.lean">{'def double (n : Nat) : Nat :=\n  n + n -- twice'}</LeanCode>
    )

    expect(html).toContain('class="language-lean"')
    expect(html).toContain('class="token keyword"')
    expect(html).toContain('class="token declaration function"')
    expect(html).toContain('class="token builtin"')
    expect(html).toContain('class="token comment"')
  })

  it('uses the matching Prism grammar for TypeScript, TOML, and shell examples', () => {
    const examples = [
      ['policy.ts', 'const value: unknown = true', 'language-typescript'],
      ['lakefile.toml', 'name = "lean-policy"', 'language-toml'],
      ['build', 'lake build', 'language-bash'],
      ['terminal', 'lake lean Main.lean', 'language-bash']
    ] as const

    for (const [label, code, languageClass] of examples) {
      const html = renderToStaticMarkup(<LeanCode label={label}>{code}</LeanCode>)
      expect(html).toContain(`class="${languageClass}"`)
      expect(html).toContain('class="token ')
    }
  })
})
