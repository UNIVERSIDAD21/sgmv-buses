import { randomUUID } from 'node:crypto'

import {
  Prisma,
  type CriticidadNovedad,
  type EstadoNovedad,
  type PrioridadOrden,
} from '@prisma/client'

import { createNoveltyAlerts } from '../alerts/alert.service.js'
import { registerContextualMileageReading } from '../mileage/mileage.repository.js'
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
  jornadaOperativa: {
    select: {
      estado: true,
      finReal: true,
      id: true,
      inicioReal: true,
      ruta: {
        select: {
          codigo: true,
          destino: true,
          id: true,
          nombre: true,
          origen: true,
        },
      },
    },
  },
  lecturaKilometraje: {
    select: {
      fechaLectura: true,
      fechaRegistro: true,
      id: true,
      kilometrajeAnterior: true,
      kilometrajeNuevo: true,
      tipo: true,
    },
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
  conductorId: string
  descripcion: string
  fechaOcurrencia: Date
  kilometraje: number
  tipo: string
}

interface ReviewNoveltyData {
  afectaOperacion?: boolean
  bloqueaDisponibilidad?: boolean
  clasificacion?: string
  criticidad?: CriticidadNovedad
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
    return prisma.$transaction(
      async (tx) => {
        const journey = await tx.jornadaOperativa.findFirst({
          where: {
            conductorId: data.conductorId,
            inicioReal: { lte: data.fechaOcurrencia },
            OR: [
              { estado: 'EN_CURSO', finReal: null },
              {
                estado: { in: ['FINALIZADA', 'CANCELADA', 'REASIGNADA'] },
                finReal: { gte: data.fechaOcurrencia },
              },
            ],
          },
          orderBy: { inicioReal: 'desc' },
          select: { busId: true, conductorId: true, id: true },
        })

        if (!journey) {
          return { novedad: null, status: 'JOURNEY_NOT_FOUND' as const }
        }

        await tx.$queryRaw`SELECT id FROM buses WHERE id = ${journey.busId}::uuid FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM jornadas_operativas WHERE id = ${journey.id}::uuid FOR UPDATE`

        const lockedJourney = await tx.jornadaOperativa.findUnique({
          where: { id: journey.id },
          select: {
            busId: true,
            conductorId: true,
            estado: true,
            finReal: true,
            id: true,
            inicioReal: true,
          },
        })
        const containsEvent =
          lockedJourney?.conductorId === data.conductorId &&
          lockedJourney.inicioReal !== null &&
          lockedJourney.inicioReal <= data.fechaOcurrencia &&
          ((lockedJourney.estado === 'EN_CURSO' && lockedJourney.finReal === null) ||
            (lockedJourney.finReal !== null && lockedJourney.finReal >= data.fechaOcurrencia))

        if (!lockedJourney || !containsEvent) {
          return { novedad: null, status: 'JOURNEY_NOT_FOUND' as const }
        }

        const noveltyId = randomUUID()
        const readingId = randomUUID()
        await registerContextualMileageReading(
          {
            actorId: data.conductorId,
            busId: lockedJourney.busId,
            eventDate: data.fechaOcurrencia,
            journeyId: lockedJourney.id,
            mileage: data.kilometraje,
            readingId,
            type: 'NOVEDAD',
          },
          tx,
        )
        const novelty = await tx.novedad.create({
          data: {
            busId: lockedJourney.busId,
            conductorId: data.conductorId,
            descripcion: data.descripcion,
            fechaOcurrencia: data.fechaOcurrencia,
            id: noveltyId,
            jornadaOperativaId: lockedJourney.id,
            lecturaKilometrajeId: readingId,
            tipo: data.tipo,
          },
          include: noveltyInclude,
        })

        return { novedad: novelty, status: 'CREATED' as const }
      },
      { maxWait: 15_000, timeout: 60_000 },
    )
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
            afectaOperacion: data.afectaOperacion,
            bloqueaDisponibilidad: data.bloqueaDisponibilidad,
            clasificacion: data.clasificacion,
            criticidad: data.criticidad,
            estado: data.estado,
            fechaRevision: new Date(),
            observacionRevision: data.observacionRevision,
            revisadaPorId: data.revisadaPorId,
          },
          include: noveltyInclude,
        })

        if (
          updated.estado === 'PENDIENTE_REVISION' &&
          updated.jornadaOperativaId &&
          updated.fechaOcurrencia &&
          updated.criticidad &&
          updated.afectaOperacion !== null &&
          updated.bloqueaDisponibilidad !== null
        ) {
          await createNoveltyAlerts(
            {
              afectaOperacion: updated.afectaOperacion,
              bloqueaDisponibilidad: updated.bloqueaDisponibilidad,
              busCodigo: updated.bus.codigoInterno,
              busId: updated.busId,
              conductorId: updated.conductorId,
              criticidad: updated.criticidad,
              eventAt: updated.fechaOcurrencia,
              jornadaId: updated.jornadaOperativaId,
              novedadId: updated.id,
            },
            tx,
          )
        }

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
            jornadaOperativaId: novelty.jornadaOperativaId,
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
