import type { CSSProperties } from 'react'
import { ImageResponse } from '@vercel/og'
import type { LoaderFunctionArgs } from 'react-router'
import fontUrl from '~/assets/NotoSansCJKjp-Bold.otf?url'
import { getBlogPost } from '~/lib/blog.server'
import { siteName } from '~/lib/site'

const imageSize = {
  width: 1200,
  height: 630
}

let fontDataPromise: Promise<ArrayBuffer> | null = null

export async function loader({ params, request }: LoaderFunctionArgs) {
  if (!params.slug) {
    throw new Response('Not Found', { status: 404 })
  }

  const post = await getBlogPost(params.slug)

  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  const fontData = await loadFontData(request)
  const titleFontSize = getTitleFontSize(post.title)

  return new ImageResponse(
    <div style={canvasStyle}>
      <div style={gridStyle}>
        <div style={topBarStyle}>
          <div style={terminalLabelStyle}>content/blog/{post.slug}.md</div>
          <div style={dateStyle}>{post.date}</div>
        </div>

        <div style={titleWrapStyle}>
          <div style={{ ...titleStyle, fontSize: titleFontSize }}>{post.title}</div>
        </div>

        <div style={footerStyle}>
          <div style={brandStyle}>{siteName}</div>
          {post.tags.length > 0 && (
            <div style={tagsStyle}>
              {post.tags.slice(0, 3).map((tag) => (
                <div style={tagStyle} key={tag}>
                  #{tag}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    {
      ...imageSize,
      fonts: [
        {
          data: fontData,
          name: 'Noto Sans CJK JP',
          weight: 700,
          style: 'normal'
        }
      ],
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
      }
    }
  )
}

async function loadFontData(request: Request) {
  fontDataPromise ??= fetch(new URL(fontUrl, request.url))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load OGP font: ${response.status}`)
      }

      return response.arrayBuffer()
    })
    .catch((error) => {
      fontDataPromise = null
      throw error
    })

  return fontDataPromise
}

function getTitleFontSize(title: string) {
  const length = Array.from(title).length

  if (length <= 18) {
    return 78
  }

  if (length <= 28) {
    return 68
  }

  if (length <= 42) {
    return 58
  }

  return 50
}

const canvasStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  background:
    'linear-gradient(118deg, rgba(45, 172, 249, 0.18), transparent 44%), linear-gradient(242deg, rgba(250, 115, 218, 0.14), transparent 42%), #020403',
  color: '#d8e8dd',
  fontFamily: 'Noto Sans CJK JP'
}

const gridStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '64px 72px 58px',
  border: '1px solid #163923',
  boxSizing: 'border-box',
  backgroundImage:
    'linear-gradient(rgba(49, 255, 128, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(49, 255, 128, 0.08) 1px, transparent 1px)',
  backgroundSize: '44px 44px'
}

const topBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 28,
  fontSize: 24,
  lineHeight: 1.3
}

const terminalLabelStyle: CSSProperties = {
  display: 'flex',
  color: '#31ff80'
}

const dateStyle: CSSProperties = {
  display: 'flex',
  color: '#ffdf5f'
}

const titleWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: 330,
  paddingRight: 34
}

const titleStyle: CSSProperties = {
  display: 'flex',
  color: '#9cffbf',
  lineHeight: 1.16,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
  textShadow: '0 0 28px rgba(49, 255, 128, 0.26)'
}

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 28,
  paddingTop: 24,
  borderTop: '2px solid #31ff80'
}

const brandStyle: CSSProperties = {
  display: 'flex',
  color: '#70f7ff',
  fontSize: 34,
  lineHeight: 1
}

const tagsStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
}

const tagStyle: CSSProperties = {
  display: 'flex',
  padding: '8px 14px',
  border: '1px solid rgba(49, 255, 128, 0.44)',
  borderRadius: 999,
  background: 'rgba(49, 255, 128, 0.08)',
  color: '#31ff80',
  fontSize: 22,
  lineHeight: 1.25
}
