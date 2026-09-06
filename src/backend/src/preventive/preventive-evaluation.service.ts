import { evaluatePreventiveAlertsForBus } from '../alerts/alert.service.js'
import { logger } from '../observability/logger.js'
import { prisma } from '../prisma/client.js'

const evaluationIntervalMs = 15 * 60 * 1000

export class PreventiveEvaluationService {
  async evaluateAll(evaluatedAt = new Date()) {
    const buses = await prisma.programacionMantenimiento.findMany({
      where: { activa: true, planMantenimientoPreventivoId: { not: null } },
      distinct: ['busId'],
      select: { busId: true },
    })

    for (const { busId } of buses) {
      await prisma.$transaction((tx) => evaluatePreventiveAlertsForBus(busId, tx, evaluatedAt), {
        maxWait: 15_000,
        timeout: 60_000,
      })
    }
  }
}

export function startPreventiveEvaluation(service = new PreventiveEvaluationService()) {
  const run = () => {
    void service.evaluateAll().catch((error: unknown) => {
      logger.error({ err: error }, 'Fallo al evaluar alertas preventivas')
    })
  }
  run()
  const timer = setInterval(run, evaluationIntervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
