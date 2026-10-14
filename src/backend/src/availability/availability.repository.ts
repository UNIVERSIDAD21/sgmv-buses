import type { Prisma, PrismaClient } from '@prisma/client'

import type { AvailabilityRecords } from './availability.types.js'

export interface AvailabilityQuery {
  busId: number
  conductorId?: number
  eventDate: Date
  journeyId?: number | null
}

/** Resuelve una página completa sin repetir consultas por cada jornada. */
export async function getAvailabilityRecordsBatch(
  inputs: AvailabilityQuery[],
  tx: Prisma.TransactionClient | PrismaClient,
): Promise<AvailabilityRecords[]> {
  if (!inputs.length) return []
  const busIds = [...new Set(inputs.map((input) => input.busId))]
  const driverIds = [
    ...new Set(inputs.flatMap((input) => (input.conductorId ? [input.conductorId] : []))),
  ]
  const first = new Date(Math.min(...inputs.map((input) => input.eventDate.getTime())))
  const last = new Date(Math.max(...inputs.map((input) => input.eventDate.getTime())))
  const [buses, journeys, novelties, orders, preventive] = await Promise.all([
    tx.bus.findMany({
      where: { id: { in: busIds } },
      select: { estadoOperativo: true, id: true, kilometrajeActual: true },
    }),
    tx.jornadaOperativa.findMany({
      where: {
        OR: [{ busId: { in: busIds } }, { conductorId: { in: driverIds } }],
        AND: {
          OR: [
            { estado: 'PROGRAMADA', inicioProgramado: { lte: last }, finProgramado: { gt: first } },
            { estado: 'EN_CURSO', inicioReal: { lte: last }, finReal: null },
          ],
        },
      },
      select: {
        id: true,
        busId: true,
        conductorId: true,
        estado: true,
        inicioProgramado: true,
        finProgramado: true,
        inicioReal: true,
        finReal: true,
      },
      orderBy: { id: 'asc' },
    }),
    tx.novedad.findMany({
      where: { busId: { in: busIds }, bloqueaDisponibilidad: true, estado: 'PENDIENTE_REVISION' },
      select: { id: true, busId: true },
      orderBy: { id: 'asc' },
    }),
    tx.ordenTrabajo.findMany({
      where: {
        busId: { in: busIds },
        OR: [
          { estado: { in: ['EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION'] } },
          { estado: { notIn: ['CERRADA', 'ANULADA'] }, novedad: { bloqueaDisponibilidad: true } },
        ],
      },
      select: { id: true, busId: true },
      orderBy: { id: 'asc' },
    }),
    tx.programacionMantenimiento.findMany({
      where: { activa: true, busId: { in: busIds }, planMantenimientoPreventivoId: { not: null } },
      orderBy: [{ planMantenimientoPreventivo: { claveTarea: 'asc' } }, { id: 'asc' }],
      select: {
        busId: true,
        fechaProgramada: true,
        id: true,
        kilometrajeObjetivo: true,
        planMantenimientoPreventivo: {
          select: {
            anticipacionDias: true,
            anticipacionKm: true,
            bloqueaAlVencer: true,
            claveTarea: true,
          },
        },
      },
    }),
  ])
  return inputs.map((input) => {
    const conflicting = journeys.find(
      (journey) =>
        journey.id !== input.journeyId &&
        (journey.busId === input.busId || journey.conductorId === input.conductorId) &&
        ((journey.estado === 'PROGRAMADA' &&
          journey.inicioProgramado <= input.eventDate &&
          journey.finProgramado > input.eventDate) ||
          (journey.estado === 'EN_CURSO' &&
            journey.inicioReal !== null &&
            journey.inicioReal <= input.eventDate &&
            journey.finReal === null)),
    )
    const novelty = novelties.find((row) => row.busId === input.busId)
    const order = orders.find((row) => row.busId === input.busId)
    return {
      bus: buses.find((bus) => bus.id === input.busId) ?? null,
      conflictingJourney: conflicting ? { id: conflicting.id } : null,
      novelty: novelty ? { id: novelty.id } : null,
      order: order ? { id: order.id } : null,
      preventive: preventive.flatMap((schedule) =>
        schedule.busId === input.busId && schedule.planMantenimientoPreventivo
          ? [
              {
                id: schedule.id,
                fechaProgramada: schedule.fechaProgramada,
                kilometrajeObjetivo: schedule.kilometrajeObjetivo,
                plan: schedule.planMantenimientoPreventivo,
              },
            ]
          : [],
      ),
    }
  })
}

export async function getAvailabilityRecords(
  input: AvailabilityQuery,
  tx: Prisma.TransactionClient | PrismaClient,
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
            estado: { notIn: ['CERRADA', 'ANULADA'] },
            novedad: { bloqueaDisponibilidad: true },
          },
        ],
      },
      select: { id: true },
    }),
    tx.programacionMantenimiento.findMany({
      where: {
        activa: true,
        busId: input.busId,
        planMantenimientoPreventivoId: { not: null },
      },
      orderBy: [{ planMantenimientoPreventivo: { claveTarea: 'asc' } }, { id: 'asc' }],
      select: {
        fechaProgramada: true,
        id: true,
        kilometrajeObjetivo: true,
        planMantenimientoPreventivo: {
          select: {
            anticipacionDias: true,
            anticipacionKm: true,
            bloqueaAlVencer: true,
            claveTarea: true,
          },
        },
      },
    }),
  ])

  return {
    bus,
    conflictingJourney,
    novelty,
    order,
    preventive: preventive.flatMap((schedule) =>
      schedule.planMantenimientoPreventivo
        ? [{ ...schedule, plan: schedule.planMantenimientoPreventivo }]
        : [],
    ),
  }
}
