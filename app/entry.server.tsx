import { PassThrough } from 'node:stream'
import { randomBytes } from 'node:crypto'
import { createElement } from 'react'
import { createReadableStreamFromReadable } from '@react-router/node'
import type { RenderOptions } from '@vercel/react-router/entry.server'
import { isbot } from 'isbot'
import { renderToPipeableStream } from 'react-dom/server'
import type { AppLoadContext, EntryContext } from 'react-router'
import { ServerRouter } from 'react-router'
import { CspNonceProvider, createHtmlSecurityHeaders } from '~/lib/security-headers'

export const streamTimeout = 5_000

const vercelDeploymentId = process.env.VERCEL_DEPLOYMENT_ID
const vercelSkewProtectionEnabled = process.env.VERCEL_SKEW_PROTECTION_ENABLED === '1'

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext?: AppLoadContext,
  options?: RenderOptions
) {
  const nonce = createCspNonce()

  for (const [name, value] of Object.entries(createHtmlSecurityHeaders(nonce))) {
    responseHeaders.set(name, value)
  }

  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false
    const userAgent = request.headers.get('user-agent')
    const readyOption =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? 'onAllReady' : 'onShellReady'

    const { pipe, abort } = renderToPipeableStream(
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
        ...options,
        nonce,
        [readyOption]() {
          shellRendered = true
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)

          responseHeaders.set('Content-Type', 'text/html')

          if (vercelSkewProtectionEnabled && vercelDeploymentId) {
            responseHeaders.append('Set-Cookie', `__vdpl=${vercelDeploymentId}; HttpOnly`)
          }

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          )

          pipe(body)
        },
        onShellError(error) {
          reject(error)
        },
        onError(error) {
          responseStatusCode = 500

          if (shellRendered) {
            console.error(error)
          }
        }
      }
    )

    setTimeout(abort, streamTimeout + 1000)
  })
}

function createCspNonce() {
  return randomBytes(16).toString('base64')
}
