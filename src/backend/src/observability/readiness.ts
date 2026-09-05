import type { RequestHandler } from 'express'

import { env } from '../config/env.js'
import { checkDatabaseReadiness } from '../prisma/client.js'
import { logger } from './logger.js'

export function createReadinessHandler(
  checkDatabase: () => Promise<void> = checkDatabaseReadiness,
): RequestHandler {
  return async (request, response) => {
    let timeout: NodeJS.Timeout | undefined

    try {
      await Promise.race([
        checkDatabase(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Readiness timeout')),
            env.READINESS_TIMEOUT_MS,
          )
          timeout.unref()
        }),
      ])

      response.status(200).json({
        status: 'ready',
        service: 'sgmv-api',
      })
    } catch (error) {
      logger.warn({ err: error, requestId: request.id }, 'Readiness de PostgreSQL no disponible')
      response.status(503).json({
        status: 'not_ready',
        service: 'sgmv-api',
        requestId: request.id,
      })
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }
}
