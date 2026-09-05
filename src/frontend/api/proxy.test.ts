// @vitest-environment node

import type { IncomingHttpHeaders } from 'node:http'

import { afterEach, describe, expect, it, vi } from 'vitest'

import handler from './[...path].js'

interface CapturedResponse {
  body: Buffer
  headers: Map<string, string | number | readonly string[]>
  statusCode: number
}

function createResponse() {
  const captured: CapturedResponse = {
    body: Buffer.alloc(0),
    headers: new Map(),
    statusCode: 200,
  }
  const response = {
    end(chunk?: string | Uint8Array) {
      captured.body = chunk ? Buffer.from(chunk) : Buffer.alloc(0)
      return response
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      captured.headers.set(name.toLowerCase(), value)
      return response
    },
    get statusCode() {
      return captured.statusCode
    },
    set statusCode(value: number) {
      captured.statusCode = value
    },
  }

  return { captured, response }
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.RENDER_API_ORIGIN
})

describe('Vercel same-origin API proxy', () => {
  it('forwards only allowed request data and preserves security response headers', async () => {
    process.env.RENDER_API_ORIGIN = 'https://sgmv-api.example.test'
    const requestId = '5d32044d-8d65-4b34-baa0-3ef58c835ea7'
    const fetchMock = vi.fn(async () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'idempotency-replayed': 'true',
        'set-cookie': 'sgmv_session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax',
        'x-request-id': requestId,
      })

      return new Response(JSON.stringify({ data: { ok: true } }), { headers, status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { captured, response } = createResponse()
    const headers: IncomingHttpHeaders = {
      authorization: 'must-not-be-forwarded',
      cookie: 'sgmv_session=opaque',
      origin: 'https://sgmv.example.test',
      'x-csrf-token': 'csrf-opaque',
      'x-request-id': requestId,
    }

    await handler(
      { body: { value: 1 }, headers, method: 'POST', url: '/api/flota/buses?pagina=1' },
      response,
    )

    expect(captured.statusCode).toBe(200)
    expect(captured.headers.get('set-cookie')).toEqual([
      'sgmv_session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax',
    ])
    expect(captured.headers.get('x-request-id')).toBe(requestId)
    const [target, init] = fetchMock.mock.calls[0] ?? []
    const forwardedHeaders = new Headers(init?.headers)

    expect(String(target)).toBe('https://sgmv-api.example.test/flota/buses?pagina=1')
    expect(forwardedHeaders.get('authorization')).toBeNull()
    expect(forwardedHeaders.get('cookie')).toBe('sgmv_session=opaque')
    expect(forwardedHeaders.get('x-csrf-token')).toBe('csrf-opaque')
  })

  it('fails closed without exposing configuration or upstream errors', async () => {
    const { captured, response } = createResponse()

    await handler({ headers: {}, method: 'GET', url: '/api/ready' }, response)

    expect(captured.statusCode).toBe(503)
    expect(captured.body.toString()).toContain('PROXY_CONFIGURATION_ERROR')
    expect(captured.body.toString()).not.toContain('RENDER_API_ORIGIN')
  })
})
