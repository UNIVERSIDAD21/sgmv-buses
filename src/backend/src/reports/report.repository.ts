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
  id: true,
  nombre: true,
} as const

function busSearchWhere(search: string): Prisma.BusWhereInput {
  return {
    OR: [
      { codigoInterno: { contains: search, mode: 'insensitive' } },
      { placa: { contains: search, mode: 'insensitive' } },
      { marca: { contains: search, mode: 'insensitive' } },
      { modelo: { contains: search, mode: 'insensitive' } },
    ],
  }
}

export function dateRangeFromQuery(query: ReportQuery) {
  return query.fechaDesde || query.fechaHasta
    ? {
        ...(query.fechaDesde ? { gte: new Date(`${query.fechaDesde}T00:00:00.000Z`) } : {}),
        ...(query.fechaHasta ? { lte: new Date(`${query.fechaHasta}T23:59:59.999Z`) } : {}),
      }
    : undefined
}

function mileageWhereFromQuery(
  query: ReportQuery,
): Prisma.LecturaKilometrajeWhereInput | undefined {
  return query.kilometrajeDesde !== undefined || query.kilometrajeHasta !== undefined
    ? {
        kilometrajeNuevo: {
          ...(query.kilometrajeDesde !== undefined ? { gte: query.kilometrajeDesde } : {}),
          ...(query.kilometrajeHasta !== undefined ? { lte: query.kilometrajeHasta } : {}),
        },
      }
    : undefined
}

function readingWhereFromQuery(
  query: ReportQuery,
): Prisma.LecturaKilometrajeWhereInput | undefined {
  const dateRange = dateRangeFromQuery(query)
  const mileageRange = mileageWhereFromQuery(query)

  return dateRange || mileageRange
    ? {
        ...(dateRange ? { fechaLectura: dateRange } : {}),
        ...(mileageRange ?? {}),
      }
    : undefined
}

function withoutDateRange(query: ReportQuery): ReportQuery {
  return { ...query, fechaDesde: undefined, fechaHasta: undefined }
}

function noveltyWhereFromQuery(
  query: ReportQuery,
  busIds?: string[],
  conductorId?: string,
): Prisma.NovedadWhereInput {
  return {
    ...(busIds ? { busId: { in: busIds } } : {}),
    ...(conductorId ? { conductorId } : {}),
    ...(query.conductorId ? { conductorId: query.conductorId } : {}),
    ...(query.jornadaId ? { jornadaOperativaId: query.jornadaId } : {}),
    ...(dateRangeFromQuery(query) ? { fechaReporte: dateRangeFromQuery(query) } : {}),
    ...(query.novedadEstado ? { estado: query.novedadEstado } : {}),
    ...(query.novedadTipo ? { tipo: { contains: query.novedadTipo, mode: 'insensitive' } } : {}),
    ...(query.novedadCriticidad ? { criticidad: query.novedadCriticidad } : {}),
  }
}

function consumptionWhereFromQuery(query: ReportQuery): Prisma.ConsumoRepuestoWhereInput {
  const dateRange = dateRangeFromQuery(query)
  return {
    ...(query.repuestoId ? { repuestoId: query.repuestoId } : {}),
    ...(query.compatibilidad ? { resultadoCompatibilidad: query.compatibilidad } : {}),
    ...(dateRange
      ? {
          fechaConsumo: dateRange,
          movimientoInventario: { is: { fechaMovimiento: dateRange } },
        }
      : {}),
  }
}

function alertWhereFromQuery(
  query: ReportQuery,
  recipientId?: string,
): Prisma.AlertaInternaWhereInput | undefined {
  return query.alertaTipo || query.alertaPrioridad || query.alertaEstado
    ? {
        ...(query.alertaTipo ? { tipo: query.alertaTipo } : {}),
        ...(query.alertaPrioridad ? { prioridad: query.alertaPrioridad } : {}),
        ...(query.alertaEstado || recipientId
          ? {
              destinatarios: {
                some: {
                  ...(recipientId ? { usuarioId: recipientId } : {}),
                  ...(query.alertaEstado ? { estado: query.alertaEstado } : {}),
                },
              },
            }
          : {}),
        ...(dateRangeFromQuery(query) ? { fechaGeneracion: dateRangeFromQuery(query) } : {}),
      }
    : undefined
}

function baseBusWhereFromQuery(
  query: ReportQuery,
  accessibleBusIds?: string[],
): Prisma.BusWhereInput {
  const base: Prisma.BusWhereInput = {
    ...(query.busId ? { id: query.busId } : {}),
    ...(query.busqueda ? busSearchWhere(query.busqueda) : {}),
  }
  return accessibleBusIds ? { AND: [{ id: { in: accessibleBusIds } }, base] } : base
}

export function orderWhereFromQuery(
  query: ReportQuery,
  extra: Prisma.OrdenTrabajoWhereInput = {},
  alertRecipientId?: string,
): Prisma.OrdenTrabajoWhereInput {
  const filters: Prisma.OrdenTrabajoWhereInput = {
    ...(query.busId ? { busId: query.busId } : {}),
    ...(query.estado ? { estado: query.estado } : {}),
    ...(query.origen ? { origen: query.origen } : {}),
    ...(query.busqueda ? { bus: busSearchWhere(query.busqueda) } : {}),
    ...(query.tipo ? { tipo: query.tipo } : {}),
    ...(dateRangeFromQuery(query) ? { fechaCreacion: dateRangeFromQuery(query) } : {}),
    ...(query.disponibilidadAlCierre !== undefined
      ? { disponibilidadAlCierre: query.disponibilidadAlCierre }
      : {}),
    ...(query.jornadaId ? { jornadaOperativaId: query.jornadaId } : {}),
    ...(query.conductorId ? { jornadaOperativa: { conductorId: query.conductorId } } : {}),
    ...(query.novedadEstado || query.novedadTipo || query.novedadCriticidad
      ? {
          novedad: {
            ...(query.novedadEstado ? { estado: query.novedadEstado } : {}),
            ...(query.novedadTipo
              ? { tipo: { contains: query.novedadTipo, mode: 'insensitive' } }
              : {}),
            ...(query.novedadCriticidad ? { criticidad: query.novedadCriticidad } : {}),
          },
        }
      : {}),
    ...(query.repuestoId || query.compatibilidad
      ? {
          consumosRepuesto: {
            some: {
              ...(query.repuestoId ? { repuestoId: query.repuestoId } : {}),
              ...(query.compatibilidad ? { resultadoCompatibilidad: query.compatibilidad } : {}),
            },
          },
        }
      : {}),
    ...(mileageWhereFromQuery(query)
      ? { lecturasKilometraje: { some: mileageWhereFromQuery(query) } }
      : {}),
    ...(alertWhereFromQuery(query, alertRecipientId)
      ? {
          OR: [
            { alertasInternas: { some: alertWhereFromQuery(query, alertRecipientId) } },
            {
              novedad: {
                alertasInternas: { some: alertWhereFromQuery(query, alertRecipientId) },
              },
            },
            {
              jornadaOperativa: {
                alertasInternas: { some: alertWhereFromQuery(query, alertRecipientId) },
              },
            },
          ],
        }
      : {}),
  }

  return Object.keys(extra).length > 0 ? { AND: [extra, filters] } : filters
}

function busWhereFromQuery(
  query: ReportQuery,
  accessibleBusIds?: string[],
  alertRecipientId?: string,
): Prisma.BusWhereInput {
  const hasOrderFilters = Boolean(
    query.estado ||
    query.fechaDesde ||
    query.fechaHasta ||
    query.origen ||
    query.tipo ||
    query.jornadaId ||
    query.conductorId ||
    query.disponibilidadAlCierre !== undefined ||
    query.repuestoId ||
    query.compatibilidad ||
    query.kilometrajeDesde !== undefined ||
    query.kilometrajeHasta !== undefined,
  )
  const hasNoveltyFilters = Boolean(
    query.novedadEstado || query.novedadTipo || query.novedadCriticidad,
  )
  const alertWhere = alertWhereFromQuery(query, alertRecipientId)
  const filters: Prisma.BusWhereInput[] = [baseBusWhereFromQuery(query, accessibleBusIds)]
  if (hasOrderFilters) {
    filters.push({ ordenesTrabajo: { some: orderWhereFromQuery(query, {}, alertRecipientId) } })
  } else if (hasNoveltyFilters) {
    filters.push({ novedades: { some: noveltyWhereFromQuery(query) } })
  }
  if (alertWhere) {
    filters.push({
      OR: [
        { alertasInternas: { some: alertWhere } },
        { novedades: { some: { alertasInternas: { some: alertWhere } } } },
        { ordenesTrabajo: { some: { alertasInternas: { some: alertWhere } } } },
        { jornadasOperativas: { some: { alertasInternas: { some: alertWhere } } } },
        { programacionesMantenimiento: { some: { alertasInternas: { some: alertWhere } } } },
      ],
    })
  }

  return filters.length === 1 ? filters[0]! : { AND: filters }
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

  async findDriverHistoryBus(userId: string) {
    const activeAssignment = await this.findActiveDriverAssignment(userId)
    if (activeAssignment) return { assignment: activeAssignment, busId: activeAssignment.busId }

    const [journey, assignment] = await Promise.all([
      prisma.jornadaOperativa.findFirst({
        orderBy: [{ inicioProgramado: 'desc' }, { id: 'desc' }],
        select: { busId: true },
        where: { conductorId: userId },
      }),
      prisma.asignacionConductor.findFirst({
        orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }],
        select: { busId: true, fechaInicio: true, id: true },
        where: { conductorId: userId },
      }),
    ])
    return journey
      ? { assignment: null, busId: journey.busId }
      : assignment
        ? { assignment, busId: assignment.busId }
        : null
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

  async listBuses(
    query: ReportQuery,
    accessibleBusIds?: string[],
    includeCosts = false,
    alertRecipientId?: string,
  ) {
    const orderFilters = orderWhereFromQuery(query, {}, alertRecipientId)
    const where = busWhereFromQuery(query, accessibleBusIds, alertRecipientId)
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
    const [costs, lastOrderRows] = await Promise.all([
      includeCosts
        ? prisma.ordenTrabajo.groupBy({
            _sum: { costoTotal: true },
            by: ['busId'],
            where: orderWhereFromQuery(query, { busId: { in: busIds } }, alertRecipientId),
          })
        : Promise.resolve([]),
      busIds.length === 0
        ? Promise.resolve([])
        : prisma.ordenTrabajo.findMany({
            distinct: ['busId'],
            orderBy: [
              { busId: 'asc' },
              { fechaCierre: 'desc' },
              { fechaCreacion: 'desc' },
              { id: 'desc' },
            ],
            select: { busId: true, fechaCierre: true, fechaCreacion: true },
            where: orderWhereFromQuery(query, { busId: { in: busIds } }, alertRecipientId),
          }),
    ])

    const lastOrders = new Map(lastOrderRows.map((order) => [order.busId, order]))
    return { buses, costs, lastOrders, total }
  }

  getBus(busId: string) {
    return prisma.bus.findUnique({ select: busSelect, where: { id: busId } })
  }

  listBusOrders(busId: string, query: ReportQuery, mechanicId?: string, alertRecipientId?: string) {
    return prisma.ordenTrabajo.findMany({
      include: {
        consumosRepuesto: {
          include: {
            movimientoInventario: {
              select: {
                cantidad: true,
                fechaMovimiento: true,
                id: true,
                tipo: true,
              },
            },
            repuesto: {
              select: {
                codigo: true,
                nombre: true,
                unidadMedida: true,
              },
            },
            reglaCompatibilidad: { select: { id: true, version: true } },
          },
          orderBy: [{ fechaConsumo: 'desc' }, { id: 'desc' }],
          where: consumptionWhereFromQuery(query),
        },
        estadosHistorial: {
          include: { cambiadoPor: { select: userSelect } },
          orderBy: [{ fechaCambio: 'desc' }, { id: 'desc' }],
          where: dateRangeFromQuery(query) ? { fechaCambio: dateRangeFromQuery(query) } : undefined,
        },
        intervenciones: {
          include: {
            actividades: {
              orderBy: [{ fechaRegistro: 'asc' }, { id: 'asc' }],
              select: { descripcion: true, fechaRegistro: true, id: true },
              where: dateRangeFromQuery(query)
                ? { fechaRegistro: dateRangeFromQuery(query) }
                : undefined,
            },
            tecnico: { select: userSelect },
          },
          orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }],
          where: dateRangeFromQuery(query) ? { fechaInicio: dateRangeFromQuery(query) } : undefined,
        },
        reasignaciones: {
          include: {
            reasignadoPor: { select: userSelect },
            tecnicoAnterior: { select: userSelect },
            tecnicoNuevo: { select: userSelect },
          },
          orderBy: [{ fechaReasignacion: 'asc' }, { id: 'asc' }],
          where: dateRangeFromQuery(query)
            ? { fechaReasignacion: dateRangeFromQuery(query) }
            : undefined,
        },
        jornadaOperativa: {
          select: {
            conductor: { select: userSelect },
            estado: true,
            id: true,
            ruta: { select: { codigo: true, nombre: true } },
          },
        },
        lecturasKilometraje: {
          select: {
            fechaLectura: true,
            fechaRegistro: true,
            id: true,
            kilometrajeNuevo: true,
            tipo: true,
          },
          orderBy: [{ fechaLectura: 'asc' }, { fechaRegistro: 'asc' }, { id: 'asc' }],
          where: readingWhereFromQuery(query),
        },
        novedad: {
          select: {
            fechaOcurrencia: true,
            fechaReporte: true,
            id: true,
            jornadaOperativaId: true,
            lecturaKilometrajeId: true,
          },
        },
        tecnicoAsignado: { select: userSelect },
      },
      orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }],
      where: orderWhereFromQuery(
        query,
        {
          busId,
          ...(mechanicId
            ? {
                OR: [
                  { tecnicoAsignadoId: mechanicId },
                  { intervenciones: { some: { tecnicoId: mechanicId } } },
                ],
              }
            : {}),
        },
        alertRecipientId,
      ),
    })
  }

  listBusOperationalOrders(
    busId: string,
    query: ReportQuery,
    conductorId?: string,
    alertRecipientId?: string,
  ) {
    return prisma.ordenTrabajo.findMany({
      orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }],
      select: {
        codigo: true,
        disponibilidadAlCierre: true,
        estado: true,
        fechaCierre: true,
        fechaCreacion: true,
        id: true,
        jornadaOperativa: {
          select: {
            estado: true,
            id: true,
            ruta: { select: { codigo: true, nombre: true } },
          },
        },
        origen: true,
        tipo: true,
      },
      where: orderWhereFromQuery(
        query,
        {
          busId,
          ...(conductorId
            ? {
                OR: [{ jornadaOperativa: { conductorId } }, { novedad: { conductorId } }],
              }
            : {}),
        },
        alertRecipientId,
      ),
    })
  }

  listBusStates(busId: string, query: ReportQuery) {
    return prisma.busEstadoHistorial.findMany({
      include: { cambiadoPor: { select: userSelect } },
      orderBy: [{ fechaCambio: 'desc' }, { id: 'desc' }],
      where: {
        busId,
        ...(dateRangeFromQuery(query) ? { fechaCambio: dateRangeFromQuery(query) } : {}),
      },
    })
  }

  listBusMileage(busId: string, query: ReportQuery) {
    return prisma.lecturaKilometraje.findMany({
      include: { registradoPor: { select: userSelect } },
      orderBy: [{ fechaRegistro: 'desc' }, { id: 'desc' }],
      where: { busId, ...(readingWhereFromQuery(query) ?? {}) },
    })
  }

  listBusSchedules(busId: string, query: ReportQuery) {
    return prisma.programacionMantenimiento.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: {
        busId,
        ...(dateRangeFromQuery(query) ? { fechaProgramada: dateRangeFromQuery(query) } : {}),
      },
    })
  }

  listBusNovelties(busId: string, query: ReportQuery, conductorId?: string) {
    return prisma.novedad.findMany({
      include: { conductor: { select: userSelect } },
      orderBy: [{ fechaReporte: 'desc' }, { id: 'desc' }],
      where: { ...noveltyWhereFromQuery(query, undefined, conductorId), busId },
    })
  }

  listBusAssignments(busId: string, query: ReportQuery) {
    return prisma.asignacionConductor.findMany({
      include: {
        asignadoPor: { select: userSelect },
        conductor: { select: userSelect },
      },
      orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }],
      where: {
        busId,
        ...(query.conductorId ? { conductorId: query.conductorId } : {}),
        ...(dateRangeFromQuery(query) ? { fechaInicio: dateRangeFromQuery(query) } : {}),
      },
    })
  }

  listBusJourneys(busId: string, query: ReportQuery, conductorId?: string) {
    return prisma.jornadaOperativa.findMany({
      include: {
        conductor: { select: userSelect },
        lecturasKilometraje: {
          select: {
            fechaLectura: true,
            fechaRegistro: true,
            id: true,
            kilometrajeNuevo: true,
            tipo: true,
          },
          orderBy: [{ fechaLectura: 'asc' }, { fechaRegistro: 'asc' }, { id: 'asc' }],
          where: readingWhereFromQuery(query),
        },
        ruta: { select: { codigo: true, nombre: true } },
      },
      orderBy: [{ inicioProgramado: 'desc' }, { id: 'desc' }],
      where: {
        busId,
        ...(query.jornadaId ? { id: query.jornadaId } : {}),
        ...(conductorId ? { conductorId } : {}),
        ...(query.conductorId ? { conductorId: query.conductorId } : {}),
        ...(dateRangeFromQuery(query) ? { inicioProgramado: dateRangeFromQuery(query) } : {}),
      },
    })
  }

  listBusAlerts(busId: string, query: ReportQuery, recipientId?: string) {
    return prisma.alertaInterna.findMany({
      include: {
        destinatarios: {
          select: { estado: true, usuarioId: true },
          ...(recipientId ? { where: { usuarioId: recipientId } } : {}),
        },
      },
      orderBy: [{ fechaGeneracion: 'desc' }, { id: 'desc' }],
      where: {
        OR: [
          { busId },
          { jornadaOperativa: { busId } },
          { novedad: { busId } },
          { ordenTrabajo: { busId } },
          { programacionMantenimiento: { busId } },
        ],
        ...(query.alertaTipo ? { tipo: query.alertaTipo } : {}),
        ...(query.alertaPrioridad ? { prioridad: query.alertaPrioridad } : {}),
        ...(dateRangeFromQuery(query) ? { fechaGeneracion: dateRangeFromQuery(query) } : {}),
        ...(recipientId || query.alertaEstado
          ? {
              destinatarios: {
                some: {
                  ...(recipientId ? { usuarioId: recipientId } : {}),
                  ...(query.alertaEstado ? { estado: query.alertaEstado } : {}),
                },
              },
            }
          : {}),
      },
    })
  }

  async summary(
    query: ReportQuery,
    accessibleBusIds?: string[],
    conductorId?: string,
    includeCosts = false,
    alertRecipientId?: string,
  ) {
    const filteredBuses = await prisma.bus.findMany({
      select: { id: true },
      where: busWhereFromQuery(query, accessibleBusIds, alertRecipientId),
    })
    const filteredBusIds = filteredBuses.map((bus) => bus.id)
    const orderWhere = orderWhereFromQuery(
      query,
      { busId: { in: filteredBusIds } },
      alertRecipientId,
    )
    const closedWhere = {
      ...orderWhere,
      estado: 'CERRADA' as EstadoOrdenTrabajo,
    }
    const noveltyWhere = noveltyWhereFromQuery(query, filteredBusIds, conductorId)
    const scheduleWhere: Prisma.ProgramacionMantenimientoWhereInput = {
      busId: { in: filteredBusIds },
      ...(dateRangeFromQuery(query) ? { fechaProgramada: dateRangeFromQuery(query) } : {}),
    }
    const [buses, ordenes, ordenesCerradas, novedades, mantenimientosProgramados, cost] =
      await Promise.all([
        Promise.resolve(filteredBusIds.length),
        prisma.ordenTrabajo.count({ where: orderWhere }),
        prisma.ordenTrabajo.count({ where: closedWhere }),
        prisma.novedad.count({ where: noveltyWhere }),
        prisma.programacionMantenimiento.count({ where: scheduleWhere }),
        includeCosts
          ? prisma.ordenTrabajo
              .aggregate({ _sum: { costoTotal: true }, where: orderWhere })
              .then((result) => result._sum.costoTotal ?? new Prisma.Decimal(0))
          : Promise.resolve(new Prisma.Decimal(0)),
      ])

    return {
      buses,
      cost,
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
    return this.aggregatePartsReport(query)
  }

  costReport(query: ReportQuery) {
    return this.aggregateCostReport(query)
  }

  private async aggregatePartsReport(query: ReportQuery) {
    const where: Prisma.ConsumoRepuestoWhereInput = {
      ...consumptionWhereFromQuery(query),
      ordenTrabajo: orderWhereFromQuery(withoutDateRange(query)),
    }
    const skip = (query.pagina - 1) * query.limite
    const [allGroups, groups, totalCost] = await Promise.all([
      prisma.consumoRepuesto.groupBy({ by: ['repuestoId'], where }),
      prisma.consumoRepuesto.groupBy({
        _sum: { cantidad: true, subtotal: true },
        by: ['repuestoId'],
        orderBy: [{ _sum: { subtotal: 'desc' } }, { repuestoId: 'asc' }],
        skip,
        take: query.limite,
        where,
      }),
      prisma.consumoRepuesto.aggregate({ _sum: { subtotal: true }, where }),
    ])
    const repuestoIds = groups.map((group) => group.repuestoId)
    const [parts, orderPairs] = await Promise.all([
      prisma.repuesto.findMany({
        select: {
          categoria: true,
          codigo: true,
          id: true,
          nombre: true,
          unidadMedida: true,
        },
        where: { id: { in: repuestoIds } },
      }),
      prisma.consumoRepuesto.groupBy({
        by: ['repuestoId', 'ordenTrabajoId'],
        where: { ...where, repuestoId: { in: repuestoIds } },
      }),
    ])

    return {
      groups,
      orderPairs,
      parts,
      total: allGroups.length,
      totalCost: totalCost._sum.subtotal ?? new Prisma.Decimal(0),
    }
  }

  private async aggregateCostReport(query: ReportQuery) {
    const where = orderWhereFromQuery(query)
    const skip = (query.pagina - 1) * query.limite
    const [allGroups, groups, totalCost] = await Promise.all([
      prisma.ordenTrabajo.groupBy({ by: ['busId'], where }),
      prisma.ordenTrabajo.groupBy({
        _count: { _all: true },
        _sum: { costoTotal: true },
        by: ['busId'],
        orderBy: [{ _sum: { costoTotal: 'desc' } }, { busId: 'asc' }],
        skip,
        take: query.limite,
        where,
      }),
      prisma.ordenTrabajo.aggregate({ _sum: { costoTotal: true }, where }),
    ])
    const busIds = groups.map((group) => group.busId)
    const [buses, closedGroups] = await Promise.all([
      prisma.bus.findMany({
        select: { codigoInterno: true, id: true, placa: true },
        where: { id: { in: busIds } },
      }),
      prisma.ordenTrabajo.groupBy({
        _count: { _all: true },
        by: ['busId'],
        where: { AND: [where, { busId: { in: busIds }, estado: 'CERRADA' }] },
      }),
    ])

    return {
      buses,
      closedGroups,
      groups,
      total: allGroups.length,
      totalCost: totalCost._sum.costoTotal ?? new Prisma.Decimal(0),
    }
  }
}
