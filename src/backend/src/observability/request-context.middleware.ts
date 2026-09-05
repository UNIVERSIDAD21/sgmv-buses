import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import type { RequestHandler } from 'express'

import { logger } from './logger.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const requestContext: RequestHandler = (request, response, next) => {
  const incomingId = request.get('x-request-id')
  const requestId = incomingId && UUID_PATTERN.test(incomingId) ? incomingId : randomUUID()
  const startedAt = performance.now()

  request.id = requestId
  response.set('X-Request-ID', requestId)

  response.on('finish', () => {
    logger.info({
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      method: request.method,
      path: request.originalUrl.split('?')[0],
      requestId,
      statusCode: response.statusCode,
      userId: request.user?.id,
    })
  })

  next()
}
