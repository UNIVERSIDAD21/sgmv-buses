import type { Prisma, TipoLectura } from '@prisma/client'

import { evaluatePreventiveAlertsForBus } from '../alerts/alert.service.js'
import { AppError } from '../shared/http.js'
import { lockBusMileage } from './mileage-lock.js'

export interface RegisterTechnicalMileageInput {
  actorId: string
  busId: string
  eventDate: Date
  interventionId?: string
  mileage: number
  motivo?: string
  orderId: string
  type: Extract<TipoLectura, 'INGRESO_TALLER' | 'REVISION_TECNICA' | 'CIERRE_MANTENIMIENTO'>
}

/**
 * Persists an immutable technical odometer event using the same chronological
 * neighbour policy used by operational journeys. Context ownership is resolved
 * by the work-order transaction; this helper never accepts a free bus id from HTTP.
 */
export async function registerTechnicalMileageReading(
  input: RegisterTechnicalMileageInput,
  tx: Prisma.TransactionClient,
) {
  await lockBusMileage(tx, input.busId)

  const bus = await tx.bus.findUnique({
    where: { id: input.busId },
    select: { kilometrajeActual: true },
  })
  if (!bus) throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')

  const readings = await tx.lecturaKilometraje.findMany({
    where: { busId: input.busId },
    orderBy: [{ fechaRegistro: 'asc' }, { id: 'asc' }],
    select: {
      fechaLectura: true,
      fechaRegistro: true,
      id: true,
      kilometrajeAnterior: true,
      kilometrajeNuevo: true,
    },
  })
  readings.sort((left, right) => {
    const eventDifference =
      (left.fechaLectura ?? left.fechaRegistro).getTime() -
      (right.fechaLectura ?? right.fechaRegistro).getTime()
    if (eventDifference !== 0) return eventDifference
    const registrationDifference = left.fechaRegistro.getTime() - right.fechaRegistro.getTime()
    return registrationDifference !== 0 ? registrationDifference : left.id.localeCompare(right.id)
  })

  const nextIndex = readings.findIndex(
    (reading) =>
      (reading.fechaLectura ?? reading.fechaRegistro).getTime() > input.eventDate.getTime(),
  )
  const previous =
    nextIndex === 0 ? null : readings[nextIndex < 0 ? readings.length - 1 : nextIndex - 1]
  const next = nextIndex < 0 ? null : readings[nextIndex]
  const baseline = readings[0]?.kilometrajeAnterior ?? bus.kilometrajeActual
  const previousMileage = previous?.kilometrajeNuevo ?? baseline

  if (input.mileage < previousMileage || (next && input.mileage > next.kilometrajeNuevo)) {
    throw new AppError(
      409,
      'MILEAGE_OUT_OF_SEQUENCE',
      'La lectura no conserva la secuencia del odometro',
      {
        maximoPermitido: next?.kilometrajeNuevo ?? null,
        minimoPermitido: previousMileage,
      },
    )
  }

  const reading = await tx.lecturaKilometraje.create({
    data: {
      busId: input.busId,
      fechaLectura: input.eventDate,
      ...(input.interventionId ? { intervencionId: input.interventionId } : {}),
      kilometrajeAnterior: previousMileage,
      kilometrajeNuevo: input.mileage,
      ...(input.motivo ? { motivo: input.motivo } : {}),
      ordenTrabajoId: input.orderId,
      registradoPorId: input.actorId,
      tipo: input.type,
    },
  })

  if (next) {
    await tx.lecturaKilometraje.update({
      where: { id: next.id },
      data: { kilometrajeAnterior: input.mileage },
    })
  }
  if (input.mileage > bus.kilometrajeActual) {
    await tx.bus.update({
      where: { id: input.busId },
      data: { kilometrajeActual: input.mileage },
    })
  }

  await evaluatePreventiveAlertsForBus(input.busId, tx)
  return reading
}
