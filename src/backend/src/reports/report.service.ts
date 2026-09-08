import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import { ReportRepository } from './report.repository.js'
import type { ReportQuery } from './report.schemas.js'
import type {
  HistoryBusDto,
  HistoryAlertDto,
  HistoryJourneyDto,
  HistoryNoveltyDto,
  HistoryOrderDto,
  HistorySummaryDto,
  ReportPaginationDto,
} from './report.types.js'

function iso(value: Date | null) {
  return value?.toISOString() ?? null
}

function pagination(query: ReportQuery, total: number): ReportPaginationDto {
  return {
    limite: query.limite,
    pagina: query.pagina,
    total,
    totalPaginas: Math.ceil(total / query.limite),
  }
}

export class ReportService {
  constructor(private readonly reportRepository = new ReportRepository()) {}

  private async accessibleBusIds(user: AuthenticatedUser) {
    if (user.rol.codigo === 'ADMINISTRADOR' || user.rol.codigo === 'DESPACHADOR') {
      return undefined
    }

    if (user.rol.codigo === 'MECANICO') {
      return this.reportRepository.findMechanicBusIds(user.id)
    }

    const history = await this.reportRepository.findDriverHistoryBus(user.id)
    return history ? [history.busId] : []
  }

  private scopedQuery(query: ReportQuery, user: AuthenticatedUser): ReportQuery {
    return user.rol.codigo === 'CONDUCTOR'
      ? { ...query, busId: undefined, conductorId: undefined }
      : query
  }

  async summarize(query: ReportQuery, user: AuthenticatedUser): Promise<HistorySummaryDto> {
    const scopedQuery = this.scopedQuery(query, user)
    const busIds = await this.accessibleBusIds(user)
    const result = await this.reportRepository.summary(
      scopedQuery,
      busIds,
      user.rol.codigo === 'CONDUCTOR' ? user.id : undefined,
      user.rol.codigo === 'ADMINISTRADOR',
      user.rol.codigo === 'ADMINISTRADOR' ? undefined : user.id,
    )
    const alcance =
      user.rol.codigo === 'ADMINISTRADOR'
        ? 'Toda la flota y los informes administrativos'
        : user.rol.codigo === 'MECANICO'
          ? 'Buses con órdenes asignadas o intervenciones propias'
          : user.rol.codigo === 'DESPACHADOR'
            ? 'Flota, disponibilidad, asignaciones y novedades operativas'
            : 'Bus asignado actualmente y novedades propias'

    return {
      alcance,
      ...(user.rol.codigo === 'ADMINISTRADOR' ? { costoTotal: result.cost.toFixed(2) } : {}),
      indicadores: {
        buses: result.buses,
        mantenimientosProgramados: result.mantenimientosProgramados,
        novedades: result.novedades,
        ordenes: result.ordenes,
        ordenesCerradas: result.ordenesCerradas,
      },
      rol: user.rol.codigo,
    }
  }

  async listBuses(query: ReportQuery, user: AuthenticatedUser) {
    if (user.rol.codigo === 'CONDUCTOR') {
      throw new AppError(403, 'FORBIDDEN', 'El conductor consulta el historial de su bus asignado')
    }

    const busIds = await this.accessibleBusIds(user)
    const result = await this.reportRepository.listBuses(
      query,
      busIds,
      user.rol.codigo === 'ADMINISTRADOR',
      user.rol.codigo === 'ADMINISTRADOR' ? undefined : user.id,
    )
    const costsByBus = new Map(
      result.costs.map((item) => [item.busId, item._sum.costoTotal?.toFixed(2) ?? '0.00']),
    )
    const buses: HistoryBusDto[] = result.buses.map((bus) => ({
      anio: bus.anio,
      codigoInterno: bus.codigoInterno,
      ...(user.rol.codigo === 'ADMINISTRADOR'
        ? { costoAcumulado: costsByBus.get(bus.id) ?? '0.00' }
        : {}),
      estadoOperativo: bus.estadoOperativo,
      id: bus.id,
      kilometrajeActual: bus.kilometrajeActual,
      marca: bus.marca,
      modelo: bus.modelo,
      placa: bus.placa,
      totalOrdenes: bus._count.ordenesTrabajo,
      ultimoMantenimiento: iso(
        result.lastOrders.get(bus.id)?.fechaCierre ??
          result.lastOrders.get(bus.id)?.fechaCreacion ??
          null,
      ),
    }))

    return { buses, paginacion: pagination(query, result.total) }
  }

  async getBusHistory(busId: string, query: ReportQuery, user: AuthenticatedUser) {
    if (user.rol.codigo === 'CONDUCTOR') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'El conductor no puede seleccionar buses por identificador',
      )
    }

    if (user.rol.codigo === 'MECANICO') {
      const accessible = await this.reportRepository.findMechanicBusIds(user.id)

      if (!accessible.includes(busId)) {
        throw new AppError(403, 'FORBIDDEN', 'El bus no pertenece al historial técnico autorizado')
      }
    }

    return this.buildBusHistory(
      busId,
      query,
      user,
      user.rol.codigo === 'MECANICO' ? user.id : undefined,
    )
  }

  async getMyBusHistory(query: ReportQuery, user: AuthenticatedUser) {
    const history = await this.reportRepository.findDriverHistoryBus(user.id)

    if (!history) {
      return { asignacion: null, historial: null }
    }

    const historial = await this.buildBusHistory(history.busId, this.scopedQuery(query, user), user)

    return {
      asignacion: history.assignment
        ? { fechaInicio: history.assignment.fechaInicio.toISOString(), id: history.assignment.id }
        : null,
      historial,
    }
  }

  private async buildBusHistory(
    busId: string,
    query: ReportQuery,
    user: AuthenticatedUser,
    mechanicId?: string,
  ) {
    const isAdmin = user.rol.codigo === 'ADMINISTRADOR'
    const alertRecipientId = isAdmin ? undefined : user.id
    const [
      bus,
      orders,
      operationalOrders,
      states,
      mileage,
      schedules,
      novelties,
      assignments,
      journeys,
      alerts,
    ] = await Promise.all([
      this.reportRepository.getBus(busId),
      user.rol.codigo === 'CONDUCTOR' || user.rol.codigo === 'DESPACHADOR'
        ? Promise.resolve([])
        : this.reportRepository.listBusOrders(
            busId,
            query,
            mechanicId,
            isAdmin ? undefined : user.id,
          ),
      user.rol.codigo === 'CONDUCTOR' || user.rol.codigo === 'DESPACHADOR'
        ? this.reportRepository.listBusOperationalOrders(
            busId,
            query,
            user.rol.codigo === 'CONDUCTOR' ? user.id : undefined,
            isAdmin ? undefined : user.id,
          )
        : Promise.resolve([]),
      user.rol.codigo === 'CONDUCTOR'
        ? Promise.resolve([])
        : this.reportRepository.listBusStates(busId, query),
      user.rol.codigo === 'ADMINISTRADOR' || user.rol.codigo === 'DESPACHADOR'
        ? this.reportRepository.listBusMileage(busId, query)
        : Promise.resolve([]),
      user.rol.codigo === 'CONDUCTOR'
        ? Promise.resolve([])
        : this.reportRepository.listBusSchedules(busId, query),
      user.rol.codigo === 'MECANICO'
        ? Promise.resolve([])
        : this.reportRepository.listBusNovelties(
            busId,
            query,
            user.rol.codigo === 'CONDUCTOR' ? user.id : undefined,
          ),
      user.rol.codigo === 'ADMINISTRADOR' || user.rol.codigo === 'DESPACHADOR'
        ? this.reportRepository.listBusAssignments(busId, query)
        : Promise.resolve([]),
      user.rol.codigo === 'MECANICO'
        ? Promise.resolve([])
        : this.reportRepository.listBusJourneys(
            busId,
            query,
            user.rol.codigo === 'CONDUCTOR' ? user.id : undefined,
          ),
      this.reportRepository.listBusAlerts(busId, query, alertRecipientId),
    ])

    if (!bus) {
      throw new AppError(404, 'NOT_FOUND', 'Bus no encontrado')
    }

    const canViewTechnicalDetails =
      user.rol.codigo === 'ADMINISTRADOR' || user.rol.codigo === 'MECANICO'
    const technicalHistoryOrders: HistoryOrderDto[] = orders.map((order) => ({
      codigo: order.codigo,
      ...(isAdmin ? { costoTotal: order.costoTotal.toFixed(2) } : {}),
      descripcion: order.descripcion,
      ...(canViewTechnicalDetails
        ? {
            diagnosticos: order.intervenciones.map((intervention) => ({
              actividades: intervention.actividades.map((activity) => activity.descripcion),
              actividadesDetalladas: intervention.actividades.map((activity) => ({
                descripcion: activity.descripcion,
                fechaRegistro: activity.fechaRegistro.toISOString(),
                id: activity.id,
              })),
              diagnostico: intervention.diagnostico,
              fechaFin: iso(intervention.fechaFin),
              fechaInicio: intervention.fechaInicio.toISOString(),
              observaciones: intervention.observaciones,
              tecnico: intervention.tecnico.nombre,
            })),
          }
        : {}),
      estado: order.estado,
      fechaCierre: iso(order.fechaCierre),
      fechaCreacion: order.fechaCreacion.toISOString(),
      id: order.id,
      ...(canViewTechnicalDetails
        ? {
            historialEstados: order.estadosHistorial.map((history) => ({
              cambiadoPor: history.cambiadoPor.nombre,
              estadoAnterior: history.estadoAnterior,
              estadoNuevo: history.estadoNuevo,
              fechaCambio: history.fechaCambio.toISOString(),
              id: history.id,
              observacion: history.observacion,
            })),
            novedadOrigen: order.novedad
              ? {
                  fechaOcurrencia: iso(order.novedad.fechaOcurrencia),
                  fechaReporte: order.novedad.fechaReporte.toISOString(),
                  id: order.novedad.id,
                  jornadaId: order.novedad.jornadaOperativaId,
                  lecturaId: order.novedad.lecturaKilometrajeId,
                }
              : null,
            reasignaciones: order.reasignaciones.map((reassignment) => ({
              fechaReasignacion: reassignment.fechaReasignacion.toISOString(),
              id: reassignment.id,
              motivo: reassignment.motivo,
              reasignadoPor: reassignment.reasignadoPor.nombre,
              tecnicoAnterior: reassignment.tecnicoAnterior?.nombre ?? null,
              tecnicoNuevo: reassignment.tecnicoNuevo.nombre,
            })),
          }
        : {}),
      origen: order.origen,
      ...(canViewTechnicalDetails
        ? {
            repuestos: order.consumosRepuesto.map((consumption) => ({
              cantidad: consumption.cantidad.toFixed(2),
              codigo: consumption.repuesto.codigo,
              ...(isAdmin
                ? {
                    costoUnitario: consumption.costoUnitario.toFixed(2),
                    subtotal: consumption.subtotal.toFixed(2),
                  }
                : {}),
              nombre: consumption.repuesto.nombre,
              unidadMedida: consumption.repuesto.unidadMedida,
              fechaConsumo: consumption.fechaConsumo.toISOString(),
              compatibilidad: {
                evidencia: consumption.evidenciaCompatibilidad as Record<string, unknown> | null,
                reglaId: consumption.reglaCompatibilidadId,
                reglaVersion: consumption.reglaVersion,
                resultado: consumption.resultadoCompatibilidad,
              },
              movimiento: consumption.movimientoInventario
                ? {
                    cantidad: consumption.movimientoInventario.cantidad.toFixed(2),
                    fechaMovimiento: consumption.movimientoInventario.fechaMovimiento.toISOString(),
                    id: consumption.movimientoInventario.id,
                    tipo: consumption.movimientoInventario.tipo,
                  }
                : null,
            })),
          }
        : {}),
      ...(user.rol.codigo === 'ADMINISTRADOR' || user.rol.codigo === 'DESPACHADOR'
        ? {
            disponibilidadAlCierre: order.disponibilidadAlCierre,
            jornada: order.jornadaOperativa
              ? {
                  estado: order.jornadaOperativa.estado,
                  id: order.jornadaOperativa.id,
                  ruta: order.jornadaOperativa.ruta,
                }
              : null,
          }
        : {}),
      ...(canViewTechnicalDetails
        ? {
            lecturasTecnicas: order.lecturasKilometraje.map((reading) => ({
              fechaLectura: (reading.fechaLectura ?? reading.fechaRegistro).toISOString(),
              id: reading.id,
              kilometraje: reading.kilometrajeNuevo,
              tipo: reading.tipo,
            })),
          }
        : {}),
      tecnico: order.tecnicoAsignado?.nombre ?? null,
      tipo: order.tipo,
    }))
    const operationalHistoryOrders: HistoryOrderDto[] = operationalOrders.map((order) => ({
      codigo: order.codigo,
      descripcion: order.tipo === 'PREVENTIVA' ? 'Orden preventiva' : 'Orden correctiva',
      disponibilidadAlCierre: order.disponibilidadAlCierre,
      estado: order.estado,
      fechaCierre: iso(order.fechaCierre),
      fechaCreacion: order.fechaCreacion.toISOString(),
      id: order.id,
      jornada: order.jornadaOperativa,
      origen: order.origen,
      tecnico: null,
      tipo: order.tipo,
    }))
    const historyNovelties: HistoryNoveltyDto[] = novelties.map((novelty) => ({
      clasificacion: novelty.clasificacion,
      descripcion: novelty.descripcion,
      estado: novelty.estado,
      fechaReporte: novelty.fechaReporte.toISOString(),
      id: novelty.id,
      ...(isAdmin || user.rol.codigo === 'DESPACHADOR'
        ? { reportadaPor: novelty.conductor.nombre }
        : {}),
      tipo: novelty.tipo,
    }))

    const historyJourneys: HistoryJourneyDto[] = journeys.map((journey) => ({
      conductor: journey.conductor.nombre,
      estado: journey.estado,
      finReal: iso(journey.finReal),
      finProgramado: journey.finProgramado.toISOString(),
      id: journey.id,
      inicioReal: iso(journey.inicioReal),
      inicioProgramado: journey.inicioProgramado.toISOString(),
      lecturas: journey.lecturasKilometraje.map((reading) => ({
        fechaLectura: (reading.fechaLectura ?? reading.fechaRegistro).toISOString(),
        id: reading.id,
        kilometraje: reading.kilometrajeNuevo,
        tipo: reading.tipo,
      })),
      ruta: journey.ruta,
    }))
    const historyAlerts: HistoryAlertDto[] = alerts
      .filter((alert) => isAdmin || alert.destinatarios.length > 0)
      .map((alert) => ({
        ...(isAdmin ? {} : { estado: alert.destinatarios[0]?.estado }),
        fechaGeneracion: alert.fechaGeneracion.toISOString(),
        id: alert.id,
        origen: {
          busId: alert.busId,
          jornadaId: alert.jornadaOperativaId,
          novedadId: alert.novedadId,
          ordenId: alert.ordenTrabajoId,
          programacionId: alert.programacionMantenimientoId,
        },
        prioridad: alert.prioridad,
        tipo: alert.tipo,
        titulo: alert.titulo,
      }))

    return {
      asignaciones: assignments.map((assignment) => ({
        activa: assignment.activa,
        asignadoPor: assignment.asignadoPor.nombre,
        conductor: assignment.conductor.nombre,
        fechaFin: iso(assignment.fechaFin),
        fechaInicio: assignment.fechaInicio.toISOString(),
        id: assignment.id,
        motivo: assignment.motivo,
      })),
      bus,
      estados: states.map((state) => ({
        cambiadoPor: state.cambiadoPor.nombre,
        estadoAnterior: state.estadoAnterior,
        estadoNuevo: state.estadoNuevo,
        fechaCambio: state.fechaCambio.toISOString(),
        id: state.id,
        motivo: state.motivo,
      })),
      kilometrajes: mileage.map((reading) => ({
        fechaRegistro: reading.fechaRegistro.toISOString(),
        id: reading.id,
        kilometrajeAnterior: reading.kilometrajeAnterior,
        kilometrajeNuevo: reading.kilometrajeNuevo,
        motivo: reading.motivo,
        registradoPor: reading.registradoPor.nombre,
      })),
      mantenimientos: schedules.map((schedule) => ({
        activa: schedule.activa,
        actividad: schedule.actividad,
        criterio: schedule.criterio,
        fechaProgramada: iso(schedule.fechaProgramada),
        id: schedule.id,
        kilometrajeObjetivo: schedule.kilometrajeObjetivo,
        tipo: schedule.tipo,
      })),
      novedades: historyNovelties,
      ordenes:
        user.rol.codigo === 'CONDUCTOR' || user.rol.codigo === 'DESPACHADOR'
          ? operationalHistoryOrders
          : technicalHistoryOrders,
      jornadas: historyJourneys,
      alertas: historyAlerts,
    }
  }

  async maintenanceReport(query: ReportQuery, user: AuthenticatedUser) {
    this.requireAdmin(user)
    const result = await this.reportRepository.maintenanceReport(query)

    return {
      costoTotal: result.cost.toFixed(2),
      paginacion: pagination(query, result.total),
      registros: result.orders.map((order) => ({
        bus: `${order.bus.codigoInterno} · ${order.bus.placa}`,
        codigo: order.codigo,
        costoTotal: order.costoTotal.toFixed(2),
        estado: order.estado,
        fechaCierre: iso(order.fechaCierre),
        fechaCreacion: order.fechaCreacion.toISOString(),
        id: order.id,
        intervenciones: order._count.intervenciones,
        origen: order.origen,
        repuestosConsumidos: order._count.consumosRepuesto,
        tecnico: order.tecnicoAsignado?.nombre ?? null,
        tipo: order.tipo,
      })),
    }
  }

  async partsReport(query: ReportQuery, user: AuthenticatedUser) {
    this.requireAdmin(user)
    const result = await this.reportRepository.partsReport(query)
    const parts = new Map(result.parts.map((part) => [part.id, part]))
    const orderCount = new Map<string, number>()
    for (const pair of result.orderPairs) {
      orderCount.set(pair.repuestoId, (orderCount.get(pair.repuestoId) ?? 0) + 1)
    }

    return {
      costoTotal: result.totalCost.toFixed(2),
      paginacion: pagination(query, result.total),
      registros: result.groups.map((group) => {
        const part = parts.get(group.repuestoId)!
        return {
          cantidad: (group._sum.cantidad ?? 0).toFixed(2),
          categoria: part.categoria,
          codigo: part.codigo,
          costoTotal: (group._sum.subtotal ?? 0).toFixed(2),
          id: part.id,
          nombre: part.nombre,
          ordenes: orderCount.get(part.id) ?? 0,
          unidadMedida: part.unidadMedida,
        }
      }),
    }
  }

  async costReport(query: ReportQuery, user: AuthenticatedUser) {
    this.requireAdmin(user)
    const result = await this.reportRepository.costReport(query)
    const buses = new Map(result.buses.map((bus) => [bus.id, bus]))
    const closed = new Map(result.closedGroups.map((group) => [group.busId, group._count._all]))

    return {
      costoTotal: result.totalCost.toFixed(2),
      paginacion: pagination(query, result.total),
      registros: result.groups.map((group) => {
        const bus = buses.get(group.busId)!
        const total = group._sum.costoTotal?.toNumber() ?? 0
        const orders = group._count._all
        return {
          bus: `${bus.codigoInterno} · ${bus.placa}`,
          busId: group.busId,
          cerradas: closed.get(group.busId) ?? 0,
          costoPromedio: orders > 0 ? (total / orders).toFixed(2) : '0.00',
          costoTotal: total.toFixed(2),
          ordenes: orders,
        }
      }),
    }
  }

  private requireAdmin(user: AuthenticatedUser) {
    if (user.rol.codigo !== 'ADMINISTRADOR') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Los informes administrativos requieren rol administrador',
      )
    }
  }
}
