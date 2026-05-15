export const siteName = 'Tlazolteotnia'
export const siteOrigin = 'https://0rga.org'

export function getAbsoluteUrl(pathname: string) {
  return new URL(pathname, siteOrigin).toString()
}

export function getBlogPostUrl(slug: string) {
  return getAbsoluteUrl(`/blog/${encodeURIComponent(slug)}`)
}

export function getBlogPostOgImageUrl(slug: string) {
  return getAbsoluteUrl(`/blog/${encodeURIComponent(slug)}/og.png`)
}
