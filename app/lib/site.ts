export const siteName = 'Tlazolteotnia'
export const siteOrigin = 'https://0rga.org'
export const authorName = 'Daisuke Kobayashi'
export const authorAccount = '0rga'
export const artStationUrl = 'https://www.artstation.com/orga'
export const xUrl = 'https://x.com/0rga'
export const copyrightStartYear = 2026
export const copyrightCurrentYear = 2026

export function getAbsoluteUrl(pathname: string) {
  return new URL(pathname, siteOrigin).toString()
}

export function getBlogPostUrl(slug: string) {
  return getAbsoluteUrl(`/blog/${encodeURIComponent(slug)}`)
}

export function getBlogPostOgImageUrl(slug: string) {
  return getAbsoluteUrl(`/images/og/${encodeURIComponent(slug)}.png`)
}

export function getCopyrightYears(currentYear: number) {
  return currentYear === copyrightStartYear
    ? String(copyrightStartYear)
    : `${copyrightStartYear}–${currentYear}`
}

export function getCopyrightText(currentYear: number) {
  return `© ${getCopyrightYears(currentYear)} ${authorName}`
}
