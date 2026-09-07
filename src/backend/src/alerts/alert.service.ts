import { randomUUID } from 'node:crypto'

import {
  Prisma,
  type CriticidadNovedad,
  type PrioridadAlerta,
  type TipoAlerta,
} from '@prisma/client'

import { classifyPreventiveCycle } from '../preventive/preventive-cycle.js'

interface NoveltyAlertInput {
  afectaOperacion: boolean
  bloqueaDisponibilidad: boolean
  busCodigo: string
  busId: string
  conductorId: string
  criticidad: CriticidadNovedad
  eventAt: Date
  jornadaId: string
  novedadId: string
}

async function recipientIdsByRoles(
  roles: Array<'ADMINISTRADOR' | 'DESPACHADOR'>,
  tx: Prisma.TransactionClient,
) {
  const users = await tx.usuario.findMany({
    where: { estado: 'ACTIVO', rol: { codigo: { in: roles } } },
    select: { id: true },
  })
  return users.map((user) => user.id)
}

async function createAlert(
  input: {
    busId?: string
    context: Prisma.InputJsonObject
    deduplicationKey?: string
    message: string
    noveltyId?: string
    orderId?: string
    priority: PrioridadAlerta
    preventiveScheduleId?: string
    sparePartId?: string
    recipients: string[]
    title: string
    type: TipoAlerta
  },
  tx: Prisma.TransactionClient,
) {
  const recipients = [...new Set(input.recipients)]
  if (recipients.length === 0) return

  const key = input.noveltyId
    ? `${input.type.toLowerCase()}:novedad:${input.noveltyId}:${input.noveltyId}`
    : input.deduplicationKey
  if (!key) {
    throw new Error('La alerta requiere una clave de deduplicacion')
  }
  const existing = await tx.alertaInterna.findUnique({
    where: { claveDeduplicacion: key },
    select: { id: true },
  })

  if (existing) {
    await tx.alertaDestinatario.createMany({
      data: recipients.map((usuarioId) => ({
        alertaInternaId: existing.id,
        estado: 'NO_LEIDA',
        usuarioId,
      })),
      skipDuplicates: true,
    })
    return
  }

  await tx.alertaInterna.create({
    data: {
      claveDeduplicacion: key,
      contextoEvento: input.context,
      destinatarios: {
        create: recipients.map((usuarioId) => ({ estado: 'NO_LEIDA', usuarioId })),
      },
      id: randomUUID(),
      mensaje: input.message,
      ...(input.noveltyId ? { novedadId: input.noveltyId } : {}),
      ...(input.orderId ? { ordenTrabajoId: input.orderId } : {}),
      ...(input.preventiveScheduleId
        ? { programacionMantenimientoId: input.preventiveScheduleId }
        : {}),
      ...(input.sparePartId ? { repuestoId: input.sparePartId } : {}),
      ...(input.busId ? { busId: input.busId } : {}),
      prioridad: input.priority,
      tipo: input.type,
      titulo: input.title,
    },
  })
}

export async function createConsumptionIncompatibilityAlert(
  input: {
    busId: string
    busCodigo: string
    claveIdempotencia: string
    contexto: Prisma.InputJsonObject
    ordenId: string
    repuestoCodigo: string
    repuestoId: string
  },
  tx: Prisma.TransactionClient,
) {
  const recipients = await recipientIdsByRoles(['ADMINISTRADOR', 'DESPACHADOR'], tx)
  await createAlert(
    {
      context: input.contexto,
      deduplicationKey: `consumo-incompatible:${input.claveIdempotencia}`,
      message: `El repuesto ${input.repuestoCodigo} no esta autorizado para el bus ${input.busCodigo}.`,
      orderId: input.ordenId,
      priority: 'ALTA',
      recipients,
      title: 'Consumo incompatible rechazado',
      type: 'CONSUMO_INCOMPATIBLE',
    },
    tx,
  )
}

export async function createNoveltyAlerts(input: NoveltyAlertInput, tx: Prisma.TransactionClient) {
  const dispatchers = await recipientIdsByRoles(['DESPACHADOR'], tx)
  const context: Prisma.InputJsonObject = {
    busCodigo: input.busCodigo,
    busId: input.busId,
    criticidad: input.criticidad,
    enlaceInterno: '/novedades',
    eventAt: input.eventAt.toISOString(),
    jornadaId: input.jornadaId,
    novedadId: input.novedadId,
    schemaVersion: 1,
  }

  if (input.criticidad === 'CRITICA') {
    const administrators = await recipientIdsByRoles(['ADMINISTRADOR'], tx)
    await createAlert(
      {
        context,
        message: `La novedad critica del bus ${input.busCodigo} requiere revision prioritaria.`,
        noveltyId: input.novedadId,
        priority: 'CRITICA',
        recipients: [...administrators, ...dispatchers],
        title: 'Novedad critica reportada',
        type: 'NOVEDAD_CRITICA',
      },
      tx,
    )
  }

  if (input.afectaOperacion && input.bloqueaDisponibilidad) {
    await createAlert(
      {
        context,
        message: `El bus ${input.busCodigo} no esta disponible por una novedad operativa.`,
        noveltyId: input.novedadId,
        priority: 'ALTA',
        recipients: [...dispatchers, input.conductorId],
        title: 'Bus bloqueado por novedad',
        type: 'BUS_BLOQUEADO',
      },
      tx,
    )
  }
}

interface PreventiveAlertSchedule {
  bus: { codigoInterno: string; id: string; kilometrajeActual: number }
  fechaProgramada: Date | null
  id: string
  kilometrajeObjetivo: number | null
  planMantenimientoPreventivo: {
    anticipacionDias: number | null
    anticipacionKm: number | null
    bloqueaAlVencer: boolean
    version: number
  }
}

function preventiveAlertKey(
  type: 'MANTENIMIENTO_PROXIMO' | 'MANTENIMIENTO_VENCIDO',
  schedule: PreventiveAlertSchedule,
) {
  const date = schedule.fechaProgramada?.toISOString().slice(0, 10) ?? 'none'
  const mileage = schedule.kilometrajeObjetivo ?? 'none'
  return `${type.toLowerCase()}:programacion:${schedule.id}:v${schedule.planMantenimientoPreventivo.version}:${date}:${mileage}`
}

async function createPreventiveAlert(
  schedule: PreventiveAlertSchedule,
  evaluatedAt: Date,
  tx: Prisma.TransactionClient,
) {
  const classification = classifyPreventiveCycle(
    {
      fechaProgramada: schedule.fechaProgramada,
      kilometrajeActual: schedule.bus.kilometrajeActual,
      kilometrajeObjetivo: schedule.kilometrajeObjetivo,
      planMantenimientoPreventivo: schedule.planMantenimientoPreventivo,
    },
    evaluatedAt,
  )
  if (classification.estado === 'VIGENTE') return

  const type =
    classification.estado === 'PROXIMO' ? 'MANTENIMIENTO_PROXIMO' : 'MANTENIMIENTO_VENCIDO'
  const administrators = await recipientIdsByRoles(['ADMINISTRADOR'], tx)
  const dispatchers =
    type === 'MANTENIMIENTO_VENCIDO' && schedule.planMantenimientoPreventivo.bloqueaAlVencer
      ? await recipientIdsByRoles(['DESPACHADOR'], tx)
      : []
  const context: Prisma.InputJsonObject = {
    bus: { codigoInterno: schedule.bus.codigoInterno, id: schedule.bus.id },
    enlaceInterno: '/mantenimiento-preventivo/restricciones',
    estado: classification.estado,
    eventAt: evaluatedAt.toISOString(),
    objetivos: {
      fecha: schedule.fechaProgramada?.toISOString().slice(0, 10) ?? null,
      kilometraje: schedule.kilometrajeObjetivo,
    },
    programacionId: schedule.id,
    restantes: {
      dias: classification.diasRestantes,
      kilometros: classification.kilometrosRestantes,
    },
    schemaVersion: 1,
  }
  await createAlert(
    {
      context,
      deduplicationKey: preventiveAlertKey(type, schedule),
      message:
        type === 'MANTENIMIENTO_PROXIMO'
          ? `El bus ${schedule.bus.codigoInterno} tiene mantenimiento preventivo proximo.`
          : `El bus ${schedule.bus.codigoInterno} tiene mantenimiento preventivo vencido.`,
      priority: type === 'MANTENIMIENTO_PROXIMO' ? 'MEDIA' : 'ALTA',
      preventiveScheduleId: schedule.id,
      recipients: [...administrators, ...dispatchers],
      title:
        type === 'MANTENIMIENTO_PROXIMO'
          ? 'Mantenimiento preventivo proximo'
          : 'Mantenimiento preventivo vencido',
      type,
    },
    tx,
  )
}

export async function evaluatePreventiveAlertsForBus(
  busId: string,
  tx: Prisma.TransactionClient,
  evaluatedAt = new Date(),
) {
  const schedules = await tx.programacionMantenimiento.findMany({
    where: {
      activa: true,
      busId,
      planMantenimientoPreventivoId: { not: null },
    },
    include: {
      bus: { select: { codigoInterno: true, id: true, kilometrajeActual: true } },
      planMantenimientoPreventivo: {
        select: {
          anticipacionDias: true,
          anticipacionKm: true,
          bloqueaAlVencer: true,
          version: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  })
  for (const schedule of schedules) {
    if (!schedule.planMantenimientoPreventivo) continue
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:alerta-preventiva:${schedule.id}`}, 0))`,
    )
    await createPreventiveAlert(
      { ...schedule, planMantenimientoPreventivo: schedule.planMantenimientoPreventivo },
      evaluatedAt,
      tx,
    )
  }
}
