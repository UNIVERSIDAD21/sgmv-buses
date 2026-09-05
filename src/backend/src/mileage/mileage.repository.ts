import { randomUUID } from 'node:crypto'

import type { Prisma, TipoLectura } from '@prisma/client'

import { AppError } from '../shared/http.js'

const userRefSelect = {
  id: true,
  nombre: true,
  rol: { select: { codigo: true } },
} satisfies Prisma.UsuarioSelect

interface RegisterContextualMileageInput {
  actorId: string
  busId: string
  eventDate: Date
  journeyId: string
  mileage: number
  readingId?: string
  type: Extract<TipoLectura, 'INICIO_JORNADA' | 'FIN_JORNADA' | 'NOVEDAD'>
}

export async function registerContextualMileageReading(
  input: RegisterContextualMileageInput,
  tx: Prisma.TransactionClient,
) {
  const bus = await tx.bus.findUnique({
    where: { id: input.busId },
    select: { kilometrajeActual: true },
  })
  if (!bus) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Bus no encontrado')

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
    const byEvent =
      (left.fechaLectura ?? left.fechaRegistro).getTime() -
      (right.fechaLectura ?? right.fechaRegistro).getTime()
    if (byEvent !== 0) return byEvent
    const byRegistration = left.fechaRegistro.getTime() - right.fechaRegistro.getTime()
    return byRegistration !== 0 ? byRegistration : left.id.localeCompare(right.id)
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
      id: input.readingId ?? randomUUID(),
      jornadaOperativaId: input.journeyId,
      kilometrajeAnterior: previousMileage,
      kilometrajeNuevo: input.mileage,
      registradoPorId: input.actorId,
      tipo: input.type,
    },
    include: { registradoPor: { select: userRefSelect } },
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

  return reading
}
