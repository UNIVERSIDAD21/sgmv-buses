import type { NextFunction, Request, RequestHandler, Response } from 'express'

import { runInPrismaTransaction } from '../prisma/client.js'
import { normalizeKnownHttpError } from '../shared/http.js'
import { IdempotencyService } from './idempotency.service.js'

const idempotencyService = new IdempotencyService()

function invokeHandler(
  handler: RequestHandler,
  request: Request,
  response: Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const routeNext: NextFunction = (error?: unknown) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    }

    try {
      Promise.resolve(handler(request, response, routeNext)).then(() => resolve(), reject)
    } catch (error) {
      reject(error)
    }
  })
}

function sendStoredResponse(response: Response, statusCode: number, body: unknown) {
  return response.status(statusCode).json(body)
}

export function idempotent(handler: RequestHandler): RequestHandler {
  return async (request, response, next) => {
    try {
      const preparation = await idempotencyService.prepare(request)

      if (preparation.kind === 'REPLAY') {
        response.set('Idempotency-Replayed', 'true')
        sendStoredResponse(response, preparation.statusCode, preparation.body)
        return
      }

      const originalJson = response.json
      let capturedBody: unknown
      let responseCaptured = false

      response.json = ((body: unknown) => {
        capturedBody = body
        responseCaptured = true
        return response
      }) as Response['json']

      try {
        await runInPrismaTransaction(async () => {
          await invokeHandler(handler, request, response)

          if (!responseCaptured) {
            throw new Error('La operacion idempotente no produjo una respuesta JSON')
          }

          const safeResponse = idempotencyService.serializeResponse(capturedBody, request)
          await idempotencyService.complete(preparation.prepared, response.statusCode, safeResponse)
        })
      } catch (error) {
        response.json = originalJson
        const normalized = normalizeKnownHttpError(error, request.id)

        if (!normalized) {
          next(error)
          return
        }

        const safeResponse = idempotencyService.serializeResponse(normalized.body, request)
        await idempotencyService.complete(preparation.prepared, normalized.statusCode, safeResponse)

        if (normalized.retryAfterSeconds !== undefined) {
          response.set('Retry-After', String(normalized.retryAfterSeconds))
        }

        sendStoredResponse(response, normalized.statusCode, normalized.body)
        return
      }

      response.json = originalJson
      sendStoredResponse(response, response.statusCode, capturedBody)
    } catch (error) {
      next(error)
    }
  }
}
