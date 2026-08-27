import type { RequestHandler } from 'express'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'
import { AuthService } from './auth.service.js'
import { verifySessionToken } from './token.service.js'

const authService = new AuthService()

export const authenticate: RequestHandler = async (request, _response, next) => {
  try {
    const token = request.cookies?.[env.COOKIE_NAME] as string | undefined

    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesion requerida')
    }

    const payload = verifySessionToken(token)
    request.user = await authService.getSessionUser(payload.sub)
    next()
  } catch (error) {
    next(error)
  }
}

export function authorizeRoles(
  ...roles: Array<NonNullable<Express.Request['user']>['rol']['codigo']>
) {
  const middleware: RequestHandler = (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Sesion requerida'))
      return
    }

    if (!roles.includes(request.user.rol.codigo)) {
      next(new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion'))
      return
    }

    next()
  }

  return middleware
}

export const enforceAllowedOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get('origin')

  if (origin && origin !== env.CORS_ORIGIN) {
    next(new AppError(403, 'FORBIDDEN', 'Origen no autorizado'))
    return
  }

  next()
}
