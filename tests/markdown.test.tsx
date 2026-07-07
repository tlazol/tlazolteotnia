import { readFile } from 'node:fs/promises'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownBody } from '../app/components/markdown-body'
import { parseBlogPost } from '../app/lib/blog-post'
import {
  getUnknownMarkdownTokenPolicy,
  isSafeMarkdownUrl,
  parseCodeInfo
} from '../app/lib/markdown'

describe('MarkdownBody', () => {
  it('renders paragraphs, inline formatting, lists, tables, quotes, rules, and breaks', () => {
    const html = render(
      'Text **bold** *em* ~~gone~~  \nline\n\n3. third\n\n> quote\n\n---\n\n| A |\n| - |\n| B |'
    )

    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<del>gone</del>')
    expect(html).toContain('<br/>')
    expect(html).toContain('<ol start="3">')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<hr/>')
    expect(html).toContain('<table>')
  })

  it('does not render block or inline raw HTML', () => {
    const html = render('<script>alert(1)</script>\n\nText <b>unsafe</b> end')

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>')
    expect(html).toContain('Text unsafe end')
  })

  it('keeps text and alt text while rejecting unsafe link and image URLs', () => {
    const html = render(
      '[bad](javascript:alert(1)) ![alt](javascript:alert(1)) [invalid](https://[)'
    )

    expect(html).not.toContain('href=')
    expect(html).not.toContain('<img')
    expect(html).toContain('bad')
    expect(html).toContain('alt')
    expect(html).toContain('invalid')
  })

  it('renders relative, fragment, and allowed absolute URLs with image metadata', () => {
    const html = render(
      '[relative](/blog/post) [fragment](#part) [web](https://example.com) [mail](mailto:a@example.com) ![alt](/images/a.png "title")'
    )

    expect(html).toContain('href="/blog/post"')
    expect(html).toContain('href="#part"')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('href="mailto:a@example.com"')
    expect(html).toContain('alt="alt"')
    expect(html).toContain('title="title"')
  })

  it('clamps article headings to h2 through h6', () => {
    expect(render('# One\n\n###### Six')).toContain('<h2>One</h2>')
    expect(render('# One\n\n###### Six')).toContain('<h6>Six</h6>')
  })

  it('parses code aliases, filenames, plain text, and unknown languages', () => {
    expect(parseCodeInfo('js:app.js')).toEqual({ label: 'app.js', language: 'javascript' })
    expect(parseCodeInfo('console')).toEqual({ label: 'console', language: 'bash' })
    expect(parseCodeInfo('text')).toEqual({ label: 'text', language: undefined })
    expect(parseCodeInfo('unknown:file.xyz')).toEqual({ label: 'file.xyz', language: undefined })
    expect(render('```js:app.js\nconst value = 1\n```')).toContain('language-javascript')
    expect(render('```unknown:file.xyz\nplain\n```')).toContain('<code>plain</code>')
  })

  it('uses an explicit allowlist for URL protocols', () => {
    expect(isSafeMarkdownUrl('/relative')).toBe(true)
    expect(isSafeMarkdownUrl('tel:+81000000000')).toBe(true)
    expect(isSafeMarkdownUrl('data:text/html,test')).toBe(false)
    expect(isSafeMarkdownUrl('https://[')).toBe(false)
  })

  it('makes the unknown-token fallback explicit', () => {
    expect(getUnknownMarkdownTokenPolicy({ tokens: [] }, 'block')).toBe('render-children')
    expect(getUnknownMarkdownTokenPolicy({ text: 'kept' }, 'inline')).toBe('render-text')
    expect(getUnknownMarkdownTokenPolicy({}, 'block')).toBe('discard')
    expect(getUnknownMarkdownTokenPolicy({}, 'inline')).toBe('discard')
  })

  it('renders the major elements from a representative existing article', async () => {
    const source = await readFile('content/blog/better-output-structure.md', 'utf8')
    const post = parseBlogPost(source, 'content/blog/better-output-structure.md')
    const html = render(post.body)

    expect(html).toContain('<h2>')
    expect(html).toContain('<p>')
    expect(html.length).toBeGreaterThan(1_000)
  })
})

function render(markdown: string) {
  return renderToStaticMarkup(<MarkdownBody body={markdown} />)
}
