import type { JourneyDto, JourneyStatus } from './journey.types'

export const JOURNEY_LABELS: Record<JourneyStatus, string> = {
  CANCELADA: 'Cancelada',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  PROGRAMADA: 'Programada',
  REASIGNADA: 'Reasignada',
}

export type JourneyAction = 'cancel' | 'finish' | 'reassign' | 'start' | 'report'

export function closureOverdue(journey: JourneyDto, now: number) {
  return (
    journey.estado === 'EN_CURSO' && !journey.finReal && Date.parse(journey.finProgramado) < now
  )
}
