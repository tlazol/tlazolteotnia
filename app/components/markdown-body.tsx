import { marked, type Token, type Tokens } from 'marked'
import { createElement, Fragment, type ReactNode } from 'react'
import { CodeBlock } from '~/components/code-block'
import {
  getMarkdownHeadingTag,
  getUnknownMarkdownTokenPolicy,
  isSafeMarkdownUrl
} from '~/lib/markdown'
import { markdownBodyClassName } from '~/lib/styles'

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

      return createElement(
        getMarkdownHeadingTag(heading.depth),
        { key },
        renderInline(heading.tokens)
      )
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
    default: {
      const unknownToken = token as { tokens?: Token[] }

      if (getUnknownMarkdownTokenPolicy(unknownToken, 'block') === 'render-children') {
        return <Fragment key={key}>{renderBlocks(unknownToken.tokens ?? [])}</Fragment>
      }

      return null
    }
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
    default: {
      const unknownToken = token as { text?: string }

      return getUnknownMarkdownTokenPolicy(unknownToken, 'inline') === 'render-text'
        ? unknownToken.text
        : null
    }
  }
}

function renderText(token: Tokens.Text) {
  return token.tokens ? renderInline(token.tokens) : token.text
}

function renderLink(token: Tokens.Link, key: number) {
  const children = renderInline(token.tokens)

  if (!isSafeMarkdownUrl(token.href)) {
    return children
  }

  return (
    <a href={token.href} key={key} title={token.title ?? undefined}>
      {children}
    </a>
  )
}

function renderImage(token: Tokens.Image, key: number) {
  if (!isSafeMarkdownUrl(token.href)) {
    return token.text
  }

  return <img alt={token.text} key={key} src={token.href} title={token.title ?? undefined} />
}
