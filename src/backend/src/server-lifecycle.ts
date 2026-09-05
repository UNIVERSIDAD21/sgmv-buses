import type { Server } from 'node:http'

import { env } from './config/env.js'
import { logger } from './observability/logger.js'
import { disconnectPrisma } from './prisma/client.js'

export async function shutdownServer(
  server: Server,
  signal: string,
  disconnect: () => Promise<void> = disconnectPrisma,
) {
  logger.info({ signal }, 'Cierre ordenado iniciado')

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.closeAllConnections()
      reject(new Error(`El cierre HTTP supero ${env.SHUTDOWN_TIMEOUT_MS} ms`))
    }, env.SHUTDOWN_TIMEOUT_MS)

    timeout.unref()
    server.close((error) => {
      clearTimeout(timeout)

      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

  await disconnect()
  logger.info({ signal }, 'Cierre ordenado completado')
}
