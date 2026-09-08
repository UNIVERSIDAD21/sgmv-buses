import { Prisma, type CriticidadNovedad, type TipoAlerta } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { classifyPreventiveCycle } from '../preventive/preventive-cycle.js'
import { prisma } from '../prisma/client.js'
import { AppError } from '../shared/http.js'
import { alertCatalogEntry, type AlertRecipientRole } from './alert.catalog.js'
import {
  AlertRepository,
  createAlertRecord,
  findActiveAllowedRecipients,
  type AlertCreationInput,
  type AlertRecipientRecord,
} from './alert.repository.js'
import type { ListAlertsQuery } from './alert.schemas.js'

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

export type AlertOrigin = {
  busId?: string
  jornadaId?: string
  novedadId?: string
  ordenId?: string
  programacionMantenimientoId?: string
  repuestoId?: string
}

/** Inputs are for trusted domain services only; HTTP routes never accept recipient IDs. */
export type AlertRecipientResolution =
  { kind: 'ROLES'; roles: AlertRecipientRole[] } | { kind: 'USERS'; userIds: string[] }

export interface MaterializeAlertInput {
  contextoEvento: Prisma.InputJsonObject
  claveDeduplicacion: string
  destinatarios: AlertRecipientResolution
  mensaje: string
  origen: AlertOrigin
  prioridad?: AlertCreationInput['priority']
  tipo: TipoAlerta
  titulo: string
}

function stringValue(value: unknown, maxLength = 180) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, maxLength)
    : undefined
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function booleanValue(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function sanitizedContext(
  type: TipoAlerta,
  rawContext: Prisma.InputJsonObject,
  origin: AlertOrigin,
): Prisma.InputJsonObject {
  const catalog = alertCatalogEntry(type)
  const originKinds = Object.entries(origin)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key)
  const safeOrigin: Prisma.InputJsonObject = {
    ...(origin.busId ? { busId: origin.busId } : {}),
    ...(origin.jornadaId ? { jornadaId: origin.jornadaId } : {}),
    ...(origin.novedadId ? { novedadId: origin.novedadId } : {}),
    ...(origin.ordenId ? { ordenTrabajoId: origin.ordenId } : {}),
    ...(origin.programacionMantenimientoId
      ? { programacionMantenimientoId: origin.programacionMantenimientoId }
      : {}),
    ...(origin.repuestoId ? { repuestoId: origin.repuestoId } : {}),
  }
  if (
    originKinds.length !== 1 ||
    originKinds[0] !== catalog.originKind ||
    Object.keys(safeOrigin).length !== 1
  ) {
    throw new Error(`La alerta ${type} requiere el origen ${catalog.originKind}`)
  }

  const bus = recordValue(rawContext.bus)
  const objetivos = recordValue(rawContext.objetivos)
  const restantes = recordValue(rawContext.restantes)
  const fechaEvento =
    stringValue(rawContext.eventAt, 40) ??
    stringValue(rawContext.evaluadoAt, 40) ??
    new Date().toISOString()
  const safeObjectives: Prisma.InputJsonObject = {
    ...(stringValue(objetivos?.fecha, 20) ? { fecha: stringValue(objetivos?.fecha, 20)! } : {}),
    ...(numberValue(objetivos?.kilometraje) !== undefined
      ? { kilometraje: numberValue(objetivos?.kilometraje)! }
      : {}),
  }
  const safeRemaining: Prisma.InputJsonObject = {
    ...(numberValue(restantes?.dias) !== undefined ? { dias: numberValue(restantes?.dias)! } : {}),
    ...(numberValue(restantes?.kilometros) !== undefined
      ? { kilometros: numberValue(restantes?.kilometros)! }
      : {}),
  }
  const busCodigo = stringValue(rawContext.busCodigo) ?? stringValue(bus?.codigoInterno)
  const compatibilityContext: Prisma.InputJsonObject =
    type === 'CONSUMO_INCOMPATIBLE'
      ? {
          ...(stringValue(rawContext.busId, 40)
            ? { busId: stringValue(rawContext.busId, 40)! }
            : {}),
          ...(stringValue(rawContext.destino, 20)
            ? { destino: stringValue(rawContext.destino, 20)! }
            : {}),
          ...(booleanValue(rawContext.permitido) !== undefined
            ? { permitido: booleanValue(rawContext.permitido)! }
            : {}),
          ...(stringValue(rawContext.precedencia, 40)
            ? { precedencia: stringValue(rawContext.precedencia, 40)! }
            : {}),
          ...(stringValue(rawContext.reglaId, 40)
            ? { reglaId: stringValue(rawContext.reglaId, 40)! }
            : {}),
          ...(numberValue(rawContext.reglaVersion) !== undefined
            ? { reglaVersion: numberValue(rawContext.reglaVersion)! }
            : {}),
          ...(stringValue(rawContext.repuestoId, 40)
            ? { repuestoId: stringValue(rawContext.repuestoId, 40)! }
            : {}),
        }
      : {}

  return {
    enlaceInterno: Object.values(catalog.internalRoutes)[0] ?? null,
    fechaEvento,
    origen: safeOrigin,
    ...(busCodigo ? { busCodigo } : {}),
    ...(stringValue(rawContext.criticidad)
      ? { criticidad: stringValue(rawContext.criticidad)! }
      : {}),
    ...(stringValue(rawContext.estado) ? { estado: stringValue(rawContext.estado)! } : {}),
    ...(Object.keys(safeObjectives).length > 0 ? { objetivos: safeObjectives } : {}),
    ...(Object.keys(safeRemaining).length > 0 ? { restantes: safeRemaining } : {}),
    ...compatibilityContext,
    schemaVersion: catalog.contextSchemaVersion,
  }
}

async function recipientIdsByRoles(roles: AlertRecipientRole[], tx: Prisma.TransactionClient) {
  const users = await tx.usuario.findMany({
    select: { id: true },
    where: { estado: 'ACTIVO', rol: { codigo: { in: roles } } },
  })
  return users.map((user) => user.id)
}

async function materializeInternal(input: MaterializeAlertInput, tx: Prisma.TransactionClient) {
  const catalog = alertCatalogEntry(input.tipo)
  const candidateIds =
    input.destinatarios.kind === 'ROLES'
      ? await recipientIdsByRoles(input.destinatarios.roles, tx)
      : input.destinatarios.userIds
  const recipients = await findActiveAllowedRecipients(
    candidateIds,
    catalog.allowedRecipientRoles,
    tx,
  )
  if (recipients.length === 0) return undefined

  return createAlertRecord(
    {
      busId: input.origen.busId,
      context: sanitizedContext(input.tipo, input.contextoEvento, input.origen),
      deduplicationKey: input.claveDeduplicacion,
      journeyId: input.origen.jornadaId,
      message: input.mensaje.trim().slice(0, 2000),
      noveltyId: input.origen.novedadId,
      orderId: input.origen.ordenId,
      priority: input.prioridad ?? catalog.defaultPriority,
      preventiveScheduleId: input.origen.programacionMantenimientoId,
      recipients,
      sparePartId: input.origen.repuestoId,
      title: input.titulo.trim().slice(0, 180),
      type: input.tipo,
    },
    tx,
  )
}

/**
 * Materializes an internal alert in the same transaction as its domain event.
 * Producers must derive `destinatarios` from their persisted domain context,
 * never from an HTTP payload.
 */
export async function materializeAlert(input: MaterializeAlertInput, tx: Prisma.TransactionClient) {
  return materializeInternal(input, tx)
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
    tecnicoAsignadoId: string
  },
  tx: Prisma.TransactionClient,
) {
  await materializeInternal(
    {
      contextoEvento: {
        ...input.contexto,
        busCodigo: input.busCodigo,
        busId: input.busId,
        repuestoId: input.repuestoId,
      },
      claveDeduplicacion: `consumo-incompatible:${input.claveIdempotencia}`,
      destinatarios: {
        kind: 'USERS',
        userIds: [...(await recipientIdsByRoles(['ADMINISTRADOR'], tx)), input.tecnicoAsignadoId],
      },
      mensaje: `El repuesto ${input.repuestoCodigo} no esta autorizado para el bus ${input.busCodigo}.`,
      origen: { ordenId: input.ordenId },
      prioridad: 'ALTA',
      tipo: 'CONSUMO_INCOMPATIBLE',
      titulo: 'Consumo incompatible rechazado',
    },
    tx,
  )
}

export async function createNoveltyAlerts(input: NoveltyAlertInput, tx: Prisma.TransactionClient) {
  const context: Prisma.InputJsonObject = {
    busCodigo: input.busCodigo,
    criticidad: input.criticidad,
    eventAt: input.eventAt.toISOString(),
  }
  const origin = { novedadId: input.novedadId }
  if (input.criticidad === 'CRITICA') {
    await materializeInternal(
      {
        contextoEvento: context,
        claveDeduplicacion: `novedad-critica:${input.novedadId}`,
        destinatarios: { kind: 'ROLES', roles: ['ADMINISTRADOR', 'DESPACHADOR'] },
        mensaje: `La novedad critica del bus ${input.busCodigo} requiere revision prioritaria.`,
        origen: origin,
        prioridad: 'CRITICA',
        tipo: 'NOVEDAD_CRITICA',
        titulo: 'Novedad crítica reportada',
      },
      tx,
    )
  }
  if (input.afectaOperacion && input.bloqueaDisponibilidad) {
    await materializeInternal(
      {
        contextoEvento: context,
        claveDeduplicacion: `bus-bloqueado:novedad:${input.novedadId}`,
        destinatarios: {
          kind: 'USERS',
          userIds: [...(await recipientIdsByRoles(['DESPACHADOR'], tx)), input.conductorId],
        },
        mensaje: `El bus ${input.busCodigo} no esta disponible por una novedad operativa.`,
        origen: origin,
        prioridad: 'ALTA',
        tipo: 'BUS_BLOQUEADO',
        titulo: 'Bus bloqueado por novedad',
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
  await materializeInternal(
    {
      contextoEvento: {
        bus: { codigoInterno: schedule.bus.codigoInterno },
        estado: classification.estado,
        eventAt: evaluatedAt.toISOString(),
        objetivos: {
          fecha: schedule.fechaProgramada?.toISOString().slice(0, 10) ?? null,
          kilometraje: schedule.kilometrajeObjetivo,
        },
        restantes: {
          dias: classification.diasRestantes,
          kilometros: classification.kilometrosRestantes,
        },
      },
      claveDeduplicacion: preventiveAlertKey(type, schedule),
      destinatarios: {
        kind: 'ROLES',
        roles:
          type === 'MANTENIMIENTO_VENCIDO' && schedule.planMantenimientoPreventivo.bloqueaAlVencer
            ? ['ADMINISTRADOR', 'DESPACHADOR']
            : ['ADMINISTRADOR'],
      },
      mensaje:
        type === 'MANTENIMIENTO_PROXIMO'
          ? `El bus ${schedule.bus.codigoInterno} tiene mantenimiento preventivo proximo.`
          : `El bus ${schedule.bus.codigoInterno} tiene mantenimiento preventivo vencido.`,
      origen: { programacionMantenimientoId: schedule.id },
      prioridad: type === 'MANTENIMIENTO_PROXIMO' ? 'MEDIA' : 'ALTA',
      tipo: type,
      titulo:
        type === 'MANTENIMIENTO_PROXIMO'
          ? 'Mantenimiento preventivo proximo'
          : 'Mantenimiento preventivo vencido',
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
    where: { activa: true, busId, planMantenimientoPreventivoId: { not: null } },
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
    if (schedule.planMantenimientoPreventivo) {
      await createPreventiveAlert(
        { ...schedule, planMantenimientoPreventivo: schedule.planMantenimientoPreventivo },
        evaluatedAt,
        tx,
      )
    }
  }
}

export async function createWorkOrderPendingAlert(
  input: { busCodigo: string; eventAt: Date; orderCode: string; orderId: string },
  tx: Prisma.TransactionClient,
) {
  return materializeInternal(
    {
      claveDeduplicacion: `orden-pendiente-asignacion:orden:${input.orderId}:creacion`,
      contextoEvento: {
        busCodigo: input.busCodigo,
        estado: 'PENDIENTE_ASIGNACION',
        eventAt: input.eventAt.toISOString(),
      },
      destinatarios: { kind: 'ROLES', roles: ['ADMINISTRADOR'] },
      mensaje: `La orden ${input.orderCode} requiere asignacion de mecanico.`,
      origen: { ordenId: input.orderId },
      tipo: 'ORDEN_PENDIENTE_ASIGNACION',
      titulo: 'Orden pendiente de asignacion',
    },
    tx,
  )
}

export async function createWorkOrderAssignedAlert(
  input: {
    busCodigo: string
    eventAt: Date
    mechanicId: string
    occurrenceId: string
    orderCode: string
    orderId: string
  },
  tx: Prisma.TransactionClient,
) {
  return materializeInternal(
    {
      claveDeduplicacion: `orden-asignada:orden:${input.orderId}:${input.occurrenceId}`,
      contextoEvento: {
        busCodigo: input.busCodigo,
        estado: 'ASIGNADA',
        eventAt: input.eventAt.toISOString(),
      },
      destinatarios: { kind: 'USERS', userIds: [input.mechanicId] },
      mensaje: `La orden ${input.orderCode} fue asignada para atencion tecnica.`,
      origen: { ordenId: input.orderId },
      tipo: 'ORDEN_ASIGNADA',
      titulo: 'Orden de trabajo asignada',
    },
    tx,
  )
}

export async function createWorkOrderCompletedAlert(
  input: {
    busCodigo: string
    eventAt: Date
    occurrenceId: string
    orderCode: string
    orderId: string
  },
  tx: Prisma.TransactionClient,
) {
  return materializeInternal(
    {
      claveDeduplicacion: `orden-completada-tecnico:orden:${input.orderId}:${input.occurrenceId}`,
      contextoEvento: {
        busCodigo: input.busCodigo,
        estado: 'COMPLETADA_TECNICO',
        eventAt: input.eventAt.toISOString(),
      },
      destinatarios: { kind: 'ROLES', roles: ['ADMINISTRADOR'] },
      mensaje: `La orden ${input.orderCode} fue completada por el tecnico y requiere validacion.`,
      origen: { ordenId: input.orderId },
      tipo: 'ORDEN_COMPLETADA_TECNICO',
      titulo: 'Orden completada por tecnico',
    },
    tx,
  )
}

export async function createWorkOrderReturnedAlert(
  input: {
    busCodigo: string
    eventAt: Date
    mechanicId: string
    occurrenceId: string
    orderCode: string
    orderId: string
  },
  tx: Prisma.TransactionClient,
) {
  return materializeInternal(
    {
      claveDeduplicacion: `orden-devuelta:orden:${input.orderId}:${input.occurrenceId}`,
      contextoEvento: {
        busCodigo: input.busCodigo,
        estado: 'DEVUELTA_CORRECCION',
        eventAt: input.eventAt.toISOString(),
      },
      destinatarios: { kind: 'USERS', userIds: [input.mechanicId] },
      mensaje: `La orden ${input.orderCode} fue devuelta para correccion.`,
      origen: { ordenId: input.orderId },
      tipo: 'ORDEN_DEVUELTA',
      titulo: 'Orden devuelta a correccion',
    },
    tx,
  )
}

export async function createLowInventoryAlert(
  input: {
    eventAt: Date
    movementId: string
    partCode: string
    partId: string
    stockActual: number
  },
  tx: Prisma.TransactionClient,
) {
  return materializeInternal(
    {
      claveDeduplicacion: `bajo-inventario:repuesto:${input.partId}:${input.movementId}`,
      contextoEvento: { estado: 'BAJO_INVENTARIO', eventAt: input.eventAt.toISOString() },
      destinatarios: { kind: 'ROLES', roles: ['ADMINISTRADOR'] },
      mensaje: `El repuesto ${input.partCode} alcanzo nivel bajo de inventario (${input.stockActual}).`,
      origen: { repuestoId: input.partId },
      tipo: 'BAJO_INVENTARIO',
      titulo: 'Nivel bajo de inventario',
    },
    tx,
  )
}

export async function createJourneyChangeAlert(
  input: {
    affectedDriverIds: string[]
    eventAt: Date
    journeyId: string
    occurrence: 'ALTA' | 'CANCELACION' | 'REASIGNACION'
  },
  tx: Prisma.TransactionClient,
) {
  return materializeInternal(
    {
      claveDeduplicacion: `cambio-jornada:jornada:${input.journeyId}:${input.occurrence.toLowerCase()}`,
      contextoEvento: { estado: input.occurrence, eventAt: input.eventAt.toISOString() },
      destinatarios: {
        kind: 'USERS',
        userIds: [...(await recipientIdsByRoles(['DESPACHADOR'], tx)), ...input.affectedDriverIds],
      },
      mensaje: 'La programacion de una jornada operativa fue actualizada.',
      origen: { jornadaId: input.journeyId },
      tipo: 'CAMBIO_JORNADA',
      titulo: 'Cambio de jornada operativa',
    },
    tx,
  )
}

export async function createNoveltyStateChangeAlert(
  input: { conductorId: string; eventAt: Date; noveltyId: string; state: string },
  tx: Prisma.TransactionClient,
) {
  return materializeInternal(
    {
      claveDeduplicacion: `cambio-estado-novedad:novedad:${input.noveltyId}:${input.state.toLowerCase()}`,
      contextoEvento: { estado: input.state, eventAt: input.eventAt.toISOString() },
      destinatarios: { kind: 'USERS', userIds: [input.conductorId] },
      mensaje: `La novedad reportada cambio al estado ${input.state}.`,
      origen: { novedadId: input.noveltyId },
      tipo: 'CAMBIO_ESTADO_NOVEDAD',
      titulo: 'Cambio en el estado de la novedad',
    },
    tx,
  )
}

export async function evaluateJourneyMileageAlerts(
  tx: Prisma.TransactionClient,
  evaluatedAt = new Date(),
  journeyIds?: string[],
) {
  const journeys = await tx.jornadaOperativa.findMany({
    select: {
      conductorId: true,
      estado: true,
      finProgramado: true,
      id: true,
      inicioProgramado: true,
      lecturasKilometraje: {
        select: { tipo: true },
        where: { tipo: { in: ['INICIO_JORNADA', 'FIN_JORNADA'] } },
      },
    },
    where: {
      ...(journeyIds ? { id: { in: journeyIds } } : {}),
      OR: [
        { estado: 'PROGRAMADA', inicioProgramado: { lte: evaluatedAt } },
        { estado: 'EN_CURSO', finProgramado: { lte: evaluatedAt } },
      ],
    },
  })

  const dispatchers = await recipientIdsByRoles(['DESPACHADOR'], tx)
  for (const journey of journeys) {
    const missingInitial =
      journey.estado === 'PROGRAMADA' &&
      !journey.lecturasKilometraje.some((reading) => reading.tipo === 'INICIO_JORNADA')
    const missingFinal =
      journey.estado === 'EN_CURSO' &&
      !journey.lecturasKilometraje.some((reading) => reading.tipo === 'FIN_JORNADA')
    if (!missingInitial && !missingFinal) continue

    const type = missingInitial
      ? 'JORNADA_SIN_KILOMETRAJE_INICIAL'
      : 'JORNADA_SIN_KILOMETRAJE_FINAL'
    const scheduledAt = missingInitial ? journey.inicioProgramado : journey.finProgramado
    await materializeInternal(
      {
        claveDeduplicacion: `${type.toLowerCase()}:jornada:${journey.id}:${scheduledAt.toISOString()}`,
        contextoEvento: { estado: journey.estado, eventAt: evaluatedAt.toISOString() },
        destinatarios: {
          kind: 'USERS',
          userIds: [...dispatchers, journey.conductorId],
        },
        mensaje: missingInitial
          ? 'La jornada alcanzo su inicio programado sin kilometraje inicial.'
          : 'La jornada supero su fin programado sin kilometraje final.',
        origen: { jornadaId: journey.id },
        tipo: type,
        titulo: missingInitial
          ? 'Jornada sin kilometraje inicial'
          : 'Jornada sin kilometraje final',
      },
      tx,
    )
  }
}

export async function persistJourneyConflictAlert(input: {
  busId?: string
  idempotencyKey: string
  journeyId?: string
}) {
  return prisma.$transaction(async (tx) => {
    const journey = input.journeyId
      ? await tx.jornadaOperativa.findUnique({
          select: { busId: true },
          where: { id: input.journeyId },
        })
      : null
    const resolvedBusId = journey?.busId ?? input.busId
    if (!resolvedBusId) return undefined

    const bus = await tx.bus.findUnique({
      select: { codigoInterno: true, id: true },
      where: { id: resolvedBusId },
    })
    if (!bus) return undefined

    return materializeInternal(
      {
        claveDeduplicacion: `conflicto-jornada:bus:${bus.id}:solicitud:${input.idempotencyKey.toLowerCase()}`,
        contextoEvento: {
          busCodigo: bus.codigoInterno,
          estado: 'RECHAZADO',
          eventAt: new Date().toISOString(),
        },
        destinatarios: { kind: 'ROLES', roles: ['ADMINISTRADOR', 'DESPACHADOR'] },
        mensaje: `Se rechazo una programacion de jornada por conflicto operativo para el bus ${bus.codigoInterno}.`,
        origen: { busId: bus.id },
        tipo: 'CONFLICTO_JORNADA',
        titulo: 'Conflicto de jornada rechazado',
      },
      tx,
    )
  })
}

function mapRecipientAlert(record: AlertRecipientRecord, actor: AuthenticatedUser) {
  const catalog = alertCatalogEntry(record.alertaInterna.tipo)
  const contextoEvento = { ...(record.alertaInterna.contextoEvento as Record<string, unknown>) }
  delete contextoEvento.enlaceInterno
  return {
    alertaId: record.alertaInterna.id,
    contextoEvento,
    destinatarioId: record.id,
    enlaceInterno: catalog.internalRoutes[actor.rol.codigo as AlertRecipientRole] ?? null,
    estado: record.estado,
    fechaAtencion: record.fechaAtencion?.toISOString() ?? null,
    fechaGeneracion: record.alertaInterna.fechaGeneracion.toISOString(),
    fechaLectura: record.fechaLectura?.toISOString() ?? null,
    mensaje: record.alertaInterna.mensaje,
    prioridad: record.alertaInterna.prioridad,
    tipo: record.alertaInterna.tipo,
    titulo: record.alertaInterna.titulo,
  }
}

export class AlertService {
  private readonly alertRepository: AlertRepository

  constructor(alertRepository = new AlertRepository()) {
    this.alertRepository = alertRepository
  }

  async listOwn(query: ListAlertsQuery, actor: AuthenticatedUser) {
    const result = await this.alertRepository.listOwn(actor.id, query)
    return {
      items: result.items.map((item) => mapRecipientAlert(item, actor)),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
    }
  }

  async countUnread(actor: AuthenticatedUser) {
    return { count: await this.alertRepository.countUnread(actor.id) }
  }

  async markRead(destinatarioId: string, actor: AuthenticatedUser) {
    const record = await this.alertRepository.markRead(destinatarioId, actor.id, new Date())
    if (!record) throw new AppError(404, 'ALERT_NOT_FOUND', 'Alerta no encontrada')
    return { alerta: mapRecipientAlert(record, actor) }
  }

  async markAttended(destinatarioId: string, actor: AuthenticatedUser) {
    const record = await this.alertRepository.markAttended(destinatarioId, actor.id, new Date())
    if (!record) throw new AppError(404, 'ALERT_NOT_FOUND', 'Alerta no encontrada')
    return { alerta: mapRecipientAlert(record, actor) }
  }
}
