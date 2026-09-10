import { Prisma } from '@prisma/client'

import { buildAvailability } from '../availability/availability.policy.js'
import { prisma } from '../prisma/client.js'

/** Read-only projection: all records and causes belong to one database snapshot. */
export function listDispatchProjections() {
  return prisma.$transaction(
    async (tx) => {
      const evaluatedAt = new Date()
      const orders = await tx.ordenTrabajo.findMany({
        orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }],
        select: {
          bus: { select: { codigoInterno: true, id: true, placa: true } },
          busId: true,
          codigo: true,
          disponibilidadAlCierre: true,
          estado: true,
          fechaCierre: true,
          id: true,
          jornadaOperativaId: true,
        },
        take: 100,
      })
      if (!orders.length) return []
      const busIds = [...new Set(orders.map((order) => order.busId))]
      const [buses, journeys, novelties, blockingOrders, schedules] = await Promise.all([
        tx.bus.findMany({
          where: { id: { in: busIds } },
          select: { id: true, estadoOperativo: true, kilometrajeActual: true },
        }),
        tx.jornadaOperativa.findMany({
          where: {
            busId: { in: busIds },
            OR: [
              {
                estado: 'PROGRAMADA',
                inicioProgramado: { lte: evaluatedAt },
                finProgramado: { gt: evaluatedAt },
              },
              { estado: 'EN_CURSO', inicioReal: { lte: evaluatedAt }, finReal: null },
            ],
          },
          select: { id: true, busId: true },
          orderBy: { id: 'asc' },
        }),
        tx.novedad.findMany({
          where: {
            busId: { in: busIds },
            bloqueaDisponibilidad: true,
            estado: 'PENDIENTE_REVISION',
          },
          select: { id: true, busId: true },
          orderBy: { id: 'asc' },
        }),
        tx.ordenTrabajo.findMany({
          where: {
            busId: { in: busIds },
            OR: [
              { estado: { in: ['EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION'] } },
              { estado: { not: 'CERRADA' }, novedad: { bloqueaDisponibilidad: true } },
            ],
          },
          select: { id: true, busId: true },
          orderBy: { id: 'asc' },
        }),
        tx.programacionMantenimiento.findMany({
          where: {
            busId: { in: busIds },
            activa: true,
            planMantenimientoPreventivoId: { not: null },
          },
          orderBy: [{ planMantenimientoPreventivo: { claveTarea: 'asc' } }, { id: 'asc' }],
          select: {
            busId: true,
            id: true,
            fechaProgramada: true,
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
      const busById = new Map(buses.map((bus) => [bus.id, bus]))
      const journeysByBus = groupByBus(journeys)
      const noveltiesByBus = groupByBus(novelties)
      const ordersByBus = groupByBus(blockingOrders)
      const schedulesByBus = groupByBus(schedules)
      return orders.map((order) => ({
        disponibilidad: buildAvailability(
          {
            bus: busById.get(order.busId) ?? null,
            conflictingJourney:
              journeysByBus
                .get(order.busId)
                ?.find((journey) => journey.id !== order.jornadaOperativaId) ?? null,
            novelty: noveltiesByBus.get(order.busId)?.[0] ?? null,
            order: ordersByBus.get(order.busId)?.[0] ?? null,
            preventive: (schedulesByBus.get(order.busId) ?? []).flatMap((schedule) =>
              schedule.planMantenimientoPreventivo
                ? [{ ...schedule, plan: schedule.planMantenimientoPreventivo }]
                : [],
            ),
          },
          evaluatedAt,
        ),
        orden: {
          bus: order.bus,
          codigo: order.codigo,
          disponibilidadAlCierre: order.disponibilidadAlCierre,
          estado: order.estado,
          fechaCierre: order.fechaCierre,
          id: order.id,
        },
      }))
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 15_000,
      timeout: 15_000,
    },
  )
}

function groupByBus<T extends { busId: string }>(records: T[]) {
  const groups = new Map<string, T[]>()
  for (const record of records) {
    const group = groups.get(record.busId) ?? []
    group.push(record)
    groups.set(record.busId, group)
  }
  return groups
}
