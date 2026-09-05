import type { RequestHandler } from 'express'

import { logger } from '../observability/logger.js'
import { AuditService } from './audit.service.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const auditService = new AuditService()

export const auditMutations: RequestHandler = (request, response, next) => {
  if (SAFE_METHODS.has(request.method)) {
    next()
    return
  }

  response.on('finish', () => {
    void auditService
      .recordHttpMutation({
        actorId: request.user?.id,
        ip: request.ip || request.socket.remoteAddress,
        method: request.method,
        path: request.originalUrl.split('?')[0] ?? request.path,
        requestId: request.id,
        statusCode: response.statusCode,
      })
      .catch((error: unknown) => {
        logger.error({ err: error, requestId: request.id }, 'No se pudo persistir auditoria HTTP')
      })
  })

  next()
}
