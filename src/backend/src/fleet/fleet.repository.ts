import { type EstadoBus, Prisma } from '@prisma/client'

import { prisma } from '../prisma/client.js'

const responsibleSelect = {
  email: true,
  id: true,
  nombre: true,
  telefono: true,
} as const

const activeAssignmentInclude = {
  asignadoPor: {
    select: responsibleSelect,
  },
  conductor: {
    select: responsibleSelect,
  },
} as const

const modeloBusSelect = {
  activo: true,
  id: true,
  marca: true,
  nombreModelo: true,
  versionTecnica: true,
} as const

export const busSummaryInclude = {
  asignaciones: {
    include: activeAssignmentInclude,
    orderBy: {
      fechaInicio: 'desc',
    },
    take: 1,
    where: {
      activa: true,
    },
  },
  modeloBus: {
    select: modeloBusSelect,
  },
} as const

export const busDetailInclude = {
  asignaciones: {
    include: activeAssignmentInclude,
    orderBy: {
      fechaInicio: 'desc',
    },
    take: 20,
  },
  estadosHistorial: {
    include: {
      cambiadoPor: {
        select: responsibleSelect,
      },
    },
    orderBy: {
      fechaCambio: 'desc',
    },
    take: 20,
  },
  lecturasKilometraje: {
    include: {
      registradoPor: {
        select: responsibleSelect,
      },
    },
    orderBy: {
      fechaRegistro: 'desc',
    },
    take: 20,
  },
  modeloBus: {
    select: modeloBusSelect,
  },
} as const

export type BusDetailRecord = Prisma.BusGetPayload<{ include: typeof busDetailInclude }>
export type BusSummaryRecord = Prisma.BusGetPayload<{ include: typeof busSummaryInclude }>

export class FleetRepository {
  countActiveAssignments() {
    return prisma.asignacionConductor.count({
      where: {
        activa: true,
      },
    })
  }

  countBuses(where: Prisma.BusWhereInput = {}) {
    return prisma.bus.count({ where })
  }

  countBusesByStatus() {
    return prisma.bus.groupBy({
      by: ['estadoOperativo'],
      _count: {
        _all: true,
      },
    })
  }

  countBusesWithoutDriver() {
    return prisma.bus.count({
      where: {
        asignaciones: {
          none: {
            activa: true,
          },
        },
      },
    })
  }

  createBusWithInitialState(
    data: Prisma.BusCreateInput,
    actorId: string,
    motivoEstado: string | null,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const bus = await tx.bus.create({
          data,
          include: busDetailInclude,
        })

        await tx.busEstadoHistorial.create({
          data: {
            busId: bus.id,
            cambiadoPorId: actorId,
            estadoAnterior: null,
            estadoNuevo: bus.estadoOperativo,
            motivo: motivoEstado ?? 'Registro inicial del bus',
          },
        })

        return tx.bus.findUniqueOrThrow({
          where: { id: bus.id },
          include: busDetailInclude,
        })
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  findActiveAssignmentWithBusByConductor(conductorId: string) {
    return prisma.asignacionConductor.findFirst({
      where: {
        activa: true,
        conductorId,
      },
      include: {
        bus: {
          include: busDetailInclude,
        },
        asignadoPor: {
          select: responsibleSelect,
        },
        conductor: {
          select: responsibleSelect,
        },
      },
      orderBy: {
        fechaInicio: 'desc',
      },
    })
  }

  findAvailableDrivers(busId?: string) {
    return prisma.usuario.findMany({
      where: {
        estado: 'ACTIVO',
        rol: {
          codigo: 'CONDUCTOR',
        },
        OR: [
          {
            asignacionesConductor: {
              none: {
                activa: true,
              },
            },
          },
          ...(busId
            ? [
                {
                  asignacionesConductor: {
                    some: {
                      activa: true,
                      busId,
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        asignacionesConductor: {
          include: {
            bus: {
              select: {
                codigoInterno: true,
                id: true,
                placa: true,
              },
            },
          },
          orderBy: {
            fechaInicio: 'desc',
          },
          take: 1,
          where: {
            activa: true,
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    })
  }

  findBusDetailById(id: string) {
    return prisma.bus.findUnique({
      where: { id },
      include: busDetailInclude,
    })
  }

  findBusSummaryById(id: string) {
    return prisma.bus.findUnique({
      where: { id },
      include: busSummaryInclude,
    })
  }

  findBusByIdForTransaction(id: string, client: Prisma.TransactionClient) {
    return client.bus.findUnique({
      where: { id },
    })
  }

  findModeloBusById(modeloBusId: string) {
    return prisma.modeloBus.findUnique({
      where: { id: modeloBusId },
      select: modeloBusSelect,
    })
  }

  getAssignments(busId: string, limite: number) {
    return prisma.asignacionConductor.findMany({
      where: { busId },
      include: activeAssignmentInclude,
      orderBy: {
        fechaInicio: 'desc',
      },
      take: limite,
    })
  }

  getMileageReadings(busId: string, limite: number) {
    return prisma.lecturaKilometraje.findMany({
      where: { busId },
      include: {
        registradoPor: {
          select: responsibleSelect,
        },
      },
      orderBy: {
        fechaRegistro: 'desc',
      },
      take: limite,
    })
  }

  getStateHistory(busId: string, limite: number) {
    return prisma.busEstadoHistorial.findMany({
      where: { busId },
      include: {
        cambiadoPor: {
          select: responsibleSelect,
        },
      },
      orderBy: {
        fechaCambio: 'desc',
      },
      take: limite,
    })
  }

  listBuses(where: Prisma.BusWhereInput, skip: number, take: number) {
    return prisma.bus.findMany({
      where,
      include: busSummaryInclude,
      orderBy: [
        {
          codigoInterno: 'asc',
        },
        {
          placa: 'asc',
        },
      ],
      skip,
      take,
    })
  }

  registerMileage(busId: string, kilometrajeNuevo: number, actorId: string, motivo: string | null) {
    return prisma.$transaction(
      async (tx) => {
        const bus = await this.findBusByIdForTransaction(busId, tx)

        if (!bus) {
          return {
            bus: null,
            lectura: null,
            status: 'NOT_FOUND' as const,
          }
        }

        if (kilometrajeNuevo < bus.kilometrajeActual) {
          return {
            bus,
            lectura: null,
            status: 'MILEAGE_DECREASE' as const,
          }
        }

        const updatedBus = await tx.bus.update({
          where: { id: busId },
          data: {
            kilometrajeActual: kilometrajeNuevo,
          },
        })

        const reading = await tx.lecturaKilometraje.create({
          data: {
            busId,
            kilometrajeAnterior: bus.kilometrajeActual,
            kilometrajeNuevo,
            motivo,
            registradoPorId: actorId,
          },
          include: {
            registradoPor: {
              select: responsibleSelect,
            },
          },
        })

        return {
          bus: updatedBus,
          lectura: reading,
          status: 'OK' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  updateBus(id: string, data: Prisma.BusUpdateInput) {
    return prisma.bus.update({
      where: { id },
      data,
      include: busDetailInclude,
    })
  }

  updateState(busId: string, estadoNuevo: EstadoBus, actorId: string, motivo: string) {
    return prisma.$transaction(
      async (tx) => {
        const bus = await this.findBusByIdForTransaction(busId, tx)

        if (!bus) {
          return {
            bus: null,
            historial: null,
            status: 'NOT_FOUND' as const,
          }
        }

        if (bus.estadoOperativo === estadoNuevo) {
          return {
            bus,
            historial: null,
            status: 'SAME_STATE' as const,
          }
        }

        const updatedBus = await tx.bus.update({
          where: { id: busId },
          data: {
            estadoOperativo: estadoNuevo,
          },
        })

        const stateHistory = await tx.busEstadoHistorial.create({
          data: {
            busId,
            cambiadoPorId: actorId,
            estadoAnterior: bus.estadoOperativo,
            estadoNuevo: updatedBus.estadoOperativo,
            motivo,
          },
          include: {
            cambiadoPor: {
              select: responsibleSelect,
            },
          },
        })

        return {
          bus: updatedBus,
          historial: stateHistory,
          status: 'OK' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }
}
