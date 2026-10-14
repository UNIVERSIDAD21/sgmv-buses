import { buildAvailability } from '../availability/availability.policy.js'
import type { AvailabilityRecords } from '../availability/availability.types.js'

interface HorizonSlot {
  conductorId: number
  inicioProgramado: Date
  finProgramado: Date
}

interface Reservation extends HorizonSlot {
  busId: number
  estado: string
  inicioReal: Date | null
  finReal: Date | null
}

/** Valida el lote con las mismas causas de disponibilidad y reservas vigentes. */
export function assertHorizonAvailability(
  records: AvailabilityRecords,
  slots: HorizonSlot[],
  reservations: Reservation[],
  now = new Date(),
) {
  if (!records.bus) throw new Error('El vehículo del horizonte no existe')
  for (const slot of slots) {
    if (slot.inicioProgramado <= now || slot.finProgramado <= slot.inicioProgramado)
      throw new Error('La programación requiere intervalos futuros válidos')
    if (
      !buildAvailability({ ...records, conflictingJourney: null }, slot.inicioProgramado).disponible
    )
      throw new Error('La disponibilidad técnica impide la programación del horizonte')
    for (const reservation of reservations) {
      if (reservation.busId !== records.bus.id && reservation.conductorId !== slot.conductorId)
        continue
      const plannedOverlap =
        ['PROGRAMADA', 'EN_CURSO'].includes(reservation.estado) &&
        reservation.inicioProgramado < slot.finProgramado &&
        reservation.finProgramado > slot.inicioProgramado
      const openRealJourney =
        reservation.estado === 'EN_CURSO' &&
        reservation.inicioReal !== null &&
        reservation.inicioReal < slot.finProgramado &&
        reservation.finReal === null
      if (plannedOverlap || openRealJourney)
        throw new Error('El bus o el conductor tiene una jornada incompatible en el intervalo')
    }
  }
}
