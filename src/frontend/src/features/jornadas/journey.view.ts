import type { JourneyDto, JourneyStatus } from './journey.types'

export const JOURNEY_LABELS: Record<JourneyStatus, string> = {
  CANCELADA: 'Cancelada',
  EN_CURSO: 'En curso',
  INTERRUMPIDA: 'Interrumpida',
  FINALIZADA: 'Finalizada',
  PROGRAMADA: 'Programada',
  REASIGNADA: 'Reasignada',
}

export type JourneyAction =
  | 'cancel'
  | 'finish'
  | 'reassign'
  | 'start'
  | 'report'
  | 'interrupt'
  | 'reconcile'
  | 'unrecoverable'

export function closureOverdue(journey: JourneyDto, now: number) {
  return (
    journey.estado === 'EN_CURSO' && !journey.finReal && Date.parse(journey.finProgramado) < now
  )
}
