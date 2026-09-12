import { evaluateJourneyMileageAlerts } from './alert.service.js'
import { evaluateJourneyProjectionAlerts } from './journey-projection-alerts.js'
import { logger } from '../observability/logger.js'
import { prisma } from '../prisma/client.js'

const evaluationIntervalMs = 15 * 60 * 1000

export class AlertEvaluationService {
  async evaluateAll(evaluatedAt = new Date()) {
    await prisma.$transaction((tx) => evaluateJourneyMileageAlerts(tx, evaluatedAt), {
      maxWait: 15_000,
      timeout: 60_000,
    })
    const journeys = await prisma.jornadaOperativa.findMany({
      where: { estado: { in: ['PROGRAMADA', 'EN_CURSO'] }, kmProyectadosDemo: { not: null } },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    for (const journey of journeys) {
      await prisma.$transaction(
        (tx) => evaluateJourneyProjectionAlerts(journey.id, tx, evaluatedAt),
        { maxWait: 15000, timeout: 15000 },
      )
    }
  }
}

export function startAlertEvaluation(service = new AlertEvaluationService()) {
  let running = false
  const run = () => {
    if (running) return
    running = true
    void service
      .evaluateAll()
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Fallo al evaluar alertas temporales de jornada')
      })
      .finally(() => {
        running = false
      })
  }

  run()
  const timer = setInterval(run, evaluationIntervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
