import { routeSelect, mapRouteReference } from '../amb/route-contract.js'
import { Prisma, PrismaClient } from '@prisma/client'
import { buildAvailability } from '../availability/availability.policy.js'
import { classifyPreventiveCycle } from '../preventive/preventive-cycle.js'

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
      kilometrajeActual: true,
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
  ruta: { select: routeSelect },
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

  findById(id: number, tx: JourneyTransaction | PrismaClient = prisma) {
    return tx.jornadaOperativa.findUnique({ where: { id }, include: journeyInclude })
  }

  async findContext(
    busId: number,
    conductorId: number,
    rutaId: number | null,
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

  findCurrentAndNextByDriver(conductorId: number, now: Date) {
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
    busId: number,
    conductorId: number,
    journeyId: number | null,
    eventDate: Date,
    tx: JourneyTransaction,
  ): Promise<AvailabilityRecords> {
    return getAvailabilityRecords({ busId, conductorId, eventDate, journeyId }, tx)
  }

  async listOptions() {
    return prisma.$transaction(
      async (tx) => {
        const evaluatedAt = new Date()
        const [buses, conductores, rutas] = await Promise.all([
          tx.bus.findMany({
            orderBy: { codigoInterno: 'asc' },
            select: {
              codigoInterno: true,
              estadoOperativo: true,
              id: true,
              kilometrajeActual: true,
              placa: true,
              novedades: {
                where: { bloqueaDisponibilidad: true, estado: 'PENDIENTE_REVISION' },
                select: { id: true },
                take: 1,
              },
              ordenesTrabajo: {
                where: {
                  OR: [
                    {
                      estado: { in: ['EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION'] },
                    },
                    { estado: { not: 'CERRADA' }, novedad: { bloqueaDisponibilidad: true } },
                  ],
                },
                select: { id: true },
                take: 1,
              },
              programacionesMantenimiento: {
                where: { activa: true },
                select: {
                  id: true,
                  fechaProgramada: true,
                  kilometrajeObjetivo: true,
                  planMantenimientoPreventivo: {
                    select: {
                      anticipacionDias: true,
                      anticipacionKm: true,
                      bloqueaAlVencer: true,
                      claveTarea: true,
                    },
                  },
                },
              },
            },
          }),
          tx.usuario.findMany({
            where: { estado: 'ACTIVO', rol: { codigo: 'CONDUCTOR' } },
            orderBy: { nombre: 'asc' },
            select: optionUserSelect,
          }),
          tx.ruta.findMany({
            where: { activa: true },
            orderBy: { codigo: 'asc' },
            select: routeSelect,
          }),
        ])

        return {
          buses: buses.map(
            ({ novedades, ordenesTrabajo, programacionesMantenimiento, ...bus }) => ({
              ...bus,
              disponibilidadTecnica: buildAvailability(
                {
                  bus,
                  conflictingJourney: null,
                  novelty: novedades[0] ?? null,
                  order: ordenesTrabajo[0] ?? null,
                  preventive: programacionesMantenimiento.flatMap((s) =>
                    s.planMantenimientoPreventivo
                      ? [{ ...s, plan: s.planMantenimientoPreventivo }]
                      : [],
                  ),
                },
                evaluatedAt,
              ),
              mantenimientos: programacionesMantenimiento.map((s) => ({
                id: s.id,
                fechaObjetivo: s.fechaProgramada?.toISOString().slice(0, 10) ?? null,
                kilometrajeObjetivo: s.kilometrajeObjetivo,
                anticipacionKm: s.planMantenimientoPreventivo?.anticipacionKm ?? 500,
                estado: classifyPreventiveCycle(
                  { ...s, kilometrajeActual: bus.kilometrajeActual },
                  evaluatedAt,
                ).estado,
              })),
            }),
          ),
          conductores,
          rutas: rutas.map(mapRouteReference),
          evaluadoAt: evaluatedAt.toISOString(),
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 },
    )
  }

  list(
    where: Prisma.JornadaOperativaWhereInput,
    orderBy: Prisma.JornadaOperativaOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return prisma.jornadaOperativa.findMany({ where, include: journeyInclude, orderBy, skip, take })
  }

  listReadings(journeyId: number) {
    return prisma.lecturaKilometraje.findMany({
      where: { jornadaOperativaId: journeyId },
      include: { registradoPor: { select: userRefSelect } },
      orderBy: [{ fechaLectura: 'asc' }, { fechaRegistro: 'asc' }, { id: 'asc' }],
    })
  }

  async lockBus(busId: number, tx: JourneyTransaction) {
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM buses WHERE id = ${busId}::integer FOR UPDATE
    `
    return rows.length > 0
  }

  async lockDriver(conductorId: number, tx: JourneyTransaction) {
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM usuarios WHERE id = ${conductorId}::integer FOR UPDATE
    `
    return rows.length > 0
  }

  async lockJourney(journeyId: number, tx: JourneyTransaction) {
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM jornadas_operativas WHERE id = ${journeyId}::integer FOR UPDATE
    `
    return rows.length > 0
  }

  async registerJourneyReading(
    input: {
      actorId: number
      busId: number
      eventDate: Date
      journeyId: number
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

  update(id: number, data: Prisma.JornadaOperativaUncheckedUpdateInput, tx: JourneyTransaction) {
    return tx.jornadaOperativa.update({ where: { id }, data, include: journeyInclude })
  }
}
