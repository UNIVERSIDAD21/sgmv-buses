import { Prisma, type CriterioMantenimiento, type PrioridadOrden } from '@prisma/client'

import { prisma } from '../prisma/client.js'
import { reconcilePreventiveObligationForTask } from './preventive-reconciliation.js'

type PlanDbClient = Prisma.TransactionClient | typeof prisma

const userSelect = { email: true, id: true, nombre: true } as const

export const preventivePlanInclude = {
  creadoPor: { select: userSelect },
  _count: {
    select: { programacionesMantenimiento: { where: { activa: true } } },
  },
} as const

export type PreventivePlanRecord = Prisma.PlanMantenimientoPreventivoGetPayload<{
  include: typeof preventivePlanInclude
}>

export interface PlanData {
  actividad: string
  anticipacionDias: number | null
  anticipacionKm: number | null
  bloqueaAlVencer: boolean
  busId: number | null
  claveTarea: string
  componente: string
  criterio: CriterioMantenimiento
  intervaloDias: number | null
  intervaloKm: number | null
  modeloBusId: number | null
  prioridad: PrioridadOrden
}

export class PreventivePlanRepository {
  async createFirstVersion(data: PlanData, actorId: number) {
    return prisma.$transaction(async (tx) => {
      await this.lockIdentity(tx, data)
      const plan = await tx.planMantenimientoPreventivo.create({
        data: { ...data, activo: true, creadoPorId: actorId, version: 1 },
        include: preventivePlanInclude,
      })
      if (data.busId) {
        await reconcilePreventiveObligationForTask(tx, {
          actorId,
          busId: data.busId,
          claveTarea: data.claveTarea,
          materializeIfMissing: true,
        })
      }
      return (await tx.planMantenimientoPreventivo.findUnique({
        where: { id: plan.id },
        include: preventivePlanInclude,
      }))!
    })
  }

  findById(id: number, client: PlanDbClient = prisma) {
    return client.planMantenimientoPreventivo.findUnique({
      where: { id },
      include: preventivePlanInclude,
    })
  }

  findBusForResolution(busId: number) {
    return prisma.bus.findUnique({ where: { id: busId }, select: { id: true, modeloBusId: true } })
  }

  findModeloBusById(modeloBusId: number) {
    return prisma.modeloBus.findUnique({ where: { id: modeloBusId }, select: { id: true } })
  }

  list(where: Prisma.PlanMantenimientoPreventivoWhereInput) {
    return prisma.planMantenimientoPreventivo.findMany({
      where,
      include: preventivePlanInclude,
      orderBy: [{ claveTarea: 'asc' }, { version: 'desc' }],
    })
  }

  async createSuccessor(
    planId: number,
    data: Omit<PlanData, 'busId' | 'claveTarea' | 'modeloBusId'>,
    actorId: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const current = await this.findById(planId, tx)
      if (!current) return null
      await this.lockIdentity(tx, current)
      const versions = await tx.planMantenimientoPreventivo.findMany({
        where: {
          busId: current.busId,
          claveTarea: current.claveTarea,
          modeloBusId: current.modeloBusId,
        },
        select: { activo: true, id: true, version: true },
        orderBy: { version: 'desc' },
      })
      const activeOther = versions.find((item) => item.activo && item.id !== current.id)
      if (activeOther) return { conflict: true as const, plan: null }
      if (current.activo) {
        await tx.planMantenimientoPreventivo.update({
          where: { id: current.id },
          data: { activo: false },
        })
      }
      const version = (versions[0]?.version ?? 0) + 1
      const plan = await tx.planMantenimientoPreventivo.create({
        data: {
          ...data,
          activo: true,
          busId: current.busId,
          claveTarea: current.claveTarea,
          creadoPorId: actorId,
          modeloBusId: current.modeloBusId,
          version,
        },
        include: preventivePlanInclude,
      })
      const affectedSchedules = await tx.programacionMantenimiento.findMany({
        where: {
          activa: true,
          planMantenimientoPreventivo: { claveTarea: current.claveTarea },
        },
        select: { busId: true },
      })
      for (const busId of [
        ...new Set(affectedSchedules.map((schedule) => schedule.busId)),
      ].sort()) {
        await reconcilePreventiveObligationForTask(tx, {
          actorId,
          busId,
          claveTarea: current.claveTarea,
        })
      }
      return { conflict: false as const, plan }
    })
  }

  async deactivate(id: number, actorId: number) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.planMantenimientoPreventivo.findUniqueOrThrow({
        where: { id },
        include: preventivePlanInclude,
      })
      await this.lockIdentity(tx, current)
      const affectedSchedules = await tx.programacionMantenimiento.findMany({
        where: { activa: true, planMantenimientoPreventivoId: id },
        select: { busId: true },
      })
      await tx.planMantenimientoPreventivo.update({
        where: { id },
        data: { activo: false },
      })
      for (const busId of [
        ...new Set(affectedSchedules.map((schedule) => schedule.busId)),
      ].sort()) {
        await reconcilePreventiveObligationForTask(tx, {
          actorId,
          busId,
          claveTarea: current.claveTarea,
        })
      }
      return tx.planMantenimientoPreventivo.findUniqueOrThrow({
        where: { id },
        include: preventivePlanInclude,
      })
    })
  }

  async resolveEffective(
    busId: number,
    claveTarea: string,
  ): Promise<{ origenPlan: 'BUS' | 'MODELO'; plan: PreventivePlanRecord } | null> {
    const bus = await this.findBusForResolution(busId)
    if (!bus) return null
    const byBus = await prisma.planMantenimientoPreventivo.findFirst({
      where: { activo: true, busId, claveTarea },
      include: preventivePlanInclude,
    })
    if (byBus) return { origenPlan: 'BUS', plan: byBus }
    if (!bus.modeloBusId) return null
    const byModel = await prisma.planMantenimientoPreventivo.findFirst({
      where: { activo: true, claveTarea, modeloBusId: bus.modeloBusId },
      include: preventivePlanInclude,
    })
    return byModel ? { origenPlan: 'MODELO', plan: byModel } : null
  }

  private lockIdentity(
    tx: Prisma.TransactionClient,
    data: Pick<PlanData, 'busId' | 'claveTarea' | 'modeloBusId'>,
  ) {
    const destination = data.busId ? `bus:${data.busId}` : `modelo:${data.modeloBusId}`
    return tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:plan:${destination}:${data.claveTarea}`}, 0))`,
    )
  }
}
