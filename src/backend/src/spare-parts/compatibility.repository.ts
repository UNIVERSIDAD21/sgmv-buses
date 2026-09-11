import { Prisma } from '@prisma/client'

import { prisma } from '../prisma/client.js'
import type { CreateCompatibilityInput } from './compatibility.schemas.js'

const include = {
  bus: { select: { codigoInterno: true, id: true } },
  definidaPor: { select: { id: true, nombre: true } },
  modeloBus: { select: { id: true, marca: true, nombreModelo: true } },
} as const

export type CompatibilityRecord = Prisma.CompatibilidadRepuestoGetPayload<{
  include: typeof include
}>

export class CompatibilityRepository {
  list(repuestoId: number) {
    return prisma.compatibilidadRepuesto.findMany({
      include,
      orderBy: [{ vigente: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
      where: { repuestoId },
    })
  }

  async createVersion(repuestoId: number, actorId: number, input: CreateCompatibilityInput) {
    const destinoId = input.busId ?? input.modeloBusId!
    const destino = input.busId ? `bus:${destinoId}` : `modelo:${destinoId}`

    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:compatibilidad:${repuestoId}:${destino}`}, 0))`,
        )
        const current = await tx.compatibilidadRepuesto.findFirst({
          orderBy: { version: 'desc' },
          where: {
            repuestoId,
            ...(input.busId ? { busId: input.busId } : { modeloBusId: input.modeloBusId }),
          },
        })
        const version = (current?.version ?? 0) + 1

        await tx.compatibilidadRepuesto.updateMany({
          data: { vigente: false },
          where: {
            repuestoId,
            vigente: true,
            ...(input.busId ? { busId: input.busId } : { modeloBusId: input.modeloBusId }),
          },
        })

        return tx.compatibilidadRepuesto.create({
          data: {
            busId: input.busId ?? null,
            condicionUso: input.condicionUso?.trim() || null,
            definidaPorId: actorId,
            especificacionesValidadas: input.especificacionesValidadas as Prisma.InputJsonObject,
            fechaDefinicion: new Date(),
            modeloBusId: input.modeloBusId ?? null,
            permitido: input.permitido,
            repuestoId,
            version,
            vigente: true,
          },
          include,
        })
      },
      { maxWait: 15000, timeout: 60000 },
    )
  }

  async deactivate(repuestoId: number, compatibilidadId: number) {
    return prisma.compatibilidadRepuesto.updateMany({
      data: { vigente: false },
      where: { id: compatibilidadId, repuestoId, vigente: true },
    })
  }

  find(repuestoId: number, compatibilidadId: number) {
    return prisma.compatibilidadRepuesto.findFirst({ where: { id: compatibilidadId, repuestoId } })
  }
}
