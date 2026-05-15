import { Fragment, createElement, type ReactNode } from 'react'
import { Link } from 'react-router'
import { FaAngleRight, FaHashtag } from 'react-icons/fa6'
import { marked, type Token, type Tokens } from 'marked'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'
import { Highlight, type PrismTheme } from 'prism-react-renderer'
import type { Route } from './+types/blog.$slug'
import { ProfileFooter } from '~/components/profile-footer'
import { getBlogPost } from '~/lib/blog.server'
import { getBlogPostOgImageUrl, getBlogPostUrl, siteName } from '~/lib/site'
import {
  codeBlockClassName,
  codeBlockLabelClassName,
  codeBlockLineClassName,
  codeBlockPreClassName,
  headingResetClassName,
  markdownBodyClassName,
  siteShellClassName,
  tagPillClassName,
  terminalLabelClassName,
  textLinkClassName
} from '~/lib/styles'

Prism.manual = true

export async function loader({ params }: Route.LoaderArgs) {
  const post = await getBlogPost(params.slug)

  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  return { post }
}

export function meta({ data }: Route.MetaArgs) {
  const post = data?.post
  const title = post ? `${post.title} | ${siteName}` : 'Post not found'
  const description = post?.description ?? `A note from ${siteName}.`
  const postUrl = post ? getBlogPostUrl(post.slug) : undefined
  const imageUrl = post ? getBlogPostOgImageUrl(post.slug) : undefined

  return [
    { title },
    {
      name: 'description',
      content: description
    },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'article' },
    ...(postUrl ? [{ property: 'og:url', content: postUrl }] : []),
    ...(imageUrl
      ? [
          { property: 'og:image', content: imageUrl },
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' },
          { property: 'og:image:type', content: 'image/png' }
        ]
      : []),
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...(imageUrl ? [{ name: 'twitter:image', content: imageUrl }] : [])
  ]
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData

  return (
    <main className={siteShellClassName}>
      <article className="pt-[26px]">
        <Link
          className={`${textLinkClassName} mb-[34px] text-[0.82rem] !text-[var(--green)]`}
          to="/"
        >
          <FaAngleRight aria-hidden="true" />
          cd ..
        </Link>

        <header className="relative border-b border-[var(--line)] pb-7 after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-px after:opacity-50 after:content-[''] after:[background:var(--spectrum)]">
          <p className={terminalLabelClassName}>cat content/blog/{post.slug}.md</p>
          <h1
            className={`${headingResetClassName} mt-16 mb-12 text-[clamp(2rem,12vw,4.8rem)] leading-none text-[var(--green-soft)] [overflow-wrap:anywhere]`}
          >
            {post.title}
          </h1>
          <div className="mt-[18px] grid gap-3 text-[0.82rem] font-bold text-[var(--yellow)]">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.tags.length > 0 && (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li className={tagPillClassName} key={tag}>
                    <FaHashtag aria-hidden="true" />
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-[18px] max-w-[680px] text-base leading-[1.7] text-[var(--muted)]">
            {post.description}
          </p>
        </header>

        <MarkdownBody body={post.body} />
      </article>

      <ProfileFooter showTopLink />
    </main>
  )
}

function formatDate(date: string) {
  return date
}

function MarkdownBody({ body }: { body: string }) {
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
