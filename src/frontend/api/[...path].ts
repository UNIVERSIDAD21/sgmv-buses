import { randomUUID } from 'node:crypto'
import type { IncomingHttpHeaders, ServerResponse } from 'node:http'

interface ProxyRequest {
  body?: unknown
  headers: IncomingHttpHeaders
  method?: string
  url?: string
}

type ProxyResponse = Pick<ServerResponse, 'end' | 'setHeader'> & {
  statusCode: number
}

const REQUEST_HEADERS = [
  'accept',
  'content-type',
  'cookie',
  'idempotency-key',
  'origin',
  'user-agent',
  'x-csrf-token',
] as const

const RESPONSE_HEADERS = [
  'cache-control',
  'content-type',
  'idempotency-replayed',
  'retry-after',
  'x-request-id',
] as const

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(', ') : value
}

function safeRequestId(headers: IncomingHttpHeaders) {
  const candidate = headerValue(headers['x-request-id'])

  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID()
}

function getRenderOrigin() {
  const configured = process.env.RENDER_API_ORIGIN

  if (!configured) {
    return null
  }

  const origin = new URL(configured)
  const localDevelopment = origin.hostname === 'localhost' || origin.hostname === '127.0.0.1'

  if (
    (origin.protocol !== 'https:' && !localDevelopment) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('RENDER_API_ORIGIN must be an HTTPS origin without credentials or path')
  }

  return origin
}

function requestBody(request: ProxyRequest, method: string) {
  if (method === 'GET' || method === 'HEAD' || request.body === undefined) {
    return undefined
  }

  if (typeof request.body === 'string' || request.body instanceof Uint8Array) {
    return request.body
  }

  return JSON.stringify(request.body)
}

export default async function handler(request: ProxyRequest, response: ProxyResponse) {
  const requestId = safeRequestId(request.headers)

  response.setHeader('X-Request-ID', requestId)

  try {
    const renderOrigin = getRenderOrigin()

    if (!renderOrigin) {
      response.statusCode = 503
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(
        JSON.stringify({
          error: {
            code: 'PROXY_CONFIGURATION_ERROR',
            message: 'El servicio no esta configurado',
            requestId,
          },
        }),
      )
      return
    }

    const method = (request.method ?? 'GET').toUpperCase()
    const incomingUrl = new URL(request.url ?? '/api', 'https://proxy.sgmv.local')
    const upstreamPath = incomingUrl.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
    const upstreamUrl = new URL(`${upstreamPath}${incomingUrl.search}`, renderOrigin)
    const headers = new Headers()

    for (const name of REQUEST_HEADERS) {
      const value = headerValue(request.headers[name])

      if (value) {
        headers.set(name, value)
      }
    }

    headers.set('x-request-id', requestId)

    const upstream = await fetch(upstreamUrl, {
      body: requestBody(request, method),
      headers,
      method,
      redirect: 'manual',
    })

    response.statusCode = upstream.status

    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name)

      if (value) {
        response.setHeader(name, value)
      }
    }

    const setCookies = upstream.headers.getSetCookie()

    if (setCookies.length > 0) {
      response.setHeader('Set-Cookie', setCookies)
    }

    response.end(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    response.statusCode = 502
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        error: {
          code: 'UPSTREAM_UNAVAILABLE',
          message: 'El servicio no esta disponible',
          requestId,
        },
      }),
    )
  }
}
