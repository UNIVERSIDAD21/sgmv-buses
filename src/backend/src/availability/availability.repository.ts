import type { Prisma } from '@prisma/client'

import type { AvailabilityRecords } from './availability.types.js'

export interface AvailabilityQuery {
  busId: string
  conductorId?: string
  eventDate: Date
  journeyId?: string | null
}

export async function getAvailabilityRecords(
  input: AvailabilityQuery,
  tx: Prisma.TransactionClient,
): Promise<AvailabilityRecords> {
  const bus = await tx.bus.findUnique({
    where: { id: input.busId },
    select: { estadoOperativo: true, id: true, kilometrajeActual: true },
  })

  const journeyScope: Prisma.JornadaOperativaWhereInput[] = [{ busId: input.busId }]
  if (input.conductorId) journeyScope.push({ conductorId: input.conductorId })

  const [conflictingJourney, novelty, order, preventive] = await Promise.all([
    tx.jornadaOperativa.findFirst({
      where: {
        OR: journeyScope,
        id: input.journeyId ? { not: input.journeyId } : undefined,
        AND: {
          OR: [
            {
              estado: 'PROGRAMADA',
              inicioProgramado: { lte: input.eventDate },
              finProgramado: { gt: input.eventDate },
            },
            {
              estado: 'EN_CURSO',
              inicioReal: { lte: input.eventDate },
              finReal: null,
            },
          ],
        },
      },
      select: { id: true },
    }),
    tx.novedad.findFirst({
      where: {
        bloqueaDisponibilidad: true,
        busId: input.busId,
        estado: 'PENDIENTE_REVISION',
      },
      select: { id: true },
    }),
    tx.ordenTrabajo.findFirst({
      where: {
        busId: input.busId,
        OR: [
          { estado: { in: ['EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION'] } },
          {
            estado: { not: 'CERRADA' },
            novedad: { bloqueaDisponibilidad: true },
          },
        ],
      },
      select: { id: true },
    }),
    tx.programacionMantenimiento.findFirst({
      where: {
        activa: true,
        busId: input.busId,
        planMantenimientoPreventivo: { bloqueaAlVencer: true },
        OR: [
          { fechaProgramada: { lte: input.eventDate } },
          ...(bus ? [{ kilometrajeObjetivo: { lte: bus.kilometrajeActual } }] : []),
        ],
      },
      select: { id: true },
    }),
  ])

  return { bus, conflictingJourney, novelty, order, preventive }
}
