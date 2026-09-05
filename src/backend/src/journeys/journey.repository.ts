import { randomUUID } from 'node:crypto'

import { type Prisma, PrismaClient } from '@prisma/client'

import { prisma } from '../prisma/client.js'
import { AppError } from '../shared/http.js'

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

export interface AvailabilityRecords {
  bus: {
    estadoOperativo: 'OPERATIVO' | 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO' | 'INACTIVO'
    id: string
  } | null
  conflictingJourney: { id: string } | null
  novelty: { id: string } | null
  order: { id: string } | null
  preventive: { id: string } | null
}

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
    return tx.bus
      .findUnique({
        where: { id: busId },
        select: { estadoOperativo: true, id: true, kilometrajeActual: true },
      })
      .then(async (bus) => {
        const [conflictingJourney, novelty, order, preventive] = await Promise.all([
          tx.jornadaOperativa.findFirst({
            where: {
              OR: [{ busId }, { conductorId }],
              id: journeyId ? { not: journeyId } : undefined,
              AND: {
                OR: [
                  {
                    estado: 'PROGRAMADA',
                    inicioProgramado: { lte: eventDate },
                    finProgramado: { gt: eventDate },
                  },
                  {
                    estado: 'EN_CURSO',
                    inicioReal: { lte: eventDate },
                    finReal: null,
                  },
                ],
              },
            },
            select: { id: true },
          }),
          tx.novedad.findFirst({
            where: { bloqueaDisponibilidad: true, busId, estado: 'PENDIENTE_REVISION' },
            select: { id: true },
          }),
          tx.ordenTrabajo.findFirst({
            where: {
              busId,
              estado: { in: ['EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION'] },
            },
            select: { id: true },
          }),
          tx.programacionMantenimiento.findFirst({
            where: {
              activa: true,
              busId,
              planMantenimientoPreventivo: { bloqueaAlVencer: true },
              OR: [
                { fechaProgramada: { lte: eventDate } },
                ...(bus ? [{ kilometrajeObjetivo: { lte: bus.kilometrajeActual } }] : []),
              ],
            },
            select: { id: true },
          }),
        ])

        return { bus, conflictingJourney, novelty, order, preventive }
      })
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
    const bus = await tx.bus.findUnique({
      where: { id: input.busId },
      select: { kilometrajeActual: true },
    })
    if (!bus) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Bus no encontrado')

    const readings = await tx.lecturaKilometraje.findMany({
      where: { busId: input.busId },
      orderBy: [{ fechaRegistro: 'asc' }, { id: 'asc' }],
      select: {
        fechaLectura: true,
        fechaRegistro: true,
        id: true,
        kilometrajeAnterior: true,
        kilometrajeNuevo: true,
      },
    })
    readings.sort((left, right) => {
      const byEvent =
        (left.fechaLectura ?? left.fechaRegistro).getTime() -
        (right.fechaLectura ?? right.fechaRegistro).getTime()
      if (byEvent !== 0) return byEvent
      const byRegistration = left.fechaRegistro.getTime() - right.fechaRegistro.getTime()
      return byRegistration !== 0 ? byRegistration : left.id.localeCompare(right.id)
    })

    const nextIndex = readings.findIndex(
      (reading) =>
        (reading.fechaLectura ?? reading.fechaRegistro).getTime() > input.eventDate.getTime(),
    )
    const previous =
      nextIndex === 0 ? null : readings[nextIndex < 0 ? readings.length - 1 : nextIndex - 1]
    const next = nextIndex < 0 ? null : readings[nextIndex]
    const baseline = readings[0]?.kilometrajeAnterior ?? bus.kilometrajeActual
    const previousMileage = previous?.kilometrajeNuevo ?? baseline

    if (input.mileage < previousMileage || (next && input.mileage > next.kilometrajeNuevo)) {
      throw new AppError(
        409,
        'MILEAGE_OUT_OF_SEQUENCE',
        'La lectura no conserva la secuencia del odometro',
        {
          maximoPermitido: next?.kilometrajeNuevo ?? null,
          minimoPermitido: previousMileage,
        },
      )
    }

    const reading = await tx.lecturaKilometraje.create({
      data: {
        busId: input.busId,
        fechaLectura: input.eventDate,
        id: randomUUID(),
        jornadaOperativaId: input.journeyId,
        kilometrajeAnterior: previousMileage,
        kilometrajeNuevo: input.mileage,
        registradoPorId: input.actorId,
        tipo: input.type,
      },
      include: { registradoPor: { select: userRefSelect } },
    })

    if (next) {
      await tx.lecturaKilometraje.update({
        where: { id: next.id },
        data: { kilometrajeAnterior: input.mileage },
      })
    }
    if (input.mileage > bus.kilometrajeActual) {
      await tx.bus.update({
        where: { id: input.busId },
        data: { kilometrajeActual: input.mileage },
      })
    }

    return reading
  }

  transaction<T>(operation: (tx: JourneyTransaction) => Promise<T>) {
    return prisma.$transaction(operation, { maxWait: 15_000, timeout: 60_000 })
  }

  update(id: string, data: Prisma.JornadaOperativaUncheckedUpdateInput, tx: JourneyTransaction) {
    return tx.jornadaOperativa.update({ where: { id }, data, include: journeyInclude })
  }
}
