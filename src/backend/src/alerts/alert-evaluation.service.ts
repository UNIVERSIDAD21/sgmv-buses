import { evaluateJourneyMileageAlerts } from './alert.service.js'
import { logger } from '../observability/logger.js'
import { prisma } from '../prisma/client.js'

const evaluationIntervalMs = 15 * 60 * 1000

export class AlertEvaluationService {
  async evaluateAll(evaluatedAt = new Date()) {
    await prisma.$transaction((tx) => evaluateJourneyMileageAlerts(tx, evaluatedAt), {
      maxWait: 15_000,
      timeout: 60_000,
    })
  }
}

export function startAlertEvaluation(service = new AlertEvaluationService()) {
  const run = () => {
    void service.evaluateAll().catch((error: unknown) => {
      logger.error({ err: error }, 'Fallo al evaluar alertas temporales de jornada')
    })
  }

  run()
  const timer = setInterval(run, evaluationIntervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
