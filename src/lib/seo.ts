import { type BlogPost, getBlogPostModifiedDate } from '#/lib/blog-post'
import {
  artStationUrl,
  authorName,
  getBlogPostOgImageUrl,
  getBlogPostUrl,
  siteDescription,
  siteName,
  siteOgImageUrl,
  siteOrigin,
  xHandle,
  xUrl
} from '#/lib/site'

const homeUrl = `${siteOrigin}/`
const personId = `${homeUrl}#person`
const websiteId = `${homeUrl}#website`
const homeTitle = `${siteName} | ${new URL(siteOrigin).host}`
const homeImageAlt = `${siteName} — 記事の住人がいる島`

const person = {
  '@type': 'Person',
  '@id': personId,
  name: authorName,
  url: homeUrl,
  sameAs: [xUrl, artStationUrl]
}

function getSharedMeta() {
  return [
    { property: 'og:site_name', content: siteName },
    { property: 'og:locale', content: 'ja_JP' },
    { name: 'twitter:site', content: xHandle },
    { name: 'twitter:creator', content: xHandle }
  ]
}

function getImageMeta(url: string, alt: string) {
  return [
    { property: 'og:image', content: url },
    { property: 'og:image:type', content: 'image/png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: alt },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: url },
    { name: 'twitter:image:alt', content: alt }
  ]
}

export function getHomeHead() {
  return {
    meta: [
      { title: homeTitle },
      { name: 'description', content: siteDescription },
      { property: 'og:title', content: homeTitle },
      { property: 'og:description', content: siteDescription },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: homeUrl },
      ...getImageMeta(siteOgImageUrl, homeImageAlt),
      { name: 'twitter:title', content: homeTitle },
      { name: 'twitter:description', content: siteDescription },
      ...getSharedMeta(),
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': websiteId,
              url: homeUrl,
              name: siteName,
              description: siteDescription,
              inLanguage: 'ja',
              author: { '@id': personId }
            },
            person
          ]
        }
      }
    ],
    links: [{ rel: 'canonical', href: homeUrl }]
  }
}

export function getPostHead(post?: BlogPost) {
  if (!post) {
    return {
      meta: [{ title: 'Post not found' }, { name: 'robots', content: 'noindex' }]
    }
  }

  const title = `${post.title} | ${siteName}`
  const postUrl = getBlogPostUrl(post.slug)
  const imageUrl = getBlogPostOgImageUrl(post.slug)
  const modified = getBlogPostModifiedDate(post)

  return {
    meta: [
      { title },
      { name: 'description', content: post.description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: post.description },
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: postUrl },
      ...getImageMeta(imageUrl, title),
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: post.description },
      ...getSharedMeta(),
      { property: 'article:published_time', content: post.date },
      { property: 'article:modified_time', content: modified },
      { property: 'article:author', content: homeUrl },
      // TanStack keeps one meta per property, so tags go to JSON-LD keywords rather than
      // repeated article:tag entries.
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          '@id': `${postUrl}#article`,
          mainEntityOfPage: postUrl,
          url: postUrl,
          headline: post.title,
          description: post.description,
          image: imageUrl,
          datePublished: post.date,
          dateModified: modified,
          inLanguage: 'ja',
          keywords: post.tags,
          author: person,
          publisher: { '@id': personId },
          isPartOf: { '@id': websiteId }
        }
      }
    ],
    links: [{ rel: 'canonical', href: postUrl }]
  }
}
