import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import { ReportRepository } from './report.repository.js'
import type { ReportQuery } from './report.schemas.js'
import type {
  HistoryBusDto,
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

    const assignment = await this.reportRepository.findActiveDriverAssignment(user.id)
    return assignment ? [assignment.busId] : []
  }

  async summarize(query: ReportQuery, user: AuthenticatedUser): Promise<HistorySummaryDto> {
    const busIds = await this.accessibleBusIds(user)
    const result = await this.reportRepository.summary(
      query,
      busIds,
      user.rol.codigo === 'CONDUCTOR' ? user.id : undefined,
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
    )
    const costsByBus = new Map(
      result.costs.map((item) => [item.busId, item._sum.costoTotal?.toFixed(2) ?? '0.00']),
    )
    const buses: HistoryBusDto[] = result.buses.map((bus, index) => ({
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
        result.lastOrders[index]?.fechaCierre ?? result.lastOrders[index]?.fechaCreacion ?? null,
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
    const assignment = await this.reportRepository.findActiveDriverAssignment(user.id)

    if (!assignment) {
      return { asignacion: null, historial: null }
    }

    const historial = await this.buildBusHistory(assignment.busId, query, user)

    return {
      asignacion: {
        fechaInicio: assignment.fechaInicio.toISOString(),
        id: assignment.id,
      },
      historial,
    }
  }

  private async buildBusHistory(
    busId: string,
    query: ReportQuery,
    user: AuthenticatedUser,
    mechanicId?: string,
  ) {
    const [bus, orders, states, mileage, schedules, novelties, assignments] = await Promise.all([
      this.reportRepository.getBus(busId),
      this.reportRepository.listBusOrders(busId, query, mechanicId),
      user.rol.codigo === 'CONDUCTOR'
        ? Promise.resolve([])
        : this.reportRepository.listBusStates(busId),
      user.rol.codigo === 'ADMINISTRADOR' || user.rol.codigo === 'DESPACHADOR'
        ? this.reportRepository.listBusMileage(busId)
        : Promise.resolve([]),
      this.reportRepository.listBusSchedules(busId),
      user.rol.codigo === 'MECANICO'
        ? Promise.resolve([])
        : this.reportRepository.listBusNovelties(
            busId,
            user.rol.codigo === 'CONDUCTOR' ? user.id : undefined,
          ),
      user.rol.codigo === 'ADMINISTRADOR' || user.rol.codigo === 'DESPACHADOR'
        ? this.reportRepository.listBusAssignments(busId)
        : Promise.resolve([]),
    ])

    if (!bus) {
      throw new AppError(404, 'NOT_FOUND', 'Bus no encontrado')
    }

    const isAdmin = user.rol.codigo === 'ADMINISTRADOR'
    const canViewTechnicalDetails =
      user.rol.codigo === 'ADMINISTRADOR' || user.rol.codigo === 'MECANICO'
    const historyOrders: HistoryOrderDto[] = orders.map((order) => ({
      codigo: order.codigo,
      ...(isAdmin ? { costoTotal: order.costoTotal.toFixed(2) } : {}),
      descripcion: order.descripcion,
      ...(canViewTechnicalDetails
        ? {
            diagnosticos: order.intervenciones.map((intervention) => ({
              actividades: intervention.actividades.map((activity) => activity.descripcion),
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
            })),
          }
        : {}),
      tecnico: order.tecnicoAsignado?.nombre ?? null,
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
      ordenes: historyOrders,
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
    const consumptions = await this.reportRepository.partsReport(query)
    const groups = new Map<
      string,
      {
        cantidad: number
        categoria: string | null
        codigo: string
        costoTotal: number
        nombre: string
        ordenes: Set<string>
        unidadMedida: string
      }
    >()

    for (const consumption of consumptions) {
      const current = groups.get(consumption.repuestoId) ?? {
        cantidad: 0,
        categoria: consumption.repuesto.categoria,
        codigo: consumption.repuesto.codigo,
        costoTotal: 0,
        nombre: consumption.repuesto.nombre,
        ordenes: new Set<string>(),
        unidadMedida: consumption.repuesto.unidadMedida,
      }
      current.cantidad += consumption.cantidad.toNumber()
      current.costoTotal += consumption.subtotal.toNumber()
      current.ordenes.add(consumption.ordenTrabajoId)
      groups.set(consumption.repuestoId, current)
    }

    const all = [...groups.entries()]
      .map(([id, group]) => ({
        cantidad: group.cantidad.toFixed(2),
        categoria: group.categoria,
        codigo: group.codigo,
        costoTotal: group.costoTotal.toFixed(2),
        id,
        nombre: group.nombre,
        ordenes: group.ordenes.size,
        unidadMedida: group.unidadMedida,
      }))
      .sort((left, right) => Number(right.costoTotal) - Number(left.costoTotal))
    const start = (query.pagina - 1) * query.limite

    return {
      costoTotal: consumptions
        .reduce((sum, consumption) => sum + consumption.subtotal.toNumber(), 0)
        .toFixed(2),
      paginacion: pagination(query, all.length),
      registros: all.slice(start, start + query.limite),
    }
  }

  async costReport(query: ReportQuery, user: AuthenticatedUser) {
    this.requireAdmin(user)
    const orders = await this.reportRepository.costReport(query)
    const groups = new Map<
      string,
      { bus: string; cerradas: number; costoTotal: number; ordenes: number }
    >()

    for (const order of orders) {
      const current = groups.get(order.busId) ?? {
        bus: `${order.bus.codigoInterno} · ${order.bus.placa}`,
        cerradas: 0,
        costoTotal: 0,
        ordenes: 0,
      }
      current.ordenes += 1
      current.cerradas += order.estado === 'CERRADA' ? 1 : 0
      current.costoTotal += order.costoTotal.toNumber()
      groups.set(order.busId, current)
    }

    const all = [...groups.entries()]
      .map(([busId, group]) => ({
        ...group,
        busId,
        costoPromedio: group.ordenes > 0 ? (group.costoTotal / group.ordenes).toFixed(2) : '0.00',
        costoTotal: group.costoTotal.toFixed(2),
      }))
      .sort((left, right) => Number(right.costoTotal) - Number(left.costoTotal))
    const start = (query.pagina - 1) * query.limite

    return {
      costoTotal: orders.reduce((sum, order) => sum + order.costoTotal.toNumber(), 0).toFixed(2),
      paginacion: pagination(query, all.length),
      registros: all.slice(start, start + query.limite),
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
