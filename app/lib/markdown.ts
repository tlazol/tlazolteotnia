import { siteOrigin } from '~/lib/site'

const safeProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const plainCodeLanguages = new Set(['text', 'txt', 'plain', 'plaintext'])
const supportedCodeLanguages = new Set(['bash', 'css', 'javascript', 'json', 'markup'])
const codeLanguageAliases: Record<string, string> = {
  console: 'bash',
  html: 'markup',
  js: 'javascript'
}

export type CodeInfo = {
  label?: string
  language?: string
}

export type UnknownMarkdownTokenPolicy = 'render-children' | 'render-text' | 'discard'

export function isSafeMarkdownUrl(url: string) {
  try {
    return safeProtocols.has(new URL(url, siteOrigin).protocol)
  } catch {
    return false
  }
}

export function parseCodeInfo(info?: string): CodeInfo {
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

  return {
    label: filename || rawLanguage,
    language: resolveCodeLanguage(languageName)
  }
}

export function getMarkdownHeadingTag(depth: number) {
  return `h${Math.min(Math.max(depth, 2), 6)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function getUnknownMarkdownTokenPolicy(
  token: unknown,
  context: 'block' | 'inline'
): UnknownMarkdownTokenPolicy {
  if (typeof token !== 'object' || token === null) {
    return 'discard'
  }

  const candidate = token as { tokens?: unknown; text?: unknown }

  if (context === 'block' && Array.isArray(candidate.tokens)) {
    return 'render-children'
  }

  if (context === 'inline' && typeof candidate.text === 'string') {
    return 'render-text'
  }

  return 'discard'
}

function resolveCodeLanguage(languageName: string) {
  if (plainCodeLanguages.has(languageName)) {
    return undefined
  }

  const language = codeLanguageAliases[languageName] ?? languageName
  return supportedCodeLanguages.has(language) ? language : undefined
}
