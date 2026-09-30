import { randomUUID } from 'node:crypto'

import { type EstadoBus, Prisma } from '@prisma/client'

import { evaluatePreventiveAlertsForBus } from '../alerts/alert.service.js'
import { reconcilePreventiveObligationsForBus } from '../preventive/preventive-reconciliation.js'
import { prisma } from '../prisma/client.js'
import { lockBusMileage } from '../mileage/mileage-lock.js'
import type { RegisterMileageInput } from './fleet.schemas.js'

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
      ordenTrabajo: {
        select: {
          codigo: true,
        },
      },
      registradoPor: {
        select: responsibleSelect,
      },
      observadoPor: { select: responsibleSelect },
    },
    orderBy: {
      fechaRegistro: 'desc',
    },
    take: 20,
  },
  ordenesTrabajo: {
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      codigo: true,
      createdAt: true,
      estado: true,
      fechaCierre: true,
      id: true,
      tipo: true,
    },
    take: 20,
  },
  programacionesMantenimiento: {
    select: {
      actividad: true,
      activa: true,
      criterio: true,
      fechaProgramada: true,
      id: true,
      kilometrajeObjetivo: true,
      planMantenimientoPreventivo: {
        select: {
          anticipacionDias: true,
          anticipacionKm: true,
        },
      },
    },
    take: 20,
    where: {
      activa: true,
    },
  },
  modeloBus: {
    select: modeloBusSelect,
  },
} as const

export type BusDetailRecord = Prisma.BusGetPayload<{ include: typeof busDetailInclude }>
export type BusSummaryRecord = Prisma.BusGetPayload<{ include: typeof busSummaryInclude }>

function generatedBusCode(busId: number) {
  return `BUS-${String(busId).padStart(6, '0')}`
}

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
    data: Omit<Prisma.BusCreateInput, 'codigoInterno'>,
    actorId: number,
    motivoEstado: string | null,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const bus = await tx.bus.create({
          data: {
            ...data,
            codigoInterno: `PENDIENTE-${randomUUID().toUpperCase()}`,
          },
        })
        const preferredCode = generatedBusCode(bus.id)
        const existingBus = await tx.bus.findUnique({
          select: { id: true },
          where: { codigoInterno: preferredCode },
        })
        const codigoInterno = existingBus
          ? `${preferredCode}-${randomUUID().slice(0, 6).toUpperCase()}`
          : preferredCode

        await tx.bus.update({
          data: { codigoInterno },
          where: { id: bus.id },
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

        if (bus.modeloBusId && bus.estadoOperativo !== 'INACTIVO') {
          await reconcilePreventiveObligationsForBus(tx, {
            actorId,
            busId: bus.id,
            previousModeloBusId: null,
          })
        }
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

  findActiveAssignmentWithBusByConductor(conductorId: number) {
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

  findAvailableDrivers(busId?: number) {
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

  findBusDetailById(id: number) {
    return prisma.bus.findUnique({
      where: { id },
      include: busDetailInclude,
    })
  }

  findBusSummaryById(id: number) {
    return prisma.bus.findUnique({
      where: { id },
      include: busSummaryInclude,
    })
  }

  findBusByIdForTransaction(id: number, client: Prisma.TransactionClient) {
    return client.bus.findUnique({
      where: { id },
    })
  }

  findModeloBusById(modeloBusId: number) {
    return prisma.modeloBus.findUnique({
      where: { id: modeloBusId },
      select: modeloBusSelect,
    })
  }

  getAssignments(busId: number, limite: number) {
    return prisma.asignacionConductor.findMany({
      where: { busId },
      include: activeAssignmentInclude,
      orderBy: {
        fechaInicio: 'desc',
      },
      take: limite,
    })
  }

  getMileageReadings(busId: number, limite: number) {
    return prisma.lecturaKilometraje.findMany({
      where: { busId },
      include: {
        ordenTrabajo: {
          select: {
            codigo: true,
          },
        },
        registradoPor: {
          select: responsibleSelect,
        },
        observadoPor: { select: responsibleSelect },
      },
      orderBy: {
        fechaRegistro: 'desc',
      },
      take: limite,
    })
  }

  getStateHistory(busId: number, limite: number) {
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

  registerMileage(busId: number, input: RegisterMileageInput, actorId: number) {
    return prisma.$transaction(
      async (tx) => {
        await lockBusMileage(tx, busId)
        const bus = await this.findBusByIdForTransaction(busId, tx)

        if (!bus) {
          return {
            bus: null,
            lectura: null,
            status: 'NOT_FOUND' as const,
          }
        }

        const observer = await tx.usuario.findUnique({
          where: { id: input.observadoPorId },
          select: { id: true, estado: true },
        })
        if (!observer || observer.estado !== 'ACTIVO') {
          return { bus, lectura: null, status: 'OBSERVER_NOT_FOUND' as const }
        }

        const readings = await tx.lecturaKilometraje.findMany({
          where: { busId },
          select: {
            id: true,
            fechaLectura: true,
            fechaRegistro: true,
            kilometrajeAnterior: true,
            kilometrajeNuevo: true,
          },
        })
        readings.sort(
          (left, right) =>
            (left.fechaLectura ?? left.fechaRegistro).getTime() -
              (right.fechaLectura ?? right.fechaRegistro).getTime() ||
            left.fechaRegistro.getTime() - right.fechaRegistro.getTime() ||
            left.id - right.id,
        )
        const nextIndex = readings.findIndex(
          (reading) =>
            (reading.fechaLectura ?? reading.fechaRegistro).getTime() >
            input.fechaLectura.getTime(),
        )
        const previous =
          nextIndex === 0 ? null : readings[nextIndex < 0 ? readings.length - 1 : nextIndex - 1]
        const next = nextIndex < 0 ? null : readings[nextIndex]
        const previousMileage =
          previous?.kilometrajeNuevo ?? readings[0]?.kilometrajeAnterior ?? bus.kilometrajeActual
        if (
          input.kilometrajeNuevo < previousMileage ||
          (next && input.kilometrajeNuevo > next.kilometrajeNuevo)
        ) {
          return {
            bus,
            lectura: null,
            status: 'MILEAGE_OUT_OF_SEQUENCE' as const,
          }
        }

        const updatedBus = await tx.bus.update({
          where: { id: busId },
          data: {
            kilometrajeActual: Math.max(bus.kilometrajeActual, input.kilometrajeNuevo),
          },
        })

        const reading = await tx.lecturaKilometraje.create({
          data: {
            busId,
            kilometrajeAnterior: previousMileage,
            kilometrajeNuevo: input.kilometrajeNuevo,
            fechaLectura: input.fechaLectura,
            observadoPorId: input.observadoPorId,
            motivo: input.motivo,
            motivoRespaldo: input.motivoRespaldo ?? null,
            contexto: input.contexto,
            tipo: 'AJUSTE_ADMINISTRATIVO',
            registradoPorId: actorId,
          },
          include: {
            ordenTrabajo: {
              select: {
                codigo: true,
              },
            },
            registradoPor: {
              select: responsibleSelect,
            },
            observadoPor: { select: responsibleSelect },
          },
        })

        if (next) {
          await tx.lecturaKilometraje.update({
            where: { id: next.id },
            data: { kilometrajeAnterior: input.kilometrajeNuevo },
          })
        }

        await evaluatePreventiveAlertsForBus(busId, tx)

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

  updateBus(id: number, data: Prisma.BusUpdateInput, actorId: number) {
    return prisma.$transaction(async (tx) => {
      const previous = await tx.bus.findUnique({ where: { id }, select: { modeloBusId: true } })
      const bus = await tx.bus.update({ where: { id }, data, include: busDetailInclude })

      if (previous?.modeloBusId !== bus.modeloBusId) {
        await reconcilePreventiveObligationsForBus(tx, {
          actorId,
          busId: id,
          previousModeloBusId: previous?.modeloBusId ?? null,
        })
      }

      return tx.bus.findUniqueOrThrow({ where: { id }, include: busDetailInclude })
    })
  }

  updateState(busId: number, estadoNuevo: EstadoBus, actorId: number, motivo: string) {
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
