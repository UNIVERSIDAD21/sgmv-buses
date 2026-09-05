import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/app.js'
import { createReadinessHandler } from '../src/observability/readiness.js'
import { shutdownServer } from '../src/server-lifecycle.js'

describe('GET /health', () => {
  it('returns the API health status', async () => {
    const response = await request(createApp()).get('/health').expect(200)

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'sgmv-api',
    })
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('preserves a valid upstream request ID and replaces an invalid one', async () => {
    const upstreamId = randomUUID()
    const preserved = await request(createApp())
      .get('/health')
      .set('X-Request-ID', upstreamId)
      .expect(200)
    const replaced = await request(createApp())
      .get('/health')
      .set('X-Request-ID', 'valor-no-confiable')
      .expect(200)

    expect(preserved.headers['x-request-id']).toBe(upstreamId)
    expect(replaced.headers['x-request-id']).not.toBe('valor-no-confiable')
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('includes the same opaque request ID in safe error responses', async () => {
    const response = await request(createApp()).get('/ruta-inexistente').expect(404)

    expect(response.body.error.requestId).toBe(response.headers['x-request-id'])
    expect(JSON.stringify(response.body)).not.toContain('stack')
  })

  it('reports readiness only after a real PostgreSQL query succeeds', async () => {
    const response = await request(createApp()).get('/ready').expect(200)

    expect(response.body).toEqual({ status: 'ready', service: 'sgmv-api' })
  })

  it('returns a sanitized 503 when the readiness database check fails', async () => {
    const app = createApp((testApp) => {
      testApp.get(
        '/test/not-ready',
        createReadinessHandler(async () => {
          throw new Error('database detail must stay private')
        }),
      )
    })
    const response = await request(app).get('/test/not-ready').expect(503)

    expect(response.body).toMatchObject({
      requestId: response.headers['x-request-id'],
      service: 'sgmv-api',
      status: 'not_ready',
    })
    expect(JSON.stringify(response.body)).not.toContain('database detail')
  })

  it('stops accepting HTTP traffic before disconnecting Prisma', async () => {
    const server = createServer((_request, response) => response.end('ok'))
    const disconnect = vi.fn(async () => undefined)

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    await shutdownServer(server, 'SIGTERM', disconnect)

    expect(server.listening).toBe(false)
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
