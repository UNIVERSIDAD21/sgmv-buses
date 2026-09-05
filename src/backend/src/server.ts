import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './observability/logger.js'
import { shutdownServer } from './server-lifecycle.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'SGMV API iniciada')
})

let shuttingDown = false

function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  void shutdownServer(server, signal).catch((error: unknown) => {
    logger.fatal({ err: error, signal }, 'Fallo durante el cierre ordenado')
    process.exitCode = 1
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
