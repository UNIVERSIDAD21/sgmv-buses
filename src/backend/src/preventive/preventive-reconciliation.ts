import { Prisma } from '@prisma/client'

import { evaluatePreventiveAlertsForBus } from '../alerts/alert.service.js'
import { initialPreventiveTargets } from './preventive-cycle.js'

interface ReconcileInput {
  actorId: string
  busId: string
  claveTarea: string
  materializeIfMissing?: boolean
}

async function lockObligation(tx: Prisma.TransactionClient, busId: string, claveTarea: string) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:obligacion:${busId}:${claveTarea}`}, 0))`,
  )
}

async function resolveEffectivePlan(
  tx: Prisma.TransactionClient,
  busId: string,
  claveTarea: string,
) {
  const bus = await tx.bus.findUnique({ where: { id: busId }, select: { modeloBusId: true } })
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

export async function reconcilePreventiveObligationForTask(
  tx: Prisma.TransactionClient,
  input: ReconcileInput,
) {
  await lockObligation(tx, input.busId, input.claveTarea)

  const bus = await tx.bus.findUnique({ where: { id: input.busId } })
  if (!bus) return { status: 'BUS_NOT_FOUND' as const }

  const effectivePlan = await resolveEffectivePlan(tx, input.busId, input.claveTarea)
  const existing = await tx.programacionMantenimiento.findFirst({
    where: {
      activa: true,
      busId: input.busId,
      planMantenimientoPreventivo: { claveTarea: input.claveTarea },
    },
    include: {
      ordenesTrabajo: {
        where: { estado: { not: 'CERRADA' }, origen: 'PREVENTIVO', tipo: 'PREVENTIVA' },
        select: { id: true },
        take: 1,
      },
    },
  })
  if (!existing && (!effectivePlan || !input.materializeIfMissing)) {
    return { status: 'NO_EXISTING_OBLIGATION' as const }
  }

  if (!existing && effectivePlan) {
    const targets = initialPreventiveTargets(effectivePlan, bus.kilometrajeActual)
    const created = await tx.programacionMantenimiento.create({
      data: {
        actividad: effectivePlan.actividad,
        busId: input.busId,
        creadaPorId: input.actorId,
        criterio: effectivePlan.criterio,
        fechaProgramada: targets.fechaProgramada,
        kilometrajeObjetivo: targets.kilometrajeObjetivo,
        planMantenimientoPreventivoId: effectivePlan.id,
        prioridad: effectivePlan.prioridad,
        tipo: effectivePlan.componente,
      },
    })
    await evaluatePreventiveAlertsForBus(input.busId, tx)
    return { programacionId: created.id, status: 'CREATED' as const }
  }

  if (!existing) return { status: 'NO_EXISTING_OBLIGATION' as const }
  if (existing.planMantenimientoPreventivoId === effectivePlan?.id) {
    return { programacionId: existing.id, status: 'UNCHANGED' as const }
  }
  if (existing.ordenesTrabajo.length > 0) {
    return { programacionId: existing.id, status: 'DEFERRED_UNTIL_CLOSE' as const }
  }

  await tx.programacionMantenimiento.update({
    where: { id: existing.id },
    data: { activa: false },
  })

  if (!effectivePlan) {
    return { programacionId: null, status: 'DEACTIVATED' as const }
  }

  const targets = initialPreventiveTargets(effectivePlan, bus.kilometrajeActual)
  const replacement = await tx.programacionMantenimiento.create({
    data: {
      actividad: effectivePlan.actividad,
      busId: input.busId,
      creadaPorId: input.actorId,
      criterio: effectivePlan.criterio,
      fechaProgramada: targets.fechaProgramada,
      kilometrajeObjetivo: targets.kilometrajeObjetivo,
      planMantenimientoPreventivoId: effectivePlan.id,
      prioridad: effectivePlan.prioridad,
      tipo: effectivePlan.componente,
    },
  })
  await evaluatePreventiveAlertsForBus(input.busId, tx)

  return { programacionId: replacement.id, status: 'REPLACED' as const }
}

export async function reconcilePreventiveObligationsForBus(
  tx: Prisma.TransactionClient,
  input: Pick<ReconcileInput, 'actorId' | 'busId'> & { previousModeloBusId: string | null },
) {
  const bus = await tx.bus.findUnique({ where: { id: input.busId }, select: { modeloBusId: true } })
  const schedules = await tx.programacionMantenimiento.findMany({
    where: {
      activa: true,
      busId: input.busId,
      planMantenimientoPreventivoId: { not: null },
    },
    select: { planMantenimientoPreventivo: { select: { claveTarea: true } } },
  })
  const modelIds = [input.previousModeloBusId, bus?.modeloBusId].filter(
    (modeloBusId): modeloBusId is string => Boolean(modeloBusId),
  )
  const modelPlans = await tx.planMantenimientoPreventivo.findMany({
    where: { activo: true, modeloBusId: { in: modelIds } },
    select: { claveTarea: true },
  })
  const keys = [
    ...new Set([
      ...schedules.flatMap((schedule) =>
        schedule.planMantenimientoPreventivo
          ? [schedule.planMantenimientoPreventivo.claveTarea]
          : [],
      ),
      ...modelPlans.map((plan) => plan.claveTarea),
    ]),
  ].sort()

  for (const claveTarea of keys) {
    await reconcilePreventiveObligationForTask(tx, {
      actorId: input.actorId,
      busId: input.busId,
      claveTarea,
      materializeIfMissing: true,
    })
  }
}
