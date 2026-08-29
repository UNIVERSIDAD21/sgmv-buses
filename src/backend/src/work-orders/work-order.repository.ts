import { randomUUID } from 'node:crypto'

import {
  Prisma,
  type EstadoOrdenTrabajo,
  type OrigenOrdenTrabajo,
  type PrioridadOrden,
  type TipoOrdenTrabajo,
} from '@prisma/client'

import { prisma } from '../prisma/client.js'
import { reassignableWorkOrderStates } from './work-order.state.js'

type WorkOrderDbClient = Prisma.TransactionClient | typeof prisma

const userSelect = {
  email: true,
  id: true,
  nombre: true,
  telefono: true,
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

export const workOrderDetailInclude = {
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
      criterio: true,
      fechaProgramada: true,
      id: true,
      kilometrajeObjetivo: true,
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
  cantidad: Prisma.Decimal
  claveIdempotencia: string
  repuestoId: string
}

export class WorkOrderRepository {
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

  findAvailableSpareParts(busqueda: string | undefined, take: number) {
    return prisma.repuesto.findMany({
      where: {
        estado: 'ACTIVO',
        stockActual: {
          gt: 0,
        },
        ...(busqueda
          ? {
              OR: [
                {
                  codigo: {
                    contains: busqueda,
                    mode: 'insensitive',
                  },
                },
                {
                  nombre: {
                    contains: busqueda,
                    mode: 'insensitive',
                  },
                },
                {
                  categoria: {
                    contains: busqueda,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      select: sparePartSelect,
      orderBy: {
        codigo: 'asc',
      },
      take,
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

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'PENDIENTE_ASIGNACION',
            estadoNuevo: 'ASIGNADA',
            observacion: data.observacion ?? 'Orden asignada a mecanico',
            ordenTrabajoId: orderId,
          },
        })

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

        await tx.ordenReasignacion.create({
          data: {
            fechaReasignacion: now,
            motivo: data.motivo,
            ordenTrabajoId: orderId,
            reasignadoPorId: actorId,
            tecnicoAnteriorId: order.tecnicoAsignadoId,
            tecnicoNuevoId: data.tecnicoId,
          },
        })

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
          if (existing.ordenTrabajoId !== orderId || existing.consumidoPorId !== actorId) {
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
            ordenTrabajoId: orderId,
            repuestoId: data.repuestoId,
            subtotal,
          },
        })

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

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'EN_EJECUCION',
            estadoNuevo: 'COMPLETADA_TECNICO',
            observacion: observacion ?? 'Trabajo tecnico marcado como completado',
            ordenTrabajoId: orderId,
          },
        })

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

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'COMPLETADA_TECNICO',
            estadoNuevo: 'DEVUELTA_CORRECCION',
            observacion: motivo,
            ordenTrabajoId: orderId,
          },
        })

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

        await tx.ordenEstadoHistorial.create({
          data: {
            cambiadoPorId: actorId,
            estadoAnterior: 'COMPLETADA_TECNICO',
            estadoNuevo: 'CERRADA',
            observacion: observacion ?? 'Orden cerrada administrativamente',
            ordenTrabajoId: orderId,
          },
        })

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
