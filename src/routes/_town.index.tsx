import { createFileRoute } from '@tanstack/react-router'
import { authorName, siteName, siteOgImageUrl, siteOrigin } from '#/lib/site'

const title = `${siteName} | ${new URL(siteOrigin).host}`
const description = `Personal site and notes from ${authorName} / ${siteName}.`
const imageAlt = `${siteName} — 記事の住人がいる島`

export const Route = createFileRoute('/_town/')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${siteOrigin}/` },
      { property: 'og:image', content: siteOgImageUrl },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: imageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: siteOgImageUrl },
      { name: 'twitter:image:alt', content: imageAlt }
    ]
  }),
  // The town itself is rendered by the _town layout.
  component: () => null
})
