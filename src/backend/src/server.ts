import { createApp } from './app.js'
import { startAlertEvaluation } from './alerts/alert-evaluation.service.js'
import { env } from './config/env.js'
import { logger } from './observability/logger.js'
import { startPreventiveEvaluation } from './preventive/preventive-evaluation.service.js'
import { shutdownServer } from './server-lifecycle.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  const photoConfiguration = [
    Boolean(env.CLOUDINARY_CLOUD_NAME),
    Boolean(env.CLOUDINARY_API_KEY),
    Boolean(env.CLOUDINARY_API_SECRET),
  ]
  logger.info({ port: env.PORT, photoConfiguration }, 'SGMV API iniciada')
  if (!photoConfiguration.every(Boolean)) {
    logger.warn(
      'Fotografías no disponibles: inicie este proceso con la configuración de almacenamiento.',
    )
  }
})
const stopPreventiveEvaluation = startPreventiveEvaluation()
const stopAlertEvaluation = startAlertEvaluation()

let shuttingDown = false

function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  stopAlertEvaluation()
  stopPreventiveEvaluation()
  void shutdownServer(server, signal).catch((error: unknown) => {
    logger.fatal({ err: error, signal }, 'Fallo durante el cierre ordenado')
    process.exitCode = 1
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
