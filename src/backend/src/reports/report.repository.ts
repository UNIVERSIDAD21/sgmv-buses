import { Prisma, type EstadoOrdenTrabajo } from '@prisma/client'

import { prisma } from '../prisma/client.js'
import type { ReportQuery } from './report.schemas.js'

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

const userSelect = {
  email: true,
  id: true,
  nombre: true,
} as const

export function orderWhereFromQuery(
  query: ReportQuery,
  extra: Prisma.OrdenTrabajoWhereInput = {},
): Prisma.OrdenTrabajoWhereInput {
  const filters: Prisma.OrdenTrabajoWhereInput = {
    ...(query.busId ? { busId: query.busId } : {}),
    ...(query.estado ? { estado: query.estado } : {}),
    ...(query.origen ? { origen: query.origen } : {}),
    ...(query.tipo ? { tipo: query.tipo } : {}),
    ...(query.fechaDesde || query.fechaHasta
      ? {
          fechaCreacion: {
            ...(query.fechaDesde ? { gte: new Date(`${query.fechaDesde}T00:00:00.000Z`) } : {}),
            ...(query.fechaHasta ? { lte: new Date(`${query.fechaHasta}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  }

  return Object.keys(extra).length > 0 ? { AND: [extra, filters] } : filters
}

export class ReportRepository {
  findActiveDriverAssignment(userId: string) {
    return prisma.asignacionConductor.findFirst({
      include: {
        bus: {
          select: busSelect,
        },
      },
      orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }],
      where: {
        activa: true,
        conductorId: userId,
      },
    })
  }

  async findMechanicBusIds(userId: string) {
    const orders = await prisma.ordenTrabajo.findMany({
      distinct: ['busId'],
      select: { busId: true },
      where: {
        OR: [{ tecnicoAsignadoId: userId }, { intervenciones: { some: { tecnicoId: userId } } }],
      },
    })

    return orders.map((order) => order.busId)
  }

  async listBuses(query: ReportQuery, accessibleBusIds?: string[], includeCosts = false) {
    const orderFilters = orderWhereFromQuery(query)
    const hasOrderFilters = Boolean(
      query.busId ||
      query.estado ||
      query.fechaDesde ||
      query.fechaHasta ||
      query.origen ||
      query.tipo,
    )
    const where: Prisma.BusWhereInput = {
      ...(accessibleBusIds ? { id: { in: accessibleBusIds } } : {}),
      ...(query.busId ? { id: query.busId } : {}),
      ...(query.busqueda
        ? {
            OR: [
              { codigoInterno: { contains: query.busqueda, mode: 'insensitive' } },
              { placa: { contains: query.busqueda, mode: 'insensitive' } },
              { marca: { contains: query.busqueda, mode: 'insensitive' } },
              { modelo: { contains: query.busqueda, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(hasOrderFilters ? { ordenesTrabajo: { some: orderFilters } } : {}),
    }
    const skip = (query.pagina - 1) * query.limite
    const [buses, total] = await Promise.all([
      prisma.bus.findMany({
        orderBy: [{ codigoInterno: 'asc' }, { id: 'asc' }],
        select: {
          ...busSelect,
          _count: {
            select: {
              ordenesTrabajo: { where: orderFilters },
            },
          },
        },
        skip,
        take: query.limite,
        where,
      }),
      prisma.bus.count({ where }),
    ])
    const busIds = buses.map((bus) => bus.id)
    const [costs, lastOrders] = await Promise.all([
      includeCosts
        ? prisma.ordenTrabajo.groupBy({
            _sum: { costoTotal: true },
            by: ['busId'],
            where: orderWhereFromQuery(query, { busId: { in: busIds } }),
          })
        : Promise.resolve([]),
      Promise.all(
        busIds.map((busId) =>
          prisma.ordenTrabajo.findFirst({
            orderBy: [{ fechaCierre: 'desc' }, { fechaCreacion: 'desc' }, { id: 'desc' }],
            select: { fechaCierre: true, fechaCreacion: true },
            where: orderWhereFromQuery(query, { busId }),
          }),
        ),
      ),
    ])

    return { buses, costs, lastOrders, total }
  }

  getBus(busId: string) {
    return prisma.bus.findUnique({ select: busSelect, where: { id: busId } })
  }

  listBusOrders(busId: string, query: ReportQuery, mechanicId?: string) {
    return prisma.ordenTrabajo.findMany({
      include: {
        consumosRepuesto: {
          include: {
            repuesto: {
              select: {
                codigo: true,
                nombre: true,
                unidadMedida: true,
              },
            },
          },
          orderBy: [{ fechaConsumo: 'desc' }, { id: 'desc' }],
        },
        estadosHistorial: {
          include: { cambiadoPor: { select: userSelect } },
          orderBy: [{ fechaCambio: 'desc' }, { id: 'desc' }],
        },
        intervenciones: {
          include: {
            actividades: {
              orderBy: [{ fechaRegistro: 'asc' }, { id: 'asc' }],
              select: { descripcion: true, fechaRegistro: true, id: true },
            },
            tecnico: { select: userSelect },
          },
          orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }],
        },
        tecnicoAsignado: { select: userSelect },
      },
      orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }],
      where: orderWhereFromQuery(query, {
        busId,
        ...(mechanicId
          ? {
              OR: [
                { tecnicoAsignadoId: mechanicId },
                { intervenciones: { some: { tecnicoId: mechanicId } } },
              ],
            }
          : {}),
      }),
    })
  }

  listBusStates(busId: string) {
    return prisma.busEstadoHistorial.findMany({
      include: { cambiadoPor: { select: userSelect } },
      orderBy: [{ fechaCambio: 'desc' }, { id: 'desc' }],
      where: { busId },
    })
  }

  listBusMileage(busId: string) {
    return prisma.lecturaKilometraje.findMany({
      include: { registradoPor: { select: userSelect } },
      orderBy: [{ fechaRegistro: 'desc' }, { id: 'desc' }],
      where: { busId },
    })
  }

  listBusSchedules(busId: string) {
    return prisma.programacionMantenimiento.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: { busId },
    })
  }

  listBusNovelties(busId: string, conductorId?: string) {
    return prisma.novedad.findMany({
      include: { conductor: { select: userSelect } },
      orderBy: [{ fechaReporte: 'desc' }, { id: 'desc' }],
      where: { busId, ...(conductorId ? { conductorId } : {}) },
    })
  }

  listBusAssignments(busId: string) {
    return prisma.asignacionConductor.findMany({
      include: {
        asignadoPor: { select: userSelect },
        conductor: { select: userSelect },
      },
      orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }],
      where: { busId },
    })
  }

  async summary(query: ReportQuery, accessibleBusIds?: string[], conductorId?: string) {
    const busWhere: Prisma.BusWhereInput = accessibleBusIds ? { id: { in: accessibleBusIds } } : {}
    const orderWhere = orderWhereFromQuery(query, {
      ...(accessibleBusIds ? { busId: { in: accessibleBusIds } } : {}),
    })
    const closedWhere = {
      ...orderWhere,
      estado: 'CERRADA' as EstadoOrdenTrabajo,
    }
    const noveltyWhere: Prisma.NovedadWhereInput = {
      ...(accessibleBusIds ? { busId: { in: accessibleBusIds } } : {}),
      ...(conductorId ? { conductorId } : {}),
    }
    const scheduleWhere: Prisma.ProgramacionMantenimientoWhereInput = {
      ...(accessibleBusIds ? { busId: { in: accessibleBusIds } } : {}),
    }
    const [buses, ordenes, ordenesCerradas, novedades, mantenimientosProgramados, cost] =
      await Promise.all([
        prisma.bus.count({ where: busWhere }),
        prisma.ordenTrabajo.count({ where: orderWhere }),
        prisma.ordenTrabajo.count({ where: closedWhere }),
        prisma.novedad.count({ where: noveltyWhere }),
        prisma.programacionMantenimiento.count({ where: scheduleWhere }),
        prisma.ordenTrabajo.aggregate({ _sum: { costoTotal: true }, where: orderWhere }),
      ])

    return {
      buses,
      cost: cost._sum.costoTotal ?? new Prisma.Decimal(0),
      mantenimientosProgramados,
      novedades,
      ordenes,
      ordenesCerradas,
    }
  }

  async maintenanceReport(query: ReportQuery) {
    const where = orderWhereFromQuery(query)
    const skip = (query.pagina - 1) * query.limite
    const [orders, total, cost] = await Promise.all([
      prisma.ordenTrabajo.findMany({
        include: {
          bus: { select: busSelect },
          tecnicoAsignado: { select: userSelect },
          _count: { select: { consumosRepuesto: true, intervenciones: true } },
        },
        orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }],
        skip,
        take: query.limite,
        where,
      }),
      prisma.ordenTrabajo.count({ where }),
      prisma.ordenTrabajo.aggregate({ _sum: { costoTotal: true }, where }),
    ])

    return { cost: cost._sum.costoTotal ?? new Prisma.Decimal(0), orders, total }
  }

  partsReport(query: ReportQuery) {
    return prisma.consumoRepuesto.findMany({
      include: {
        ordenTrabajo: {
          include: { bus: { select: busSelect } },
        },
        repuesto: true,
      },
      orderBy: [{ fechaConsumo: 'desc' }, { id: 'desc' }],
      where: {
        ordenTrabajo: orderWhereFromQuery(query),
      },
    })
  }

  costReport(query: ReportQuery) {
    return prisma.ordenTrabajo.findMany({
      include: { bus: { select: busSelect } },
      orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }],
      where: orderWhereFromQuery(query),
    })
  }
}
