import type { ErrorRequestHandler, RequestHandler, Response } from 'express'
import { ZodError } from 'zod'

type ErrorDetails = Record<string, unknown>

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

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next

  if (error instanceof ZodError) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de entrada invalidos',
        details: error.flatten().fieldErrors,
      },
    })
  }

  if (error instanceof AppError) {
    const payload: {
      error: {
        code: string
        details?: ErrorDetails
        message: string
      }
    } = {
      error: {
        code: error.code,
        message: error.message,
      },
    }

    if (error.details) {
      payload.error.details = error.details
    }

    return response.status(error.statusCode).json(payload)
  }

  return response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
    },
  })
}
