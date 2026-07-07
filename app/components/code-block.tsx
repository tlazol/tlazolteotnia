import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import { Highlight, type PrismTheme } from 'prism-react-renderer'
import { parseCodeInfo } from '~/lib/markdown'
import {
  codeBlockClassName,
  codeBlockLabelClassName,
  codeBlockLineClassName,
  codeBlockPreClassName
} from '~/lib/styles'

Prism.manual = true

export function CodeBlock({ code, info }: { code: string; info?: string }) {
  const { label, language } = parseCodeInfo(info)

  return (
    <figure className={codeBlockClassName}>
      {label && <figcaption className={codeBlockLabelClassName}>{label}</figcaption>}
      {language && Prism.languages[language] ? (
        <Highlight code={code} language={language} prism={Prism} theme={codeBlockTheme}>
          {({ className, getLineProps, getTokenProps, style, tokens }) => (
            <pre className={`${codeBlockPreClassName} ${className}`} style={style}>
              <code className={`language-${language}`}>
                {tokens.map((line, lineIndex) => (
                  <span
                    key={lineIndex}
                    {...getLineProps({
                      className: codeBlockLineClassName,
                      line
                    })}
                  >
                    {line.map((token, tokenIndex) => (
                      <span
                        key={tokenIndex}
                        {...getTokenProps({
                          token
                        })}
                      />
                    ))}
                  </span>
                ))}
              </code>
            </pre>
          )}
        </Highlight>
      ) : (
        <pre className={codeBlockPreClassName}>
          <code>{code}</code>
        </pre>
      )}
    </figure>
  )
}

const codeBlockTheme: PrismTheme = {
  plain: {
    backgroundColor: 'transparent',
    color: 'var(--text)'
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: 'var(--dim)', fontStyle: 'italic' }
    },
    {
      types: ['punctuation'],
      style: { color: 'var(--muted)' }
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'],
      style: { color: 'var(--amber)' }
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: { color: 'var(--green-soft)' }
    },
    {
      types: ['operator', 'entity', 'url'],
      style: { color: 'var(--cyan)' }
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: { color: 'var(--pink)' }
    },
    {
      types: ['function', 'class-name'],
      style: { color: 'var(--blue)' }
    },
    {
      types: ['regex', 'important', 'variable'],
      style: { color: 'var(--yellow)' }
    }
  ]
}
