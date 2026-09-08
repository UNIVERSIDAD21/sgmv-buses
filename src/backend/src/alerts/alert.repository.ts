import {
  Prisma,
  type EstadoAlertaDestinatario,
  type PrioridadAlerta,
  type RolCodigo,
  type TipoAlerta,
} from '@prisma/client'

import { prisma } from '../prisma/client.js'
import type { ListAlertsQuery } from './alert.schemas.js'

const alertSelect = {
  busId: true,
  contextoEvento: true,
  fechaGeneracion: true,
  id: true,
  jornadaOperativaId: true,
  mensaje: true,
  novedadId: true,
  ordenTrabajoId: true,
  prioridad: true,
  programacionMantenimientoId: true,
  repuestoId: true,
  tipo: true,
  titulo: true,
} as const

export type AlertRecipientRecord = Prisma.AlertaDestinatarioGetPayload<{
  select: {
    alertaInterna: { select: typeof alertSelect }
    estado: true
    fechaAtencion: true
    fechaLectura: true
    id: true
  }
}>

function dateRange(query: ListAlertsQuery) {
  if (!query.fechaDesde && !query.fechaHasta) return undefined
  return {
    ...(query.fechaDesde ? { gte: new Date(`${query.fechaDesde}T00:00:00.000Z`) } : {}),
    ...(query.fechaHasta ? { lte: new Date(`${query.fechaHasta}T23:59:59.999Z`) } : {}),
  }
}

function ownAlertsWhere(
  userId: string,
  query: ListAlertsQuery,
): Prisma.AlertaDestinatarioWhereInput {
  const generatedAt = dateRange(query)
  return {
    usuarioId: userId,
    ...(query.estado ? { estado: query.estado } : {}),
    ...(query.tipo || query.prioridad || generatedAt
      ? {
          alertaInterna: {
            ...(query.tipo ? { tipo: query.tipo } : {}),
            ...(query.prioridad ? { prioridad: query.prioridad } : {}),
            ...(generatedAt ? { fechaGeneracion: generatedAt } : {}),
          },
        }
      : {}),
  }
}

const ownRecipientSelect = {
  alertaInterna: { select: alertSelect },
  estado: true,
  fechaAtencion: true,
  fechaLectura: true,
  id: true,
} as const

export class AlertRepository {
  async listOwn(userId: string, query: ListAlertsQuery) {
    const where = ownAlertsWhere(userId, query)
    const [items, total] = await Promise.all([
      prisma.alertaDestinatario.findMany({
        orderBy: [{ alertaInterna: { fechaGeneracion: 'desc' } }, { id: 'desc' }],
        select: ownRecipientSelect,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
      prisma.alertaDestinatario.count({ where }),
    ])
    return { items, total }
  }

  countUnread(userId: string) {
    return prisma.alertaDestinatario.count({ where: { estado: 'NO_LEIDA', usuarioId: userId } })
  }

  findOwnRecipient(destinatarioId: string, userId: string) {
    return prisma.alertaDestinatario.findFirst({
      select: ownRecipientSelect,
      where: { id: destinatarioId, usuarioId: userId },
    })
  }

  async markRead(destinatarioId: string, userId: string, at: Date) {
    const existing = await this.findOwnRecipient(destinatarioId, userId)
    if (!existing || existing.estado !== 'NO_LEIDA') return existing
    await prisma.alertaDestinatario.updateMany({
      data: { estado: 'LEIDA', fechaLectura: at },
      where: { estado: 'NO_LEIDA', id: destinatarioId, usuarioId: userId },
    })
    return this.findOwnRecipient(destinatarioId, userId)
  }

  async markAttended(destinatarioId: string, userId: string, at: Date) {
    const existing = await this.findOwnRecipient(destinatarioId, userId)
    if (!existing || existing.estado === 'ATENDIDA') return existing
    const updated = await prisma.alertaDestinatario.updateMany({
      data:
        existing.estado === 'NO_LEIDA'
          ? { estado: 'ATENDIDA', fechaAtencion: at, fechaLectura: at }
          : { estado: 'ATENDIDA', fechaAtencion: at },
      where: { estado: existing.estado, id: destinatarioId, usuarioId: userId },
    })
    if (updated.count === 1) return this.findOwnRecipient(destinatarioId, userId)

    const concurrent = await this.findOwnRecipient(destinatarioId, userId)
    if (concurrent?.estado === 'LEIDA') {
      await prisma.alertaDestinatario.updateMany({
        data: { estado: 'ATENDIDA', fechaAtencion: at },
        where: { estado: 'LEIDA', id: destinatarioId, usuarioId: userId },
      })
    }
    return this.findOwnRecipient(destinatarioId, userId)
  }
}

export type AlertCreationInput = {
  busId?: string
  context: Prisma.InputJsonObject
  deduplicationKey: string
  journeyId?: string
  message: string
  noveltyId?: string
  orderId?: string
  priority: PrioridadAlerta
  preventiveScheduleId?: string
  sparePartId?: string
  title: string
  type: TipoAlerta
}

export async function findActiveAllowedRecipients(
  recipientIds: string[],
  allowedRoles: readonly RolCodigo[],
  tx: Prisma.TransactionClient,
) {
  if (recipientIds.length === 0) return []
  const users = await tx.usuario.findMany({
    select: { id: true },
    where: {
      estado: 'ACTIVO',
      id: { in: [...new Set(recipientIds)] },
      rol: { codigo: { in: [...allowedRoles] } },
    },
  })
  return users.map((user) => user.id)
}

export async function createAlertRecord(
  input: AlertCreationInput & { recipients: string[] },
  tx: Prisma.TransactionClient,
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:alerta-clave:${input.deduplicationKey}`}, 0))`,
  )
  const existing = await tx.alertaInterna.findUnique({
    select: { id: true },
    where: { claveDeduplicacion: input.deduplicationKey },
  })
  if (existing) {
    await tx.alertaDestinatario.createMany({
      data: input.recipients.map((usuarioId) => ({
        alertaInternaId: existing.id,
        estado: 'NO_LEIDA' as EstadoAlertaDestinatario,
        usuarioId,
      })),
      skipDuplicates: true,
    })
    return existing.id
  }
  const created = await tx.alertaInterna.create({
    data: {
      ...(input.busId ? { busId: input.busId } : {}),
      ...(input.journeyId ? { jornadaOperativaId: input.journeyId } : {}),
      claveDeduplicacion: input.deduplicationKey,
      contextoEvento: input.context,
      destinatarios: {
        create: input.recipients.map((usuarioId) => ({ estado: 'NO_LEIDA', usuarioId })),
      },
      mensaje: input.message,
      ...(input.noveltyId ? { novedadId: input.noveltyId } : {}),
      ...(input.orderId ? { ordenTrabajoId: input.orderId } : {}),
      ...(input.preventiveScheduleId
        ? { programacionMantenimientoId: input.preventiveScheduleId }
        : {}),
      ...(input.sparePartId ? { repuestoId: input.sparePartId } : {}),
      prioridad: input.priority,
      tipo: input.type,
      titulo: input.title,
    },
    select: { id: true },
  })
  return created.id
}
