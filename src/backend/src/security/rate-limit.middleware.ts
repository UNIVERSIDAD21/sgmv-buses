import type { RequestHandler } from 'express'

import { RateLimitService } from './rate-limit.service.js'

const rateLimitService = new RateLimitService()

function loginIdentity(body: unknown) {
  if (
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof body.email === 'string'
  ) {
    return body.email.trim().toLowerCase().slice(0, 180) || 'missing'
  }

  return 'missing'
}

export const limitLoginAttempts: RequestHandler = async (request, _response, next) => {
  try {
    await rateLimitService.consumeLoginAttempt({
      identity: loginIdentity(request.body),
      ip: request.ip || request.socket.remoteAddress || 'unknown',
    })
    next()
  } catch (error) {
    next(error)
  }
}
