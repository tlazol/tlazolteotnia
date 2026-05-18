import { Fragment, createElement, type ReactNode } from 'react'
import { marked, type Token, type Tokens } from 'marked'
import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import { Highlight, type PrismTheme } from 'prism-react-renderer'
import {
  codeBlockClassName,
  codeBlockLabelClassName,
  codeBlockLineClassName,
  codeBlockPreClassName,
  markdownBodyClassName
} from '~/lib/styles'

Prism.manual = true

export function MarkdownBody({ body }: { body: string }) {
  return <div className={markdownBodyClassName}>{renderBlocks(marked.lexer(body))}</div>
}

function renderBlocks(tokens: Token[]): ReactNode[] {
  return tokens.map((token, index) => renderBlock(token, index))
}

function renderBlock(token: Token, key: number): ReactNode {
  switch (token.type) {
    case 'space':
    case 'def':
    case 'html':
      return null
    case 'heading': {
      const heading = token as Tokens.Heading

      return createElement(getHeadingTag(heading.depth), { key }, renderInline(heading.tokens))
    }
    case 'paragraph': {
      const paragraph = token as Tokens.Paragraph

      return <p key={key}>{renderInline(paragraph.tokens)}</p>
    }
    case 'blockquote': {
      const blockquote = token as Tokens.Blockquote

      return <blockquote key={key}>{renderBlocks(blockquote.tokens)}</blockquote>
    }
    case 'list': {
      const list = token as Tokens.List
      const children = list.items.map((item, index) => (
        <li key={index}>{renderBlocks(item.tokens)}</li>
      ))

      if (list.ordered) {
        return (
          <ol key={key} start={typeof list.start === 'number' ? list.start : undefined}>
            {children}
          </ol>
        )
      }

      return <ul key={key}>{children}</ul>
    }
    case 'code': {
      const code = token as Tokens.Code

      return <CodeBlock code={code.text} info={code.lang} key={key} />
    }
    case 'hr':
      return <hr key={key} />
    case 'table': {
      const table = token as Tokens.Table

      return (
        <table key={key}>
          <thead>
            <tr>
              {table.header.map((cell, index) => (
                <th key={index}>{renderInline(cell.tokens)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{renderInline(cell.tokens)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    case 'text': {
      const text = token as Tokens.Text

      return <Fragment key={key}>{renderText(text)}</Fragment>
    }
    default:
      if ('tokens' in token && Array.isArray(token.tokens)) {
        return <Fragment key={key}>{renderBlocks(token.tokens)}</Fragment>
      }

      return null
  }
}

function renderInline(tokens: Token[]): ReactNode[] {
  return tokens.map((token, index) => renderInlineToken(token, index))
}

function renderInlineToken(token: Token, key: number): ReactNode {
  switch (token.type) {
    case 'text':
      return renderText(token as Tokens.Text)
    case 'escape':
      return (token as Tokens.Escape).text
    case 'strong': {
      const strong = token as Tokens.Strong

      return <strong key={key}>{renderInline(strong.tokens)}</strong>
    }
    case 'em': {
      const em = token as Tokens.Em

      return <em key={key}>{renderInline(em.tokens)}</em>
    }
    case 'del': {
      const del = token as Tokens.Del

      return <del key={key}>{renderInline(del.tokens)}</del>
    }
    case 'codespan':
      return <code key={key}>{(token as Tokens.Codespan).text}</code>
    case 'br':
      return <br key={key} />
    case 'link':
      return renderLink(token as Tokens.Link, key)
    case 'image':
      return renderImage(token as Tokens.Image, key)
    case 'html':
      return null
    default:
      return 'text' in token ? token.text : null
  }
}

function renderText(token: Tokens.Text) {
  return token.tokens ? renderInline(token.tokens) : token.text
}

function renderLink(token: Tokens.Link, key: number) {
  const children = renderInline(token.tokens)

  if (!isSafeUrl(token.href)) {
    return children
  }

  return (
    <a href={token.href} key={key} title={token.title ?? undefined}>
      {children}
    </a>
  )
}

function renderImage(token: Tokens.Image, key: number) {
  if (!isSafeUrl(token.href)) {
    return token.text
  }

  return <img alt={token.text} key={key} src={token.href} title={token.title ?? undefined} />
}

function CodeBlock({ code, info }: { code: string; info?: string }) {
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

function parseCodeInfo(info?: string) {
  const rawInfo = info?.trim()

  if (!rawInfo) {
    return {}
  }

  const separatorIndex = rawInfo.indexOf(':')
  const rawLanguage = (separatorIndex >= 0 ? rawInfo.slice(0, separatorIndex) : rawInfo)
    .split(/\s+/)[0]
    .toLowerCase()
  const filename =
    separatorIndex >= 0
      ? rawInfo
          .slice(separatorIndex + 1)
          .trim()
          .split(/\s+/)[0]
      : ''
  const languageName = rawLanguage.split('+')[0]
  const language = getCodeLanguage(languageName)

  return {
    label: filename || rawLanguage,
    language
  }
}

function getCodeLanguage(languageName: string) {
  if (plainCodeLanguages.has(languageName)) {
    return undefined
  }

  return (
    codeLanguageAliases[languageName] ?? (Prism.languages[languageName] ? languageName : undefined)
  )
}

function getHeadingTag(depth: number) {
  return `h${Math.min(Math.max(depth, 2), 6)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

function isSafeUrl(url: string) {
  try {
    const parsedUrl = new URL(url, 'https://0rga.org')

    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
}

const plainCodeLanguages = new Set(['text', 'txt', 'plain', 'plaintext'])

const codeLanguageAliases: Record<string, string | undefined> = {
  console: 'bash',
  html: 'markup',
  javascript: 'javascript',
  js: 'javascript',
  json: 'json',
  css: 'css'
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
