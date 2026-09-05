import { type Prisma, PrismaClient } from '@prisma/client'

import { getAvailabilityRecords } from '../availability/availability.repository.js'
import type { AvailabilityRecords } from '../availability/availability.types.js'
import { registerContextualMileageReading } from '../mileage/mileage.repository.js'
import { prisma } from '../prisma/client.js'

const userRefSelect = {
  id: true,
  nombre: true,
  rol: { select: { codigo: true } },
} satisfies Prisma.UsuarioSelect

const journeyInclude = {
  bus: {
    select: {
      codigoInterno: true,
      estadoOperativo: true,
      id: true,
      placa: true,
    },
  },
  cambioPor: { select: userRefSelect },
  conductor: { select: userRefSelect },
  finalizadaPor: { select: userRefSelect },
  iniciadaPor: { select: userRefSelect },
  jornadaSucesora: { select: { id: true } },
  lecturasKilometraje: {
    where: { tipo: { in: ['INICIO_JORNADA', 'FIN_JORNADA'] } },
    include: { registradoPor: { select: userRefSelect } },
    orderBy: [{ fechaLectura: 'asc' as const }, { fechaRegistro: 'asc' as const }],
  },
  programadaPor: { select: userRefSelect },
  ruta: {
    select: {
      codigo: true,
      destino: true,
      id: true,
      nombre: true,
      origen: true,
    },
  },
} satisfies Prisma.JornadaOperativaInclude

export type JourneyRecord = Prisma.JornadaOperativaGetPayload<{ include: typeof journeyInclude }>
export type JourneyTransaction = Prisma.TransactionClient

const optionUserSelect = {
  id: true,
  nombre: true,
} satisfies Prisma.UsuarioSelect

export class JourneyRepository {
  count(where: Prisma.JornadaOperativaWhereInput) {
    return prisma.jornadaOperativa.count({ where })
  }

  create(data: Prisma.JornadaOperativaUncheckedCreateInput, tx: JourneyTransaction) {
    return tx.jornadaOperativa.create({ data, include: journeyInclude })
  }

  findById(id: string, tx: JourneyTransaction | PrismaClient = prisma) {
    return tx.jornadaOperativa.findUnique({ where: { id }, include: journeyInclude })
  }

  async findContext(
    busId: string,
    conductorId: string,
    rutaId: string | null,
    tx: JourneyTransaction,
  ) {
    const [bus, conductor, ruta] = await Promise.all([
      tx.bus.findUnique({
        where: { id: busId },
        select: { estadoOperativo: true, id: true, kilometrajeActual: true },
      }),
      tx.usuario.findUnique({
        where: { id: conductorId },
        select: { estado: true, id: true, rol: { select: { codigo: true } } },
      }),
      rutaId
        ? tx.ruta.findUnique({ where: { id: rutaId }, select: { activa: true, id: true } })
        : Promise.resolve(null),
    ])

    return { bus, conductor, ruta }
  }

  findCurrentAndNextByDriver(conductorId: string, now: Date) {
    return Promise.all([
      prisma.jornadaOperativa.findFirst({
        where: { conductorId, estado: 'EN_CURSO' },
        include: journeyInclude,
        orderBy: { inicioReal: 'desc' },
      }),
      prisma.jornadaOperativa.findFirst({
        where: { conductorId, estado: 'PROGRAMADA', finProgramado: { gte: now } },
        include: journeyInclude,
        orderBy: { inicioProgramado: 'asc' },
      }),
    ])
  }

  getAvailabilityRecords(
    busId: string,
    conductorId: string,
    journeyId: string | null,
    eventDate: Date,
    tx: JourneyTransaction,
  ): Promise<AvailabilityRecords> {
    return getAvailabilityRecords({ busId, conductorId, eventDate, journeyId }, tx)
  }

  async listOptions() {
    const [buses, conductores, rutas] = await Promise.all([
      prisma.bus.findMany({
        orderBy: { codigoInterno: 'asc' },
        select: {
          codigoInterno: true,
          estadoOperativo: true,
          id: true,
          kilometrajeActual: true,
          placa: true,
        },
      }),
      prisma.usuario.findMany({
        where: { estado: 'ACTIVO', rol: { codigo: 'CONDUCTOR' } },
        orderBy: { nombre: 'asc' },
        select: optionUserSelect,
      }),
      prisma.ruta.findMany({
        where: { activa: true },
        orderBy: { codigo: 'asc' },
        select: { codigo: true, destino: true, id: true, nombre: true, origen: true },
      }),
    ])

    return { buses, conductores, rutas }
  }

  list(
    where: Prisma.JornadaOperativaWhereInput,
    orderBy: Prisma.JornadaOperativaOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return prisma.jornadaOperativa.findMany({ where, include: journeyInclude, orderBy, skip, take })
  }

  listReadings(journeyId: string) {
    return prisma.lecturaKilometraje.findMany({
      where: { jornadaOperativaId: journeyId },
      include: { registradoPor: { select: userRefSelect } },
      orderBy: [{ fechaLectura: 'asc' }, { fechaRegistro: 'asc' }, { id: 'asc' }],
    })
  }

  async lockBus(busId: string, tx: JourneyTransaction) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM buses WHERE id = ${busId}::uuid FOR UPDATE
    `
    return rows.length > 0
  }

  async lockDriver(conductorId: string, tx: JourneyTransaction) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM usuarios WHERE id = ${conductorId}::uuid FOR UPDATE
    `
    return rows.length > 0
  }

  async lockJourney(journeyId: string, tx: JourneyTransaction) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM jornadas_operativas WHERE id = ${journeyId}::uuid FOR UPDATE
    `
    return rows.length > 0
  }

  async registerJourneyReading(
    input: {
      actorId: string
      busId: string
      eventDate: Date
      journeyId: string
      mileage: number
      type: 'INICIO_JORNADA' | 'FIN_JORNADA'
    },
    tx: JourneyTransaction,
  ) {
    return registerContextualMileageReading(input, tx)
  }

  transaction<T>(operation: (tx: JourneyTransaction) => Promise<T>) {
    return prisma.$transaction(operation, { maxWait: 15_000, timeout: 60_000 })
  }

  update(id: string, data: Prisma.JornadaOperativaUncheckedUpdateInput, tx: JourneyTransaction) {
    return tx.jornadaOperativa.update({ where: { id }, data, include: journeyInclude })
  }
}
