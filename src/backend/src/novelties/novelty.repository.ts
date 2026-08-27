import { randomUUID } from 'node:crypto'

import { Prisma, type EstadoNovedad, type PrioridadOrden } from '@prisma/client'

import { prisma } from '../prisma/client.js'

type NoveltyDbClient = Prisma.TransactionClient | typeof prisma

const userSelect = {
  email: true,
  id: true,
  nombre: true,
} as const

const busSelect = {
  codigoInterno: true,
  estadoOperativo: true,
  id: true,
  placa: true,
} as const

export const orderSummaryInclude = {
  estadosHistorial: {
    orderBy: {
      fechaCambio: 'asc',
    },
    take: 1,
  },
} as const

export const noveltyInclude = {
  bus: {
    select: busSelect,
  },
  conductor: {
    select: userSelect,
  },
  ordenTrabajo: {
    include: orderSummaryInclude,
  },
  revisadaPor: {
    select: userSelect,
  },
} as const

export type NoveltyRecord = Prisma.NovedadGetPayload<{ include: typeof noveltyInclude }>
export type WorkOrderRecord = Prisma.OrdenTrabajoGetPayload<{ include: typeof orderSummaryInclude }>

interface CreateNoveltyData {
  busId: string
  conductorId: string
  descripcion: string
  tipo: string
}

interface ReviewNoveltyData {
  clasificacion?: string
  estado?: EstadoNovedad
  observacionRevision?: string
  revisadaPorId: string
}

interface ConvertNoveltyData {
  descripcionOrden: string
  observacion: string | null
  prioridad: PrioridadOrden
}

export class NoveltyRepository {
  countNovelties(where: Prisma.NovedadWhereInput = {}) {
    return prisma.novedad.count({ where })
  }

  countOrdersGenerated() {
    return prisma.ordenTrabajo.count({
      where: {
        origen: 'NOVEDAD',
        novedadId: {
          not: null,
        },
      },
    })
  }

  countNoveltiesByStatus() {
    return prisma.novedad.groupBy({
      by: ['estado'],
      _count: {
        _all: true,
      },
    })
  }

  createNovelty(data: CreateNoveltyData) {
    return prisma.novedad.create({
      data,
      include: noveltyInclude,
    })
  }

  findActiveAssignmentWithBusByConductor(conductorId: string) {
    return prisma.asignacionConductor.findFirst({
      where: {
        activa: true,
        conductorId,
      },
      include: {
        bus: {
          select: busSelect,
        },
      },
      orderBy: {
        fechaInicio: 'desc',
      },
    })
  }

  findNoveltyById(id: string) {
    return prisma.novedad.findUnique({
      where: { id },
      include: noveltyInclude,
    })
  }

  findExistingOrderByNovelty(novedadId: string) {
    return prisma.ordenTrabajo.findUnique({
      where: { novedadId },
      include: orderSummaryInclude,
    })
  }

  listNovelties(where: Prisma.NovedadWhereInput, skip: number, take: number) {
    return prisma.novedad.findMany({
      where,
      include: noveltyInclude,
      orderBy: {
        fechaReporte: 'desc',
      },
      skip,
      take,
    })
  }

  reviewPendingNovelty(novedadId: string, data: ReviewNoveltyData) {
    return prisma.$transaction(
      async (tx) => {
        const novelty = await this.findNoveltyByIdForTransaction(novedadId, tx)

        if (!novelty) {
          return {
            novedad: null,
            status: 'NOT_FOUND' as const,
          }
        }

        if (novelty.estado !== 'PENDIENTE_REVISION') {
          return {
            novedad: novelty,
            status: 'TERMINAL_STATE' as const,
          }
        }

        const updated = await tx.novedad.update({
          where: { id: novedadId },
          data: {
            clasificacion: data.clasificacion,
            estado: data.estado,
            fechaRevision: new Date(),
            observacionRevision: data.observacionRevision,
            revisadaPorId: data.revisadaPorId,
          },
          include: noveltyInclude,
        })

        return {
          novedad: updated,
          status: 'UPDATED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  convertToCorrectiveOrder(novedadId: string, actorId: string, data: ConvertNoveltyData) {
    return prisma.$transaction(
      async (tx) => {
        const novelty = await this.findNoveltyByIdForTransaction(novedadId, tx)

        if (!novelty) {
          return {
            novedad: null,
            orden: null,
            status: 'NOT_FOUND' as const,
          }
        }

        if (novelty.ordenTrabajo) {
          return {
            novedad: novelty,
            orden: novelty.ordenTrabajo,
            status: 'ALREADY_CONVERTED' as const,
          }
        }

        if (novelty.estado !== 'PENDIENTE_REVISION') {
          return {
            novedad: novelty,
            orden: null,
            status: 'TERMINAL_STATE' as const,
          }
        }

        const order = await tx.ordenTrabajo.create({
          data: {
            busId: novelty.busId,
            codigo: this.createCorrectiveOrderCode(),
            creadaPorId: actorId,
            descripcion: data.descripcionOrden,
            estado: 'PENDIENTE_ASIGNACION',
            novedadId,
            origen: 'NOVEDAD',
            prioridad: data.prioridad,
            tipo: 'CORRECTIVA',
          },
          include: orderSummaryInclude,
        })

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: null,
            estadoNuevo: 'PENDIENTE_ASIGNACION',
            observacion: data.observacion ?? 'Orden correctiva creada desde novedad operativa',
            ordenTrabajoId: order.id,
          },
        })

        const updatedNovelty = await tx.novedad.update({
          where: { id: novedadId },
          data: {
            estado: 'CONVERTIDA_A_ORDEN',
            fechaRevision: new Date(),
            observacionRevision: data.observacion ?? 'Convertida a orden correctiva',
            revisadaPorId: actorId,
          },
          include: noveltyInclude,
        })

        return {
          novedad: updatedNovelty,
          orden: order,
          status: 'CONVERTED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  private createCorrectiveOrderCode() {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()

    return `OT-NOV-${suffix}`
  }

  private findNoveltyByIdForTransaction(novedadId: string, client: NoveltyDbClient) {
    return client.novedad.findUnique({
      where: { id: novedadId },
      include: noveltyInclude,
    })
  }
}
