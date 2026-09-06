import { Prisma, type CriterioMantenimiento, type PrioridadOrden } from '@prisma/client'

import { classifyPreventiveSchedule } from './preventive.classification.js'

export const preventiveTimeZone = 'America/Bogota'
export const fallbackPreventiveThresholds = { days: 7, kilometers: 500 } as const

export interface PreventivePlanCycleData {
  actividad: string
  anticipacionDias: number | null
  anticipacionKm: number | null
  bloqueaAlVencer: boolean
  busId: string | null
  claveTarea: string
  componente: string
  criterio: CriterioMantenimiento
  id: string
  intervaloDias: number | null
  intervaloKm: number | null
  modeloBusId: string | null
  prioridad: PrioridadOrden
  version: number
}

export interface PreventiveCycleTargets {
  fechaProgramada: Date | null
  kilometrajeObjetivo: number | null
}

interface PreventiveScheduleCycleData extends PreventiveCycleTargets {
  busId: string
  createdAt: Date
  id: string
  planMantenimientoPreventivo: PreventivePlanCycleData
}

function dateAtTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
}

export function addCalendarDays(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export function effectivePreventiveThresholds(plan?: {
  anticipacionDias: number | null
  anticipacionKm: number | null
}) {
  return {
    soonDays: plan?.anticipacionDias ?? fallbackPreventiveThresholds.days,
    soonKm: plan?.anticipacionKm ?? fallbackPreventiveThresholds.kilometers,
    timeZone: preventiveTimeZone,
  }
}

export function classifyPreventiveCycle(
  schedule: PreventiveCycleTargets & {
    kilometrajeActual: number
    planMantenimientoPreventivo?: {
      anticipacionDias: number | null
      anticipacionKm: number | null
    } | null
  },
  now = new Date(),
) {
  return classifyPreventiveSchedule({
    fechaProgramada: schedule.fechaProgramada,
    kilometrajeActual: schedule.kilometrajeActual,
    kilometrajeObjetivo: schedule.kilometrajeObjetivo,
    now,
    thresholds: effectivePreventiveThresholds(schedule.planMantenimientoPreventivo ?? undefined),
  })
}

export function initialPreventiveTargets(
  plan: PreventivePlanCycleData,
  currentMileage: number,
  now = new Date(),
): PreventiveCycleTargets {
  const baseDate = dateAtTimeZone(now, preventiveTimeZone)
  return {
    fechaProgramada:
      plan.intervaloDias === null ? null : addCalendarDays(baseDate, plan.intervaloDias),
    kilometrajeObjetivo: plan.intervaloKm === null ? null : currentMileage + plan.intervaloKm,
  }
}

export function nextPreventiveTargets(
  plan: PreventivePlanCycleData,
  completed: PreventiveCycleTargets,
): PreventiveCycleTargets {
  if (plan.intervaloDias !== null && completed.fechaProgramada === null) {
    throw new Error('La obligación completada no conserva su objetivo de fecha')
  }
  if (plan.intervaloKm !== null && completed.kilometrajeObjetivo === null) {
    throw new Error('La obligación completada no conserva su objetivo de kilometraje')
  }
  return {
    fechaProgramada:
      plan.intervaloDias === null
        ? null
        : addCalendarDays(completed.fechaProgramada!, plan.intervaloDias),
    kilometrajeObjetivo:
      plan.intervaloKm === null ? null : completed.kilometrajeObjetivo! + plan.intervaloKm,
  }
}

export function buildPreventivePlanSnapshot(
  schedule: PreventiveScheduleCycleData,
): Prisma.InputJsonObject {
  const plan = schedule.planMantenimientoPreventivo
  const thresholds = effectivePreventiveThresholds(plan)
  return {
    actividad: plan.actividad,
    anticipacionDiasEfectiva: thresholds.soonDays,
    anticipacionKmEfectiva: thresholds.soonKm,
    bloqueaAlVencer: plan.bloqueaAlVencer,
    busId: schedule.busId,
    claveTarea: plan.claveTarea,
    componente: plan.componente,
    criterio: plan.criterio,
    destinoAplicado: plan.busId
      ? { busId: plan.busId, tipo: 'BUS' }
      : { modeloBusId: plan.modeloBusId!, tipo: 'MODELO' },
    fechaObjetivo: schedule.fechaProgramada?.toISOString().slice(0, 10) ?? null,
    intervaloDias: plan.intervaloDias,
    intervaloKm: plan.intervaloKm,
    kilometrajeObjetivo: schedule.kilometrajeObjetivo,
    materializadoAt: schedule.createdAt.toISOString(),
    origenPlan: plan.busId ? 'BUS' : 'MODELO',
    planId: plan.id,
    planVersion: plan.version,
    prioridad: plan.prioridad,
    programacionId: schedule.id,
    schemaVersion: 1,
  }
}

export function hasValidPreventivePlanSnapshot(
  snapshot: Prisma.JsonValue | null,
  expected: {
    fechaObjetivo: Date | null
    kilometrajeObjetivo: number | null
    plan: PreventivePlanCycleData
    programacionId: string
  },
) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false
  const value = snapshot as Record<string, Prisma.JsonValue>
  return (
    value.schemaVersion === 1 &&
    value.planId === expected.plan.id &&
    value.planVersion === expected.plan.version &&
    value.claveTarea === expected.plan.claveTarea &&
    value.programacionId === expected.programacionId &&
    value.fechaObjetivo === (expected.fechaObjetivo?.toISOString().slice(0, 10) ?? null) &&
    value.kilometrajeObjetivo === expected.kilometrajeObjetivo
  )
}
