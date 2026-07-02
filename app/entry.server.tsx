import { createElement } from 'react'
import { isbot } from 'isbot'
import { renderToReadableStream } from 'react-dom/server'
import type { EntryContext } from 'react-router'
import { ServerRouter } from 'react-router'
import { CspNonceProvider, createHtmlSecurityHeaders } from '~/lib/security-headers'

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  const nonce = createCspNonce()

  for (const [name, value] of Object.entries(createHtmlSecurityHeaders(nonce))) {
    responseHeaders.set(name, value)
  }

  let shellRendered = false
  const userAgent = request.headers.get('user-agent')
  const body = await renderToReadableStream(
    createElement(
      CspNonceProvider,
      { nonce },
      createElement(ServerRouter, {
        context: routerContext,
        url: request.url,
        nonce
      })
    ),
    {
      nonce,
      onError(error: unknown) {
        responseStatusCode = 500

        if (shellRendered) {
          console.error(error)
        }
      }
    }
  )
  shellRendered = true

  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady
  }

  responseHeaders.set('Content-Type', 'text/html')

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode
  })
}

function createCspNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}
