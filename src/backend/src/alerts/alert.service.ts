import { randomUUID } from 'node:crypto'

import type { CriticidadNovedad, Prisma } from '@prisma/client'

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
    context: Prisma.InputJsonObject
    message: string
    noveltyId: string
    priority: 'ALTA' | 'CRITICA'
    recipients: string[]
    title: string
    type: 'NOVEDAD_CRITICA' | 'BUS_BLOQUEADO'
  },
  tx: Prisma.TransactionClient,
) {
  const recipients = [...new Set(input.recipients)]
  if (recipients.length === 0) return

  const key = `${input.type.toLowerCase()}:novedad:${input.noveltyId}:${input.noveltyId}`
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
      novedadId: input.noveltyId,
      prioridad: input.priority,
      tipo: input.type,
      titulo: input.title,
    },
  })
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
