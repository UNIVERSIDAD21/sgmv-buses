import type { JourneyDto } from './journey.types.js'

export type JourneyAttentionCategory =
  'CIERRE_PENDIENTE' | 'SALIDA_SIN_CONFIRMAR' | 'REASIGNACION' | 'RELEVO'

export function classifyJourneyAttention(
  journey: JourneyDto,
  driverValid: boolean,
  now: Date,
): JourneyAttentionCategory | null {
  const currentTime = now.getTime()
  if (journey.estado === 'PROGRAMADA') {
    if (!journey.inicioReal && Date.parse(journey.inicioProgramado) < currentTime) {
      return 'SALIDA_SIN_CONFIRMAR'
    }
    if (
      !driverValid ||
      journey.causasDisponibilidad.some((cause) => cause.codigo !== 'CONFLICTO_JORNADA')
    ) {
      return 'REASIGNACION'
    }
    return null
  }
  if (journey.estado === 'EN_CURSO' && journey.inicioReal) {
    if (!journey.finReal && Date.parse(journey.finProgramado) < currentTime) {
      return 'CIERRE_PENDIENTE'
    }
    if (
      !driverValid ||
      journey.causasDisponibilidad.some((cause) => cause.codigo !== 'CONFLICTO_JORNADA')
    ) {
      return 'RELEVO'
    }
  }
  if (
    journey.estado === 'INTERRUMPIDA' &&
    !journey.jornadaSucesoraId &&
    journey.acciones.puedeReasignar &&
    Date.parse(journey.finProgramado) > currentTime
  ) {
    return 'RELEVO'
  }
  return null
}
