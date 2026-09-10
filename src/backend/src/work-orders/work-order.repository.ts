import { randomUUID } from 'node:crypto'

import {
  Prisma,
  type EstadoOrdenTrabajo,
  type OrigenOrdenTrabajo,
  type PrioridadOrden,
  type TipoOrdenTrabajo,
} from '@prisma/client'

import {
  createConsumptionIncompatibilityAlert,
  createLowInventoryAlert,
  createWorkOrderAssignedAlert,
  createWorkOrderCompletedAlert,
  createWorkOrderPendingAlert,
  createWorkOrderReturnedAlert,
  evaluatePreventiveAlertsForBus,
} from '../alerts/alert.service.js'
import { buildAvailability } from '../availability/availability.policy.js'
import { getAvailabilityRecords } from '../availability/availability.repository.js'
import { registerTechnicalMileageReading } from '../mileage/technical-mileage.js'
import { prisma } from '../prisma/client.js'
import {
  hasValidPreventivePlanSnapshot,
  nextPreventiveTargets,
  type PreventiveCycleTargets,
  type PreventivePlanCycleData,
} from '../preventive/preventive-cycle.js'
import { reassignableWorkOrderStates } from './work-order.state.js'
import { resolveCompatibility } from '../spare-parts/compatibility.resolver.js'

type WorkOrderDbClient = Prisma.TransactionClient | typeof prisma

const userSelect = {
  email: true,
  id: true,
  nombre: true,
  telefono: true,
} as const

const authorizationActorSelect = {
  id: true,
  nombre: true,
} as const

const busSelect = {
  anio: true,
  codigoInterno: true,
  estadoOperativo: true,
  id: true,
  kilometrajeActual: true,
  marca: true,
  modelo: true,
  placa: true,
} as const

const sparePartSelect = {
  categoria: true,
  codigo: true,
  costoUnitario: true,
  estado: true,
  id: true,
  nombre: true,
  stockActual: true,
  stockMinimo: true,
  unidadMedida: true,
} as const

const technicalReadingOrderBy: Prisma.LecturaKilometrajeOrderByWithRelationInput[] = [
  { fechaLectura: 'asc' },
  { fechaRegistro: 'asc' },
  { id: 'asc' },
]

export const workOrderDetailInclude = {
  autorizacionesExcepcion: {
    include: {
      autorizadoPor: { select: authorizationActorSelect },
      repuesto: { select: sparePartSelect },
    },
    orderBy: { fechaAutorizacion: 'desc' as const },
  },
  bus: {
    select: busSelect,
  },
  cerradaPor: {
    select: userSelect,
  },
  consumosRepuesto: {
    include: {
      movimientoInventario: true,
      repuesto: {
        select: sparePartSelect,
      },
    },
    orderBy: {
      fechaConsumo: 'asc',
    },
  },
  creadaPor: {
    select: userSelect,
  },
  estadosHistorial: {
    include: {
      cambiadoPor: {
        select: userSelect,
      },
    },
    orderBy: {
      fechaCambio: 'asc',
    },
  },
  intervenciones: {
    include: {
      actividades: {
        include: {
          registradaPor: {
            select: userSelect,
          },
        },
        orderBy: {
          fechaRegistro: 'asc',
        },
      },
      tecnico: {
        select: userSelect,
      },
    },
    orderBy: {
      fechaInicio: 'asc',
    },
  },
  jornadaOperativa: {
    select: {
      estado: true,
      finProgramado: true,
      finReal: true,
      id: true,
      inicioProgramado: true,
      inicioReal: true,
      ruta: { select: { codigo: true, id: true, nombre: true } },
    },
  },
  lecturasKilometraje: {
    include: {
      registradoPor: { select: userSelect },
    },
    orderBy: technicalReadingOrderBy,
  },
  novedad: {
    select: {
      clasificacion: true,
      conductor: {
        select: userSelect,
      },
      descripcion: true,
      estado: true,
      fechaReporte: true,
      id: true,
      tipo: true,
    },
  },
  programacionMantenimiento: {
    select: {
      activa: true,
      actividad: true,
      busId: true,
      createdAt: true,
      criterio: true,
      fechaProgramada: true,
      id: true,
      kilometrajeObjetivo: true,
      planMantenimientoPreventivo: true,
      prioridad: true,
      tipo: true,
    },
  },
  reasignaciones: {
    include: {
      reasignadoPor: {
        select: userSelect,
      },
      tecnicoAnterior: {
        select: userSelect,
      },
      tecnicoNuevo: {
        select: userSelect,
      },
    },
    orderBy: {
      fechaReasignacion: 'asc',
    },
  },
  tecnicoAsignado: {
    select: userSelect,
  },
} as const

export type WorkOrderRecord = Prisma.OrdenTrabajoGetPayload<{
  include: typeof workOrderDetailInclude
}>

export type MechanicRecord = Prisma.UsuarioGetPayload<{
  select: typeof userSelect
}>

export type SparePartRecord = Prisma.RepuestoGetPayload<{
  select: typeof sparePartSelect
}>

export type ConsumptionRecord = WorkOrderRecord['consumosRepuesto'][number]

interface CreateManualOrderData {
  busId: string
  descripcion: string
  prioridad: PrioridadOrden
}

interface AssignData {
  observacion: string | null
  tecnicoId: string
}

interface ReassignData {
  motivo: string
  tecnicoId: string
}

interface UpdateInterventionData {
  diagnostico?: string
  observaciones?: string
}

interface ConsumptionData {
  autorizacionExcepcionId?: string
  cantidad: Prisma.Decimal
  claveIdempotencia: string
  repuestoId: string
}

interface ConsumptionExceptionData {
  cantidadMaxima: Prisma.Decimal
  fechaExpiracion: Date | null
  intervencionId: string
  motivo: string
  repuestoId: string
}

export interface TechnicalReadingData {
  fechaEvento: Date
  kilometraje: number
  motivo: string | null
  tipo: 'INGRESO_TALLER' | 'REVISION_TECNICA' | 'CIERRE_MANTENIMIENTO'
}

export interface DispatchOrderProjectionRecord {
  disponibilidad: ReturnType<typeof buildAvailability>
  orden: {
    bus: { codigoInterno: string; id: string; placa: string }
    codigo: string
    disponibilidadAlCierre: boolean | null
    estado: EstadoOrdenTrabajo
    fechaCierre: Date | null
    id: string
  }
}

export class WorkOrderRepository {
  listDispatchProjections(): Promise<DispatchOrderProjectionRecord[]> {
    return this.buildDispatchProjections()
  }

  private async buildDispatchProjections(): Promise<DispatchOrderProjectionRecord[]> {
    const orders = await prisma.ordenTrabajo.findMany({
      orderBy: { fechaCreacion: 'desc' },
      select: {
        bus: { select: { codigoInterno: true, id: true, placa: true } },
        busId: true,
        codigo: true,
        disponibilidadAlCierre: true,
        estado: true,
        fechaCierre: true,
        id: true,
        jornadaOperativaId: true,
      },
      take: 100,
    })
    const evaluatedAt = new Date()
    const availabilityByScope = new Map<string, ReturnType<typeof getAvailabilityRecords>>()

    return Promise.all(
      orders.map(async (order) => {
        const scopeKey = `${order.busId}:${order.jornadaOperativaId ?? ''}`
        let availability = availabilityByScope.get(scopeKey)

        if (!availability) {
          availability = getAvailabilityRecords(
            {
              busId: order.busId,
              eventDate: evaluatedAt,
              journeyId: order.jornadaOperativaId,
            },
            prisma,
          )
          availabilityByScope.set(scopeKey, availability)
        }

        return {
          disponibilidad: buildAvailability(await availability),
          orden: {
            bus: order.bus,
            codigo: order.codigo,
            disponibilidadAlCierre: order.disponibilidadAlCierre,
            estado: order.estado,
            fechaCierre: order.fechaCierre,
            id: order.id,
          },
        }
      }),
    )
  }

  countOrders(where: Prisma.OrdenTrabajoWhereInput = {}) {
    return prisma.ordenTrabajo.count({ where })
  }

  countOrdersByState(where: Prisma.OrdenTrabajoWhereInput = {}) {
    return prisma.ordenTrabajo.groupBy({
      by: ['estado'],
      where,
      _count: {
        _all: true,
      },
    })
  }

  countOrdersByOrigin(where: Prisma.OrdenTrabajoWhereInput = {}) {
    return prisma.ordenTrabajo.groupBy({
      by: ['origen'],
      where,
      _count: {
        _all: true,
      },
    })
  }

  countOrdersByType(where: Prisma.OrdenTrabajoWhereInput = {}) {
    return prisma.ordenTrabajo.groupBy({
      by: ['tipo'],
      where,
      _count: {
        _all: true,
      },
    })
  }

  listOrders(
    where: Prisma.OrdenTrabajoWhereInput,
    orderBy: Prisma.OrdenTrabajoOrderByWithRelationInput[],
    skip: number,
    take: number,
  ) {
    return prisma.ordenTrabajo.findMany({
      where,
      include: workOrderDetailInclude,
      orderBy,
      skip,
      take,
    })
  }

  findOrderById(id: string) {
    return prisma.ordenTrabajo.findUnique({
      where: { id },
      include: workOrderDetailInclude,
    })
  }

  findConsumptionByIdempotencyKey(claveIdempotencia: string) {
    return prisma.consumoRepuesto.findFirst({
      where: { claveIdempotencia },
      include: {
        movimientoInventario: true,
        repuesto: {
          select: sparePartSelect,
        },
      },
    })
  }

  findMechanicById(id: string) {
    return prisma.usuario.findUnique({
      where: { id },
      include: {
        rol: true,
      },
    })
  }

  findAvailableMechanics(busqueda: string | undefined, take: number) {
    return prisma.usuario.findMany({
      where: {
        estado: 'ACTIVO',
        rol: {
          codigo: 'MECANICO',
        },
        ...(busqueda
          ? {
              OR: [
                {
                  nombre: {
                    contains: busqueda,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: busqueda,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      select: userSelect,
      orderBy: {
        nombre: 'asc',
      },
      take,
    })
  }

  findAvailableSpareParts(busqueda: string | undefined, take: number, busId?: string) {
    return prisma.$transaction(async (tx) => {
      const parts = await tx.repuesto.findMany({
        where: {
          estado: 'ACTIVO',
          stockActual: { gt: 0 },
          ...(busqueda
            ? {
                OR: [
                  { codigo: { contains: busqueda, mode: 'insensitive' } },
                  { nombre: { contains: busqueda, mode: 'insensitive' } },
                  { categoria: { contains: busqueda, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: sparePartSelect,
        orderBy: { codigo: 'asc' },
        take,
      })
      if (!busId) return parts.map((part) => ({ ...part, evaluacion: null }))
      return Promise.all(
        parts.map(async (part) => ({
          ...part,
          evaluacion: await resolveCompatibility(tx, busId, part.id),
        })),
      )
    })
  }

  findClosedOrdersByBus(busId: string, excludeOrderId: string, take = 5) {
    return prisma.ordenTrabajo.findMany({
      where: {
        busId,
        estado: 'CERRADA',
        id: {
          not: excludeOrderId,
        },
      },
      include: {
        intervenciones: {
          orderBy: {
            fechaInicio: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        fechaCierre: 'desc',
      },
      take,
    })
  }

  createManualOrder(actorId: string, data: CreateManualOrderData) {
    return prisma.$transaction(
      async (tx) => {
        const bus = await tx.bus.findUnique({
          where: { id: data.busId },
        })

        if (!bus) {
          return {
            orden: null,
            status: 'BUS_NOT_FOUND' as const,
          }
        }

        if (bus.estadoOperativo === 'INACTIVO') {
          return {
            orden: null,
            status: 'BUS_INACTIVE' as const,
          }
        }

        const order = await tx.ordenTrabajo.create({
          data: {
            busId: data.busId,
            codigo: this.createDirectOrderCode(),
            creadaPorId: actorId,
            descripcion: data.descripcion,
            estado: 'PENDIENTE_ASIGNACION',
            origen: 'CORRECTIVO_DIRECTO',
            prioridad: data.prioridad,
            tecnicoAsignadoId: null,
            tipo: 'CORRECTIVA',
          },
        })

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: null,
            estadoNuevo: 'PENDIENTE_ASIGNACION',
            observacion: 'Orden correctiva directa creada manualmente',
            ordenTrabajoId: order.id,
          },
        })

        await createWorkOrderPendingAlert(
          {
            busCodigo: bus.codigoInterno,
            eventAt: order.createdAt,
            orderCode: order.codigo,
            orderId: order.id,
          },
          tx,
        )

        return {
          orden: await this.findOrderByIdForTransaction(order.id, tx),
          status: 'CREATED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  assignMechanic(orderId: string, actorId: string, data: AssignData) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)
        const mechanic = await this.findMechanicByIdForTransaction(data.tecnicoId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        if (!this.isValidMechanic(mechanic)) {
          return {
            orden: order,
            status: 'INVALID_MECHANIC' as const,
          }
        }

        if (order.estado !== 'PENDIENTE_ASIGNACION') {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        const now = new Date()

        const assignment = await tx.ordenTrabajo.updateMany({
          where: { estado: 'PENDIENTE_ASIGNACION', id: orderId },
          data: {
            estado: 'ASIGNADA',
            fechaAsignacion: now,
            tecnicoAsignadoId: data.tecnicoId,
          },
        })

        if (assignment.count !== 1) {
          return {
            orden: await this.findOrderByIdForTransaction(orderId, tx),
            status: 'INVALID_STATE' as const,
          }
        }

        const history = await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'PENDIENTE_ASIGNACION',
            estadoNuevo: 'ASIGNADA',
            observacion: data.observacion ?? 'Orden asignada a mecanico',
            ordenTrabajoId: orderId,
          },
        })

        await createWorkOrderAssignedAlert(
          {
            busCodigo: order.bus.codigoInterno,
            eventAt: now,
            mechanicId: data.tecnicoId,
            occurrenceId: history.id,
            orderCode: order.codigo,
            orderId,
          },
          tx,
        )

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'ASSIGNED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  reassignMechanic(orderId: string, actorId: string, data: ReassignData) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)
        const mechanic = await this.findMechanicByIdForTransaction(data.tecnicoId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        if (!this.isValidMechanic(mechanic)) {
          return {
            orden: order,
            status: 'INVALID_MECHANIC' as const,
          }
        }

        if (!reassignableWorkOrderStates.includes(order.estado)) {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        if (order.tecnicoAsignadoId === data.tecnicoId) {
          return {
            orden: order,
            status: 'SAME_MECHANIC' as const,
          }
        }

        const now = new Date()

        const reassigned = await tx.ordenTrabajo.updateMany({
          where: {
            estado: order.estado,
            id: orderId,
            tecnicoAsignadoId: order.tecnicoAsignadoId,
          },
          data: {
            ...(order.estado === 'ASIGNADA' ? { fechaAsignacion: now } : {}),
            tecnicoAsignadoId: data.tecnicoId,
          },
        })

        if (reassigned.count !== 1) {
          return {
            orden: await this.findOrderByIdForTransaction(orderId, tx),
            status: 'INVALID_STATE' as const,
          }
        }

        if (order.estado === 'EN_EJECUCION') {
          await tx.intervencion.updateMany({
            where: {
              fechaFin: null,
              ordenTrabajoId: orderId,
            },
            data: {
              fechaFin: now,
            },
          })

          await tx.intervencion.create({
            data: {
              fechaInicio: now,
              ordenTrabajoId: orderId,
              tecnicoId: data.tecnicoId,
            },
          })
        }

        const reassignment = await tx.ordenReasignacion.create({
          data: {
            fechaReasignacion: now,
            motivo: data.motivo,
            ordenTrabajoId: orderId,
            reasignadoPorId: actorId,
            tecnicoAnteriorId: order.tecnicoAsignadoId,
            tecnicoNuevoId: data.tecnicoId,
          },
        })

        await createWorkOrderAssignedAlert(
          {
            busCodigo: order.bus.codigoInterno,
            eventAt: now,
            mechanicId: data.tecnicoId,
            occurrenceId: reassignment.id,
            orderCode: order.codigo,
            orderId,
          },
          tx,
        )

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'REASSIGNED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  startOrder(orderId: string, actorId: string, observacion: string | null) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        if (order.tecnicoAsignadoId !== actorId) {
          return {
            orden: order,
            status: 'NOT_ASSIGNED_MECHANIC' as const,
          }
        }

        if (order.estado !== 'ASIGNADA') {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        const now = new Date()

        const started = await tx.ordenTrabajo.updateMany({
          where: {
            estado: 'ASIGNADA',
            id: orderId,
            tecnicoAsignadoId: actorId,
          },
          data: {
            estado: 'EN_EJECUCION',
            fechaInicioEjecucion: now,
          },
        })

        if (started.count !== 1) {
          return {
            orden: await this.findOrderByIdForTransaction(orderId, tx),
            status: 'INVALID_STATE' as const,
          }
        }

        await tx.intervencion.create({
          data: {
            fechaInicio: now,
            ordenTrabajoId: orderId,
            tecnicoId: actorId,
          },
        })

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'ASIGNADA',
            estadoNuevo: 'EN_EJECUCION',
            observacion: observacion ?? 'Inicio de ejecucion tecnica',
            ordenTrabajoId: orderId,
          },
        })

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'STARTED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  resumeOrder(orderId: string, actorId: string, observacion: string | null) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        if (order.tecnicoAsignadoId !== actorId) {
          return {
            orden: order,
            status: 'NOT_ASSIGNED_MECHANIC' as const,
          }
        }

        if (order.estado !== 'DEVUELTA_CORRECCION') {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        const now = new Date()

        const resumed = await tx.ordenTrabajo.updateMany({
          where: {
            estado: 'DEVUELTA_CORRECCION',
            id: orderId,
            tecnicoAsignadoId: actorId,
          },
          data: {
            estado: 'EN_EJECUCION',
            fechaCompletadaTecnico: null,
            fechaInicioEjecucion: order.fechaInicioEjecucion ?? now,
          },
        })

        if (resumed.count !== 1) {
          return {
            orden: await this.findOrderByIdForTransaction(orderId, tx),
            status: 'INVALID_STATE' as const,
          }
        }

        await tx.intervencion.create({
          data: {
            fechaInicio: now,
            ordenTrabajoId: orderId,
            tecnicoId: actorId,
          },
        })

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'DEVUELTA_CORRECCION',
            estadoNuevo: 'EN_EJECUCION',
            observacion: observacion ?? 'Reanudacion de orden devuelta a correccion',
            ordenTrabajoId: orderId,
          },
        })

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'RESUMED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  updateActiveIntervention(orderId: string, actorId: string, data: UpdateInterventionData) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        const intervention = await this.findActiveIntervention(tx, orderId, actorId)

        if (order.tecnicoAsignadoId !== actorId) {
          return {
            orden: order,
            status: 'NOT_ASSIGNED_MECHANIC' as const,
          }
        }

        if (order.estado !== 'EN_EJECUCION') {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        if (!intervention) {
          return {
            orden: order,
            status: 'NO_ACTIVE_INTERVENTION' as const,
          }
        }

        await tx.intervencion.update({
          where: { id: intervention.id },
          data,
        })

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'UPDATED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  createActivity(orderId: string, actorId: string, descripcion: string) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        const intervention = await this.findActiveIntervention(tx, orderId, actorId)

        if (order.tecnicoAsignadoId !== actorId) {
          return {
            orden: order,
            status: 'NOT_ASSIGNED_MECHANIC' as const,
          }
        }

        if (order.estado !== 'EN_EJECUCION') {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        if (!intervention) {
          return {
            orden: order,
            status: 'NO_ACTIVE_INTERVENTION' as const,
          }
        }

        await tx.actividadOrden.create({
          data: {
            descripcion,
            intervencionId: intervention.id,
            registradaPorId: actorId,
          },
        })

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'CREATED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  createTechnicalReading(
    orderId: string,
    actorId: string,
    actorRole: 'ADMINISTRADOR' | 'MECANICO',
    data: TechnicalReadingData,
  ) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) return { orden: null, status: 'ORDER_NOT_FOUND' as const }
        if (actorRole === 'MECANICO' && order.tecnicoAsignadoId !== actorId) {
          return { orden: order, status: 'NOT_ASSIGNED_MECHANIC' as const }
        }
        if (order.estado === 'CERRADA') return { orden: order, status: 'INVALID_STATE' as const }

        let interventionId: string | undefined
        if (data.tipo === 'REVISION_TECNICA') {
          const activeIntervention = await tx.intervencion.findFirst({
            where: {
              fechaFin: null,
              ordenTrabajoId: orderId,
              ...(actorRole === 'MECANICO' ? { tecnicoId: actorId } : {}),
            },
            orderBy: { fechaInicio: 'desc' },
            select: { id: true },
          })
          if (!activeIntervention)
            return { orden: order, status: 'NO_ACTIVE_INTERVENTION' as const }
          interventionId = activeIntervention.id
        }

        if (data.tipo === 'CIERRE_MANTENIMIENTO' && actorRole !== 'ADMINISTRADOR') {
          return { orden: order, status: 'FORBIDDEN_TECHNICAL_CLOSURE' as const }
        }
        if (data.tipo === 'CIERRE_MANTENIMIENTO' && order.estado !== 'COMPLETADA_TECNICO') {
          return { orden: order, status: 'INVALID_STATE' as const }
        }
        if (
          data.tipo !== 'CIERRE_MANTENIMIENTO' &&
          !['ASIGNADA', 'EN_EJECUCION', 'DEVUELTA_CORRECCION'].includes(order.estado)
        ) {
          return { orden: order, status: 'INVALID_STATE' as const }
        }

        await registerTechnicalMileageReading(
          {
            actorId,
            busId: order.busId,
            eventDate: data.fechaEvento,
            ...(interventionId ? { interventionId } : {}),
            mileage: data.kilometraje,
            ...(data.motivo ? { motivo: data.motivo } : {}),
            orderId,
            type: data.tipo,
          },
          tx,
        )

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'TECHNICAL_READING_CREATED' as const,
        }
      },
      { maxWait: 15000, timeout: 60000 },
    )
  }

  authorizeConsumptionException(orderId: string, actorId: string, data: ConsumptionExceptionData) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)
        if (!order) return { autorizacion: null, status: 'ORDER_NOT_FOUND' as const }
        if (order.estado !== 'EN_EJECUCION')
          return { autorizacion: null, status: 'INVALID_STATE' as const }
        const intervention = await tx.intervencion.findFirst({
          where: { fechaFin: null, id: data.intervencionId, ordenTrabajoId: orderId },
        })
        if (!intervention || intervention.id !== data.intervencionId) {
          return { autorizacion: null, status: 'INTERVENTION_NOT_ACTIVE' as const }
        }
        const part = await this.lockSparePart(tx, data.repuestoId)
        if (!part) return { autorizacion: null, status: 'SPARE_PART_NOT_FOUND' as const }
        if (part.estado !== 'ACTIVO')
          return { autorizacion: null, status: 'SPARE_PART_INACTIVE' as const }
        const autorizacion = await tx.autorizacionExcepcionConsumo.create({
          data: {
            cantidadMaxima: data.cantidadMaxima,
            fechaExpiracion: data.fechaExpiracion,
            id: randomUUID(),
            intervencionId: data.intervencionId,
            motivo: data.motivo,
            ordenTrabajoId: orderId,
            repuestoId: data.repuestoId,
            autorizadoPorId: actorId,
          },
        })
        return { autorizacion, status: 'CREATED' as const }
      },
      { maxWait: 15000, timeout: 60000 },
    )
  }

  revokeConsumptionException(orderId: string, authorizationId: string) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const authorization = await tx.autorizacionExcepcionConsumo.findFirst({
          where: { id: authorizationId, ordenTrabajoId: orderId },
        })
        if (!authorization) return { autorizacion: null, status: 'NOT_FOUND' as const }
        if (authorization.estado !== 'VIGENTE') {
          return { autorizacion: authorization, status: 'INVALID_STATE' as const }
        }
        const updated = await tx.autorizacionExcepcionConsumo.update({
          data: { estado: 'REVOCADA' },
          where: { id: authorizationId },
        })
        return { autorizacion: updated, status: 'REVOKED' as const }
      },
      { maxWait: 15000, timeout: 60000 },
    )
  }

  createConsumption(orderId: string, actorId: string, data: ConsumptionData) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) {
          return {
            consumo: null,
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        const existing = await tx.consumoRepuesto.findFirst({
          where: {
            claveIdempotencia: data.claveIdempotencia,
          },
          include: {
            movimientoInventario: true,
            repuesto: {
              select: sparePartSelect,
            },
          },
        })

        if (existing) {
          if (
            existing.ordenTrabajoId !== orderId ||
            existing.consumidoPorId !== actorId ||
            existing.repuestoId !== data.repuestoId ||
            !existing.cantidad.equals(data.cantidad)
          ) {
            return {
              consumo: existing,
              orden: order,
              status: 'IDEMPOTENCY_CONFLICT' as const,
            }
          }

          return {
            consumo: existing,
            orden: order,
            status: 'ALREADY_CREATED' as const,
          }
        }

        const intervention = await this.findActiveIntervention(tx, orderId, actorId)

        if (order.tecnicoAsignadoId !== actorId) {
          return {
            consumo: null,
            orden: order,
            status: 'NOT_ASSIGNED_MECHANIC' as const,
          }
        }

        if (order.estado !== 'EN_EJECUCION') {
          return {
            consumo: null,
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        if (!intervention) {
          return {
            consumo: null,
            orden: order,
            status: 'NO_ACTIVE_INTERVENTION' as const,
          }
        }

        const part = await this.lockSparePart(tx, data.repuestoId)

        if (!part) {
          return {
            consumo: null,
            orden: order,
            status: 'SPARE_PART_NOT_FOUND' as const,
          }
        }

        if (part.estado !== 'ACTIVO') {
          return {
            consumo: null,
            orden: order,
            status: 'SPARE_PART_INACTIVE' as const,
          }
        }

        const evaluation = await resolveCompatibility(tx, order.busId, data.repuestoId)
        let exception: {
          autorizadoPorId: string
          fechaAutorizacion: Date
          id: string
          motivo: string
        } | null = null

        if (data.autorizacionExcepcionId) {
          const authorization = await tx.autorizacionExcepcionConsumo.findUnique({
            where: { id: data.autorizacionExcepcionId },
          })
          if (
            !authorization ||
            authorization.estado !== 'VIGENTE' ||
            authorization.ordenTrabajoId !== orderId ||
            authorization.intervencionId !== intervention.id ||
            authorization.repuestoId !== data.repuestoId ||
            data.cantidad.greaterThan(authorization.cantidadMaxima) ||
            (authorization.fechaExpiracion && authorization.fechaExpiracion <= new Date())
          ) {
            return { consumo: null, orden: order, status: 'INVALID_EXCEPTION' as const }
          }
          if (evaluation.resultado === 'COMPATIBLE') {
            return { consumo: null, orden: order, status: 'EXCEPTION_NOT_NEEDED' as const }
          }
          exception = authorization
        } else if (evaluation.resultado !== 'COMPATIBLE') {
          await createConsumptionIncompatibilityAlert(
            {
              busCodigo: order.bus.codigoInterno,
              busId: order.bus.id,
              claveIdempotencia: data.claveIdempotencia,
              contexto: evaluation.evidencia,
              ordenId: orderId,
              repuestoCodigo: part.codigo,
              repuestoId: data.repuestoId,
              tecnicoAsignadoId: order.tecnicoAsignadoId,
            },
            tx,
          )
          return { consumo: null, orden: order, status: 'INCOMPATIBLE' as const }
        }

        if (part.stockActual.lessThan(data.cantidad)) {
          return {
            consumo: null,
            orden: order,
            status: 'INSUFFICIENT_STOCK' as const,
          }
        }

        const subtotal = data.cantidad.mul(part.costoUnitario).toDecimalPlaces(2)

        const stockUpdate = await tx.repuesto.updateMany({
          where: {
            id: data.repuestoId,
            stockActual: {
              gte: data.cantidad,
            },
          },
          data: {
            stockActual: {
              decrement: data.cantidad,
            },
          },
        })

        if (stockUpdate.count !== 1) {
          return {
            consumo: null,
            orden: order,
            status: 'INSUFFICIENT_STOCK' as const,
          }
        }

        const consumption = await tx.consumoRepuesto.create({
          data: {
            cantidad: data.cantidad,
            claveIdempotencia: data.claveIdempotencia,
            consumidoPorId: actorId,
            costoUnitario: part.costoUnitario,
            autorizadoPorId: exception?.autorizadoPorId,
            autorizacionExcepcionId: exception?.id,
            evidenciaCompatibilidad: evaluation.evidencia,
            fechaAutorizacion: exception?.fechaAutorizacion,
            intervencionId: intervention.id,
            ordenTrabajoId: orderId,
            repuestoId: data.repuestoId,
            motivoExcepcion: exception?.motivo,
            ...(exception
              ? { resultadoCompatibilidad: 'EXCEPCION_AUTORIZADA' as const }
              : {
                  reglaCompatibilidadId: evaluation.regla!.id,
                  reglaVersion: evaluation.regla!.version,
                  resultadoCompatibilidad: 'COMPATIBLE' as const,
                }),
            subtotal,
          },
        })

        if (exception) {
          await tx.autorizacionExcepcionConsumo.update({
            data: { estado: 'USADA' },
            where: { id: exception.id },
          })
        }

        await tx.movimientoInventario.create({
          data: {
            cantidad: data.cantidad,
            consumoRepuestoId: consumption.id,
            costoUnitario: part.costoUnitario,
            motivo: `Consumo asociado a orden ${order.codigo}`,
            repuestoId: data.repuestoId,
            responsableId: actorId,
            tipo: 'CONSUMO',
          },
        })

        const remainingStock = part.stockActual.sub(data.cantidad)
        if (
          part.stockActual.greaterThan(part.stockMinimo) &&
          remainingStock.lessThanOrEqualTo(part.stockMinimo)
        ) {
          const movement = await tx.movimientoInventario.findUniqueOrThrow({
            select: { id: true, fechaMovimiento: true },
            where: { consumoRepuestoId: consumption.id },
          })
          await createLowInventoryAlert(
            {
              eventAt: movement.fechaMovimiento,
              movementId: movement.id,
              partCode: part.codigo,
              partId: part.id,
              stockActual: remainingStock.toNumber(),
            },
            tx,
          )
        }

        await tx.ordenTrabajo.update({
          where: { id: orderId },
          data: {
            costoTotal: {
              increment: subtotal,
            },
          },
        })

        const consumo = await tx.consumoRepuesto.findUniqueOrThrow({
          where: { id: consumption.id },
          include: {
            movimientoInventario: true,
            repuesto: {
              select: sparePartSelect,
            },
          },
        })

        return {
          consumo,
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'CREATED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  completeTechnical(orderId: string, actorId: string, observacion: string | null) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        const intervention = await this.findActiveIntervention(tx, orderId, actorId)

        if (order.tecnicoAsignadoId !== actorId) {
          return {
            orden: order,
            status: 'NOT_ASSIGNED_MECHANIC' as const,
          }
        }

        if (order.estado !== 'EN_EJECUCION') {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        if (!intervention) {
          return {
            orden: order,
            status: 'NO_ACTIVE_INTERVENTION' as const,
          }
        }

        const [activityCount, diagnosticCount] = await Promise.all([
          tx.actividadOrden.count({
            where: {
              intervencionId: intervention.id,
            },
          }),
          tx.intervencion.count({
            where: {
              diagnostico: {
                not: null,
              },
              ordenTrabajoId: orderId,
            },
          }),
        ])

        if (activityCount === 0) {
          return {
            orden: order,
            status: 'MISSING_ACTIVITY' as const,
          }
        }

        if (order.tipo === 'CORRECTIVA' && diagnosticCount === 0) {
          return {
            orden: order,
            status: 'MISSING_DIAGNOSIS' as const,
          }
        }

        const now = new Date()

        const completed = await tx.ordenTrabajo.updateMany({
          where: {
            estado: 'EN_EJECUCION',
            id: orderId,
            tecnicoAsignadoId: actorId,
          },
          data: {
            estado: 'COMPLETADA_TECNICO',
            fechaCompletadaTecnico: now,
          },
        })

        if (completed.count !== 1) {
          return {
            orden: await this.findOrderByIdForTransaction(orderId, tx),
            status: 'INVALID_STATE' as const,
          }
        }

        await tx.intervencion.update({
          where: { id: intervention.id },
          data: {
            fechaFin: now,
          },
        })

        const history = await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'EN_EJECUCION',
            estadoNuevo: 'COMPLETADA_TECNICO',
            observacion: observacion ?? 'Trabajo tecnico marcado como completado',
            ordenTrabajoId: orderId,
          },
        })

        await createWorkOrderCompletedAlert(
          {
            busCodigo: order.bus.codigoInterno,
            eventAt: now,
            occurrenceId: history.id,
            orderCode: order.codigo,
            orderId,
          },
          tx,
        )

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'COMPLETED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  returnForCorrection(orderId: string, actorId: string, motivo: string) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        if (order.estado !== 'COMPLETADA_TECNICO') {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        if (!order.tecnicoAsignadoId) {
          return {
            orden: order,
            status: 'MISSING_MECHANIC' as const,
          }
        }

        const returned = await tx.ordenTrabajo.updateMany({
          where: {
            estado: 'COMPLETADA_TECNICO',
            id: orderId,
          },
          data: {
            estado: 'DEVUELTA_CORRECCION',
          },
        })

        if (returned.count !== 1) {
          return {
            orden: await this.findOrderByIdForTransaction(orderId, tx),
            status: 'INVALID_STATE' as const,
          }
        }

        const history = await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'COMPLETADA_TECNICO',
            estadoNuevo: 'DEVUELTA_CORRECCION',
            observacion: motivo,
            ordenTrabajoId: orderId,
          },
        })

        await createWorkOrderReturnedAlert(
          {
            busCodigo: order.bus.codigoInterno,
            eventAt: history.fechaCambio,
            mechanicId: order.tecnicoAsignadoId,
            occurrenceId: history.id,
            orderCode: order.codigo,
            orderId,
          },
          tx,
        )

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'RETURNED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  closeOrder(orderId: string, actorId: string, observacion: string | null) {
    return prisma.$transaction(
      async (tx) => {
        await this.lockWorkOrder(tx, orderId)
        const order = await this.findOrderByIdForTransaction(orderId, tx)

        if (!order) {
          return {
            orden: null,
            status: 'ORDER_NOT_FOUND' as const,
          }
        }

        if (order.estado !== 'COMPLETADA_TECNICO') {
          return {
            orden: order,
            status: 'INVALID_STATE' as const,
          }
        }

        if (!order.tecnicoAsignadoId) {
          return {
            orden: order,
            status: 'MISSING_MECHANIC' as const,
          }
        }

        const [activityCount, diagnosticCount, consumptionCount, movementCount, costRows] =
          await Promise.all([
            tx.actividadOrden.count({
              where: {
                intervencion: {
                  ordenTrabajoId: orderId,
                },
              },
            }),
            tx.intervencion.count({
              where: {
                diagnostico: {
                  not: null,
                },
                ordenTrabajoId: orderId,
              },
            }),
            tx.consumoRepuesto.count({
              where: {
                ordenTrabajoId: orderId,
              },
            }),
            tx.movimientoInventario.count({
              where: {
                consumoRepuesto: {
                  ordenTrabajoId: orderId,
                },
                tipo: 'CONSUMO',
              },
            }),
            tx.consumoRepuesto.aggregate({
              where: {
                ordenTrabajoId: orderId,
              },
              _sum: {
                subtotal: true,
              },
            }),
          ])

        if (activityCount === 0) {
          return {
            orden: order,
            status: 'MISSING_ACTIVITY' as const,
          }
        }

        if (order.tipo === 'CORRECTIVA' && diagnosticCount === 0) {
          return {
            orden: order,
            status: 'MISSING_DIAGNOSIS' as const,
          }
        }

        if (consumptionCount !== movementCount) {
          return {
            orden: order,
            status: 'INCONSISTENT_CONSUMPTIONS' as const,
          }
        }

        const expectedCost = costRows._sum.subtotal ?? new Prisma.Decimal(0)

        if (!order.costoTotal.equals(expectedCost)) {
          return {
            orden: order,
            status: 'INCONSISTENT_COST' as const,
          }
        }

        const preventiveSchedule =
          order.origen === 'PREVENTIVO' ? order.programacionMantenimiento : null
        let successor: { plan: PreventivePlanCycleData; targets: PreventiveCycleTargets } | null =
          null

        if (preventiveSchedule?.planMantenimientoPreventivo) {
          const originalPlan = preventiveSchedule.planMantenimientoPreventivo
          await this.lockPreventiveObligation(tx, order.busId, originalPlan.claveTarea)

          const targetsMatchOrder =
            this.sameDate(order.fechaObjetivoPreventivo, preventiveSchedule.fechaProgramada) &&
            order.kilometrajeObjetivoPreventivo === preventiveSchedule.kilometrajeObjetivo
          const validSnapshot = hasValidPreventivePlanSnapshot(order.planAplicado, {
            fechaObjetivo: preventiveSchedule.fechaProgramada,
            kilometrajeObjetivo: preventiveSchedule.kilometrajeObjetivo,
            plan: originalPlan,
            programacionId: preventiveSchedule.id,
          })
          if (!targetsMatchOrder || !validSnapshot) {
            return { orden: order, status: 'INVALID_PREVENTIVE_SNAPSHOT' as const }
          }

          const effectivePlan = await this.resolveEffectivePreventivePlan(
            tx,
            order.busId,
            originalPlan.claveTarea,
          )
          if (effectivePlan) {
            try {
              successor = {
                plan: effectivePlan,
                targets: nextPreventiveTargets(effectivePlan, {
                  fechaProgramada: preventiveSchedule.fechaProgramada,
                  kilometrajeObjetivo: preventiveSchedule.kilometrajeObjetivo,
                }),
              }
            } catch {
              return { orden: order, status: 'INVALID_PREVENTIVE_SUCCESSOR' as const }
            }
          }
        }

        const now = new Date()

        const closed = await tx.ordenTrabajo.updateMany({
          where: {
            estado: 'COMPLETADA_TECNICO',
            id: orderId,
          },
          data: {
            cerradaPorId: actorId,
            estado: 'CERRADA',
            fechaCierre: now,
          },
        })

        if (closed.count !== 1) {
          return {
            orden: await this.findOrderByIdForTransaction(orderId, tx),
            status: 'INVALID_STATE' as const,
          }
        }

        // The row is already terminal inside this transaction, so the policy sees
        // every remaining cause while excluding the work order being closed.
        const availabilityAtClose = buildAvailability(
          await getAvailabilityRecords(
            {
              busId: order.busId,
              eventDate: now,
              journeyId: order.jornadaOperativaId,
            },
            tx,
          ),
          now,
        )
        await tx.ordenTrabajo.update({
          where: { id: orderId },
          data: { disponibilidadAlCierre: availabilityAtClose.disponible },
        })

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'COMPLETADA_TECNICO',
            estadoNuevo: 'CERRADA',
            observacion: observacion ?? 'Orden cerrada administrativamente',
            ordenTrabajoId: orderId,
          },
        })

        if (preventiveSchedule) {
          await tx.programacionMantenimiento.updateMany({
            where: { activa: true, id: preventiveSchedule.id },
            data: { activa: false },
          })

          if (successor) {
            const existing = await tx.programacionMantenimiento.findFirst({
              where: {
                activa: true,
                busId: order.busId,
                planMantenimientoPreventivo: { claveTarea: successor.plan.claveTarea },
              },
              select: { id: true },
            })
            if (!existing) {
              await tx.programacionMantenimiento.create({
                data: {
                  actividad: successor.plan.actividad,
                  busId: order.busId,
                  creadaPorId: actorId,
                  criterio: successor.plan.criterio,
                  fechaProgramada: successor.targets.fechaProgramada,
                  kilometrajeObjetivo: successor.targets.kilometrajeObjetivo,
                  planMantenimientoPreventivoId: successor.plan.id,
                  prioridad: successor.plan.prioridad,
                  tipo: successor.plan.componente,
                },
              })
            }
          }
        }

        await evaluatePreventiveAlertsForBus(order.busId, tx)

        return {
          orden: await this.findOrderByIdForTransaction(orderId, tx),
          status: 'CLOSED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  private async findOrderByIdForTransaction(id: string, client: WorkOrderDbClient) {
    return client.ordenTrabajo.findUnique({
      where: { id },
      include: workOrderDetailInclude,
    })
  }

  private findMechanicByIdForTransaction(id: string, client: WorkOrderDbClient) {
    return client.usuario.findUnique({
      where: { id },
      include: {
        rol: true,
      },
    })
  }

  private findActiveIntervention(client: WorkOrderDbClient, orderId: string, tecnicoId: string) {
    return client.intervencion.findFirst({
      where: {
        fechaFin: null,
        ordenTrabajoId: orderId,
        tecnicoId,
      },
      orderBy: {
        fechaInicio: 'desc',
      },
    })
  }

  private async lockWorkOrder(client: Prisma.TransactionClient, orderId: string) {
    await client.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(CAST(${orderId} AS text))::bigint)`,
    )
  }

  private lockPreventiveObligation(
    client: Prisma.TransactionClient,
    busId: string,
    claveTarea: string,
  ) {
    return client.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:obligacion:${busId}:${claveTarea}`}, 0))`,
    )
  }

  private async resolveEffectivePreventivePlan(
    client: Prisma.TransactionClient,
    busId: string,
    claveTarea: string,
  ) {
    const bus = await client.bus.findUnique({
      where: { id: busId },
      select: { modeloBusId: true },
    })
    if (!bus) return null
    const byBus = await client.planMantenimientoPreventivo.findFirst({
      where: { activo: true, busId, claveTarea },
      orderBy: { version: 'desc' },
    })
    if (byBus) return byBus
    if (!bus.modeloBusId) return null
    return client.planMantenimientoPreventivo.findFirst({
      where: { activo: true, claveTarea, modeloBusId: bus.modeloBusId },
      orderBy: { version: 'desc' },
    })
  }

  private sameDate(left: Date | null, right: Date | null) {
    return left?.getTime() === right?.getTime()
  }

  private async lockSparePart(client: Prisma.TransactionClient, repuestoId: string) {
    await client.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(CAST(${repuestoId} AS text))::bigint)`,
    )

    return client.repuesto.findUnique({
      where: { id: repuestoId },
      select: {
        categoria: true,
        codigo: true,
        costoUnitario: true,
        estado: true,
        id: true,
        nombre: true,
        stockActual: true,
        stockMinimo: true,
        unidadMedida: true,
      },
    })
  }

  private isValidMechanic(
    mechanic:
      | (Prisma.UsuarioGetPayload<{
          include: {
            rol: true
          }
        }> | null)
      | null,
  ) {
    return mechanic?.estado === 'ACTIVO' && mechanic.rol.codigo === 'MECANICO'
  }

  private createDirectOrderCode() {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()

    return `OT-DIR-${suffix}`
  }
}

export type WorkOrderOrderBy = Prisma.OrdenTrabajoOrderByWithRelationInput[]
export type WorkOrderWhere = Prisma.OrdenTrabajoWhereInput
export type WorkOrderState = EstadoOrdenTrabajo
export type WorkOrderOrigin = OrigenOrdenTrabajo
export type WorkOrderType = TipoOrdenTrabajo
