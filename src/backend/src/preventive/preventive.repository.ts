import { randomUUID } from 'node:crypto'

import { Prisma, type CriterioMantenimiento, type PrioridadOrden } from '@prisma/client'

import { prisma } from '../prisma/client.js'
import {
  buildPreventivePlanSnapshot,
  classifyPreventiveCycle,
  initialPreventiveTargets,
} from './preventive-cycle.js'

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
  modeloBusId: true,
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
  planMantenimientoPreventivo: true,
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

  materializePlanSchedule(planId: string, requestedBusId: string | undefined, actorId: string) {
    return prisma.$transaction(
      async (tx) => {
        const requestedPlan = await tx.planMantenimientoPreventivo.findUnique({
          where: { id: planId },
        })
        if (!requestedPlan) return { programacion: null, status: 'PLAN_NOT_FOUND' as const }
        if (!requestedPlan.activo) return { programacion: null, status: 'PLAN_INACTIVE' as const }

        const busId = requestedPlan.busId ?? requestedBusId
        if (!busId) return { programacion: null, status: 'BUS_REQUIRED' as const }
        if (requestedPlan.busId && requestedBusId && requestedPlan.busId !== requestedBusId) {
          return { programacion: null, status: 'PLAN_BUS_MISMATCH' as const }
        }

        const bus = await tx.bus.findUnique({ where: { id: busId } })
        if (!bus) return { programacion: null, status: 'BUS_NOT_FOUND' as const }
        if (bus.estadoOperativo === 'INACTIVO') {
          return { programacion: null, status: 'BUS_INACTIVE' as const }
        }
        if (requestedPlan.modeloBusId && requestedPlan.modeloBusId !== bus.modeloBusId) {
          return { programacion: null, status: 'PLAN_BUS_MISMATCH' as const }
        }

        await this.lockPreventiveObligation(tx, busId, requestedPlan.claveTarea)
        const effectivePlan = await this.resolveEffectivePlan(tx, busId, requestedPlan.claveTarea)
        if (!effectivePlan) return { programacion: null, status: 'NO_EFFECTIVE_PLAN' as const }

        const existing = await tx.programacionMantenimiento.findFirst({
          where: {
            activa: true,
            busId,
            planMantenimientoPreventivo: { claveTarea: effectivePlan.claveTarea },
          },
          include: preventiveScheduleInclude,
        })
        if (existing) return { programacion: existing, status: 'EXISTING' as const }

        const targets = initialPreventiveTargets(effectivePlan, bus.kilometrajeActual)
        const programacion = await tx.programacionMantenimiento.create({
          data: {
            actividad: effectivePlan.actividad,
            busId,
            creadaPorId: actorId,
            criterio: effectivePlan.criterio,
            fechaProgramada: targets.fechaProgramada,
            kilometrajeObjetivo: targets.kilometrajeObjetivo,
            planMantenimientoPreventivoId: effectivePlan.id,
            prioridad: effectivePlan.prioridad,
            tipo: effectivePlan.componente,
          },
          include: preventiveScheduleInclude,
        })
        return { programacion, status: 'CREATED' as const }
      },
      { maxWait: 15000, timeout: 60000 },
    )
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

        if (!schedule.activa) {
          return { orden: null, programacion: schedule, status: 'INACTIVE' as const }
        }

        const taskKey = schedule.planMantenimientoPreventivo?.claveTarea ?? schedule.id
        await this.lockPreventiveObligation(tx, schedule.busId, taskKey)
        const lockedSchedule = await this.findScheduleByIdForTransaction(programacionId, tx)
        if (!lockedSchedule) {
          return { orden: null, programacion: null, status: 'NOT_FOUND' as const }
        }

        const existingOrder = lockedSchedule.ordenesTrabajo[0]

        if (existingOrder) {
          return {
            orden: existingOrder,
            programacion: lockedSchedule,
            status: 'ALREADY_GENERATED' as const,
          }
        }

        const classification = classifyPreventiveCycle({
          fechaProgramada: lockedSchedule.fechaProgramada,
          kilometrajeActual: lockedSchedule.bus.kilometrajeActual,
          kilometrajeObjetivo: lockedSchedule.kilometrajeObjetivo,
          planMantenimientoPreventivo: lockedSchedule.planMantenimientoPreventivo,
        })
        if (classification.estado === 'VIGENTE') {
          return { orden: null, programacion: lockedSchedule, status: 'NOT_ELIGIBLE' as const }
        }

        const planAplicado = lockedSchedule.planMantenimientoPreventivo
          ? buildPreventivePlanSnapshot({
              busId: lockedSchedule.busId,
              createdAt: lockedSchedule.createdAt,
              fechaProgramada: lockedSchedule.fechaProgramada,
              id: lockedSchedule.id,
              kilometrajeObjetivo: lockedSchedule.kilometrajeObjetivo,
              planMantenimientoPreventivo: lockedSchedule.planMantenimientoPreventivo,
            })
          : undefined

        const order = await tx.ordenTrabajo.create({
          data: {
            busId: lockedSchedule.busId,
            codigo: this.createPreventiveOrderCode(),
            creadaPorId: actorId,
            descripcion: data.descripcionOrden,
            estado: 'PENDIENTE_ASIGNACION',
            fechaObjetivoPreventivo: lockedSchedule.fechaProgramada,
            kilometrajeObjetivoPreventivo: lockedSchedule.kilometrajeObjetivo,
            origen: 'PREVENTIVO',
            ...(planAplicado ? { planAplicado } : {}),
            prioridad: lockedSchedule.planMantenimientoPreventivo?.prioridad ?? data.prioridad,
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

  private lockPreventiveObligation(
    tx: Prisma.TransactionClient,
    busId: string,
    claveTarea: string,
  ) {
    return tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:obligacion:${busId}:${claveTarea}`}, 0))`,
    )
  }

  private async resolveEffectivePlan(
    tx: Prisma.TransactionClient,
    busId: string,
    claveTarea: string,
  ) {
    const bus = await tx.bus.findUnique({
      where: { id: busId },
      select: { modeloBusId: true },
    })
    if (!bus) return null
    const byBus = await tx.planMantenimientoPreventivo.findFirst({
      where: { activo: true, busId, claveTarea },
      orderBy: { version: 'desc' },
    })
    if (byBus) return byBus
    if (!bus.modeloBusId) return null
    return tx.planMantenimientoPreventivo.findFirst({
      where: { activo: true, claveTarea, modeloBusId: bus.modeloBusId },
      orderBy: { version: 'desc' },
    })
  }
}
