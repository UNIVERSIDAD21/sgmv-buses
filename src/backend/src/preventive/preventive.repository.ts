import { randomUUID } from 'node:crypto'

import { Prisma, type CriterioMantenimiento, type PrioridadOrden } from '@prisma/client'

import { prisma } from '../prisma/client.js'

type PreventiveDbClient = Prisma.TransactionClient | typeof prisma

const userSelect = {
  email: true,
  id: true,
  nombre: true,
} as const

const busSelect = {
  anio: true,
  codigoInterno: true,
  estadoOperativo: true,
  id: true,
  kilometrajeActual: true,
  marca: true,
  modelo: true,
  placa: true,
} as const

export const preventiveOrderSummaryInclude = {
  estadosHistorial: {
    orderBy: {
      fechaCambio: 'asc',
    },
    take: 1,
  },
} as const

export const preventiveScheduleInclude = {
  bus: {
    select: busSelect,
  },
  creadaPor: {
    select: userSelect,
  },
  ordenesTrabajo: {
    include: preventiveOrderSummaryInclude,
    orderBy: {
      fechaCreacion: 'desc',
    },
    take: 1,
    where: {
      estado: {
        not: 'CERRADA',
      },
      origen: 'PREVENTIVO',
      tipo: 'PREVENTIVA',
    },
  },
} as const

export type PreventiveScheduleRecord = Prisma.ProgramacionMantenimientoGetPayload<{
  include: typeof preventiveScheduleInclude
}>
export type PreventiveWorkOrderRecord = Prisma.OrdenTrabajoGetPayload<{
  include: typeof preventiveOrderSummaryInclude
}>

interface UpsertScheduleData {
  activa?: boolean
  actividad: string
  busId: string
  criterio: CriterioMantenimiento
  fechaProgramada: Date | null
  kilometrajeObjetivo: number | null
  tipo: string
}

interface GenerateOrderData {
  descripcionOrden: string
  fechaObjetivoPreventivo: Date | null
  kilometrajeObjetivoPreventivo: number | null
  observacion: string | null
  prioridad: PrioridadOrden
}

export class PreventiveRepository {
  countActiveOrders() {
    return prisma.ordenTrabajo.count({
      where: {
        estado: {
          not: 'CERRADA',
        },
        origen: 'PREVENTIVO',
        programacionMantenimientoId: {
          not: null,
        },
        tipo: 'PREVENTIVA',
      },
    })
  }

  createSchedule(data: UpsertScheduleData, actorId: string) {
    return prisma.programacionMantenimiento.create({
      data: {
        actividad: data.actividad,
        busId: data.busId,
        creadaPorId: actorId,
        criterio: data.criterio,
        fechaProgramada: data.fechaProgramada,
        kilometrajeObjetivo: data.kilometrajeObjetivo,
        tipo: data.tipo,
      },
      include: preventiveScheduleInclude,
    })
  }

  findBusById(id: string) {
    return prisma.bus.findUnique({
      where: { id },
    })
  }

  findExistingActiveOrderBySchedule(programacionId: string) {
    return prisma.ordenTrabajo.findFirst({
      where: {
        estado: {
          not: 'CERRADA',
        },
        origen: 'PREVENTIVO',
        programacionMantenimientoId: programacionId,
        tipo: 'PREVENTIVA',
      },
      include: preventiveOrderSummaryInclude,
      orderBy: {
        fechaCreacion: 'desc',
      },
    })
  }

  findLogicalDuplicate(
    data: UpsertScheduleData,
    excludeId?: string,
  ): Promise<PreventiveScheduleRecord | null> {
    return prisma.programacionMantenimiento.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        activa: true,
        actividad: {
          equals: data.actividad,
          mode: 'insensitive',
        },
        busId: data.busId,
        criterio: data.criterio,
        fechaProgramada: data.fechaProgramada,
        kilometrajeObjetivo: data.kilometrajeObjetivo,
        tipo: {
          equals: data.tipo,
          mode: 'insensitive',
        },
      },
      include: preventiveScheduleInclude,
    })
  }

  findScheduleById(id: string) {
    return prisma.programacionMantenimiento.findUnique({
      where: { id },
      include: preventiveScheduleInclude,
    })
  }

  listSchedules(where: Prisma.ProgramacionMantenimientoWhereInput) {
    return prisma.programacionMantenimiento.findMany({
      where,
      include: preventiveScheduleInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  updateSchedule(id: string, data: Omit<UpsertScheduleData, 'busId'>) {
    return prisma.programacionMantenimiento.update({
      where: { id },
      data: {
        ...(data.activa !== undefined ? { activa: data.activa } : {}),
        actividad: data.actividad,
        criterio: data.criterio,
        fechaProgramada: data.fechaProgramada,
        kilometrajeObjetivo: data.kilometrajeObjetivo,
        tipo: data.tipo,
      },
      include: preventiveScheduleInclude,
    })
  }

  generatePreventiveOrder(programacionId: string, actorId: string, data: GenerateOrderData) {
    return prisma.$transaction(
      async (tx) => {
        const schedule = await this.findScheduleByIdForTransaction(programacionId, tx)

        if (!schedule) {
          return {
            orden: null,
            programacion: null,
            status: 'NOT_FOUND' as const,
          }
        }

        const existingOrder = schedule.ordenesTrabajo[0]

        if (existingOrder) {
          return {
            orden: existingOrder,
            programacion: schedule,
            status: 'ALREADY_GENERATED' as const,
          }
        }

        const order = await tx.ordenTrabajo.create({
          data: {
            busId: schedule.busId,
            codigo: this.createPreventiveOrderCode(),
            creadaPorId: actorId,
            descripcion: data.descripcionOrden,
            estado: 'PENDIENTE_ASIGNACION',
            fechaObjetivoPreventivo: data.fechaObjetivoPreventivo,
            kilometrajeObjetivoPreventivo: data.kilometrajeObjetivoPreventivo,
            origen: 'PREVENTIVO',
            prioridad: data.prioridad,
            programacionMantenimientoId: programacionId,
            tecnicoAsignadoId: null,
            tipo: 'PREVENTIVA',
          },
          include: preventiveOrderSummaryInclude,
        })

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: null,
            estadoNuevo: 'PENDIENTE_ASIGNACION',
            observacion:
              data.observacion ?? 'Orden preventiva creada desde programacion de mantenimiento',
            ordenTrabajoId: order.id,
          },
        })

        const refreshedOrder = await tx.ordenTrabajo.findUniqueOrThrow({
          where: { id: order.id },
          include: preventiveOrderSummaryInclude,
        })
        const refreshedSchedule = await this.findScheduleByIdForTransaction(programacionId, tx)

        return {
          orden: refreshedOrder,
          programacion: refreshedSchedule,
          status: 'CREATED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  private createPreventiveOrderCode() {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()

    return `OT-PREV-${suffix}`
  }

  private findScheduleByIdForTransaction(id: string, client: PreventiveDbClient) {
    return client.programacionMantenimiento.findUnique({
      where: { id },
      include: preventiveScheduleInclude,
    })
  }
}
