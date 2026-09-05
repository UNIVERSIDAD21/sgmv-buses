import type { ErrorRequestHandler, RequestHandler, Response } from 'express'
import { ZodError } from 'zod'

import { logger } from '../observability/logger.js'

type ErrorDetails = Record<string, unknown>

export interface NormalizedHttpError {
  body: {
    error: {
      code: string
      details?: ErrorDetails
      message: string
      requestId: string
    }
  }
  retryAfterSeconds?: number
  statusCode: number
}

export class AppError extends Error {
  readonly code: string
  readonly details?: ErrorDetails
  readonly statusCode: number

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetails) {
    super(message)
    this.code = code
    this.details = details
    this.statusCode = statusCode
  }
}

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

export function sendData<T>(response: Response, data: T, message = 'Operacion realizada') {
  return response.json({ data, message })
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Recurso no encontrado'))
}

export function normalizeKnownHttpError(
  error: unknown,
  requestId: string,
): NormalizedHttpError | undefined {
  if (error instanceof ZodError) {
    return {
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          details: error.flatten().fieldErrors,
          message: 'Datos de entrada invalidos',
          requestId,
        },
      },
      statusCode: 400,
    }
  }

  if (!(error instanceof AppError)) {
    return undefined
  }

  const normalized: NormalizedHttpError = {
    body: {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    },
    statusCode: error.statusCode,
  }

  if (error.details) {
    normalized.body.error.details = error.details
  }

  if (typeof error.details?.retryAfterSeconds === 'number') {
    normalized.retryAfterSeconds = error.details.retryAfterSeconds
  }

  return normalized
}

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  void next

  const normalized = normalizeKnownHttpError(error, request.id)

  if (normalized) {
    if (normalized.retryAfterSeconds !== undefined) {
      response.set('Retry-After', String(normalized.retryAfterSeconds))
    }

    return response.status(normalized.statusCode).json(normalized.body)
  }

  logger.error({ err: error, requestId: request.id }, 'Error HTTP no controlado')

  return response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      requestId: request.id,
    },
  })
}
