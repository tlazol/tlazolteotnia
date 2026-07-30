import { Highlight, type PrismTheme } from 'prism-react-renderer'
import Prism from 'prismjs'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-toml'
import { Fragment } from 'react'

export type LeanCodeLanguage = 'lean' | 'bash' | 'toml' | 'typescript'

Prism.manual = true

Prism.languages.lean = {
  comment: [
    {
      pattern: /\/-[\s\S]*?-\//,
      greedy: true
    },
    {
      pattern: /--.*/,
      greedy: true
    }
  ],
  string: {
    pattern: /"(?:\\[\s\S]|[^"\\])*"/,
    greedy: true
  },
  char: {
    pattern: /'(?:\\.|[^'\\\r\n])'/,
    greedy: true
  },
  command: {
    pattern: /#[\p{L}_][\p{L}\p{N}_]*/u,
    alias: 'keyword'
  },
  declaration: {
    pattern:
      /(\b(?:abbrev|axiom|class|def|example|inductive|instance|opaque|structure|theorem)\s+)[\p{L}_][\p{L}\p{N}_'.₀-₉]*/u,
    lookbehind: true,
    alias: 'function'
  },
  tactic: {
    pattern:
      /\b(?:apply|assumption|by|cases|constructor|contradiction|exact|first|funext|have|induction|intro|left|next|obtain|omega|rfl|right|rw|show|simp|simp_all|specialize|subst|unfold)\b/,
    alias: 'keyword'
  },
  keyword:
    /\b(?:abbrev|axiom|class|def|deriving|do|else|end|example|extends|for|forall|from|fun|if|import|in|inductive|infix|infixl|infixr|instance|let|match|mutual|namespace|opaque|open|partial|private|protected|return|section|structure|termination_by|then|theorem|variable|where|with)\b/,
  builtin:
    /\b(?:Array|Bool|Char|Fin|Float|Int|List|Nat|Option|Prop|Sigma|String|Subtype|Type|UInt8|UInt16|UInt32|UInt64|Unit)\b/,
  boolean: /\b(?:false|true)\b/,
  number: /\b(?:0[bBoOxX][\dA-Fa-f]+|\d+(?:\.\d+)?)\b/,
  operator: /:=|=>|→|←|↔|≠|≤|≥|∧|∨|¬|∀|∃|[=<>+\-*/%^!&|~?:]/,
  punctuation: /[()[\]{},.;]/
}

export function PrismCode({
  code,
  language,
  className
}: {
  code: string
  language: LeanCodeLanguage
  className?: string
}) {
  return (
    <code className={[`language-${language}`, className].filter(Boolean).join(' ')}>
      <PrismTokens code={code} language={language} />
    </code>
  )
}

export function PrismTokens({ code, language }: { code: string; language: LeanCodeLanguage }) {
  return (
    <Highlight code={code} language={language} prism={Prism} theme={leanCodeTheme}>
      {({ getLineProps, getTokenProps, tokens }) => (
        <>
          {tokens.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              <span {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </span>
              {lineIndex < tokens.length - 1 ? '\n' : null}
            </Fragment>
          ))}
        </>
      )}
    </Highlight>
  )
}

const leanCodeTheme: PrismTheme = {
  plain: {
    backgroundColor: 'transparent',
    color: '#e1e3ea'
  },
  styles: [
    {
      types: ['comment'],
      style: { color: '#7f879e', fontStyle: 'italic' }
    },
    {
      types: ['keyword'],
      style: { color: '#d9a0ff' }
    },
    {
      types: ['function', 'class-name'],
      style: { color: '#91b8ff' }
    },
    {
      types: ['builtin', 'boolean', 'number', 'constant'],
      style: { color: '#ffc866' }
    },
    {
      types: ['string', 'char'],
      style: { color: '#72d6b1' }
    },
    {
      types: ['operator'],
      style: { color: '#80d8ff' }
    },
    {
      types: ['punctuation'],
      style: { color: '#a8aec3' }
    },
    {
      types: ['property'],
      style: { color: '#b9d2ff' }
    }
  ]
}
