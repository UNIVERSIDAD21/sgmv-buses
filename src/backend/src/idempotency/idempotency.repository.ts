import { Prisma } from '@prisma/client'

import { prisma } from '../prisma/client.js'

export interface IdempotencyScope {
  actorId: string
  clave: string
  hashSolicitud: string
  metodo: string
  operacion: string
  requestId: string
  rutaPlantilla: string
}

export interface IdempotencyReservation {
  id: string
  requestId: string
}

export type IdempotencyDecision =
  | { kind: 'RESERVED'; reservation: IdempotencyReservation }
  | { kind: 'REPLAY'; response: Prisma.JsonValue; statusCode: number }
  | { kind: 'REUSED' }
  | { kind: 'IN_PROGRESS' }

interface CompleteReservationInput {
  recursoId?: string
  recursoTipo?: string
  reservation: IdempotencyReservation
  response: Prisma.InputJsonValue
  statusCode: number
}

function expiresAt(now: Date, ttlMs: number) {
  return new Date(now.getTime() + ttlMs)
}

export class IdempotencyRepository {
  async reserve(input: IdempotencyScope, ttlMs: number): Promise<IdempotencyDecision> {
    const now = new Date()

    try {
      const created = await prisma.solicitudIdempotente.create({
        data: {
          actorId: input.actorId,
          clave: input.clave,
          expiraAt: expiresAt(now, ttlMs),
          hashSolicitud: input.hashSolicitud,
          metodo: input.metodo,
          operacion: input.operacion,
          requestId: input.requestId,
          rutaPlantilla: input.rutaPlantilla,
        },
        select: {
          id: true,
          requestId: true,
        },
      })

      return { kind: 'RESERVED', reservation: created }
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error
      }
    }

    return this.resolveExisting(input, ttlMs)
  }

  complete(input: CompleteReservationInput) {
    return prisma.solicitudIdempotente.updateMany({
      where: {
        estado: 'EN_PROCESO',
        id: input.reservation.id,
        requestId: input.reservation.requestId,
      },
      data: {
        completadaAt: new Date(),
        estado: 'COMPLETADA',
        recursoId: input.recursoId,
        recursoTipo: input.recursoTipo,
        respuestaSegura: input.response,
        statusHttp: input.statusCode,
      },
    })
  }

  private async resolveExisting(
    input: IdempotencyScope,
    ttlMs: number,
  ): Promise<IdempotencyDecision> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await prisma.solicitudIdempotente.findFirst({
        where: {
          actorId: input.actorId,
          clave: input.clave,
          metodo: input.metodo,
          rutaPlantilla: input.rutaPlantilla,
        },
      })

      if (!existing) {
        return this.reserve(input, ttlMs)
      }

      if (existing.hashSolicitud !== input.hashSolicitud) {
        return { kind: 'REUSED' }
      }

      if (existing.estado === 'COMPLETADA') {
        if (existing.statusHttp === null || existing.respuestaSegura === null) {
          throw new Error('Registro idempotente terminal incompleto')
        }

        return {
          kind: 'REPLAY',
          response: existing.respuestaSegura,
          statusCode: existing.statusHttp,
        }
      }

      const now = new Date()

      if (existing.expiraAt > now) {
        return { kind: 'IN_PROGRESS' }
      }

      const recovered = await prisma.solicitudIdempotente.updateMany({
        where: {
          estado: 'EN_PROCESO',
          expiraAt: { lte: now },
          id: existing.id,
          requestId: existing.requestId,
        },
        data: {
          expiraAt: expiresAt(now, ttlMs),
          requestId: input.requestId,
        },
      })

      if (recovered.count === 1) {
        return {
          kind: 'RESERVED',
          reservation: {
            id: existing.id,
            requestId: input.requestId,
          },
        }
      }
    }

    return { kind: 'IN_PROGRESS' }
  }
}
