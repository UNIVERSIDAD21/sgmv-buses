import {
  Prisma,
  type EstadoOrdenTrabajo,
  type OrigenOrdenTrabajo,
  type TipoOrdenTrabajo,
} from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { resolveCompatibility } from '../spare-parts/compatibility.resolver.js'
import { AppError } from '../shared/http.js'
import type {
  AvailableMechanicsQuery,
  AvailablePartsQuery,
  AuthorizeConsumptionExceptionInput,
  AssignWorkOrderInput,
  CreateActivityInput,
  CreateConsumptionInput,
  CreateTechnicalReadingInput,
  CreateManualWorkOrderInput,
  InterventionUpdateInput,
  ListWorkOrdersQuery,
  ReassignWorkOrderInput,
  ReturnWorkOrderInput,
  TransitionObservationInput,
} from './work-order.schemas.js'
import {
  type ConsumptionRecord,
  type MechanicRecord,
  type SparePartRecord,
  WorkOrderRepository,
  type WorkOrderRecord,
  type WorkOrderWhere,
} from './work-order.repository.js'
import {
  activeWorkOrderStates,
  reassignableWorkOrderStates,
  workOrderOriginValues,
  workOrderStateValues,
  workOrderTypeValues,
} from './work-order.state.js'
import type {
  AvailableSparePartDto,
  MechanicOptionDto,
  WorkOrderActionFlagsDto,
  WorkOrderActivityDto,
  WorkOrderBusDto,
  WorkOrderConsumptionDto,
  WorkOrderDetailDto,
  DispatchWorkOrderProjectionDto,
  WorkOrderInterventionDto,
  WorkOrderJourneyDto,
  WorkOrderInventoryMovementDto,
  WorkOrderListDto,
  WorkOrderNoveltyDto,
  WorkOrderPreventiveScheduleDto,
  WorkOrderReassignmentDto,
  WorkOrderSparePartDto,
  WorkOrderStateHistoryDto,
  WorkOrderSummaryDto,
  WorkOrderSummaryItemDto,
  WorkOrderTechnicalHistoryItemDto,
  WorkOrderTechnicalReadingDto,
  WorkOrderUserDto,
} from './work-order.types.js'

const stateDefaults = Object.fromEntries(workOrderStateValues.map((state) => [state, 0])) as Record<
  EstadoOrdenTrabajo,
  number
>

const originDefaults = Object.fromEntries(
  workOrderOriginValues.map((origin) => [origin, 0]),
) as Record<OrigenOrdenTrabajo, number>

const typeDefaults = Object.fromEntries(workOrderTypeValues.map((type) => [type, 0])) as Record<
  TipoOrdenTrabajo,
  number
>

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function decimalToString(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toFixed(2)
}

function dateColumnToIsoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null
}

function mapUser(user: WorkOrderUserDto): WorkOrderUserDto {
  return {
    email: user.email,
    id: user.id,
    nombre: user.nombre,
    telefono: user.telefono,
  }
}

function mapNullableUser(user: WorkOrderUserDto | null): WorkOrderUserDto | null {
  return user ? mapUser(user) : null
}

function mapBus(bus: WorkOrderRecord['bus']): WorkOrderBusDto {
  return {
    anio: bus.anio,
    codigoInterno: bus.codigoInterno,
    estadoOperativo: bus.estadoOperativo,
    id: bus.id,
    kilometrajeActual: bus.kilometrajeActual,
    marca: bus.marca,
    modelo: bus.modelo,
    placa: bus.placa,
  }
}

function mapNovelty(novelty: WorkOrderRecord['novedad']): WorkOrderNoveltyDto | null {
  if (!novelty) {
    return null
  }

  return {
    clasificacion: novelty.clasificacion,
    conductor: mapUser(novelty.conductor),
    descripcion: novelty.descripcion,
    estado: novelty.estado,
    fechaReporte: novelty.fechaReporte.toISOString(),
    id: novelty.id,
    tipo: novelty.tipo,
  }
}

function mapPreventiveSchedule(
  schedule: WorkOrderRecord['programacionMantenimiento'],
): WorkOrderPreventiveScheduleDto | null {
  if (!schedule) {
    return null
  }

  return {
    activa: schedule.activa,
    actividad: schedule.actividad,
    criterio: schedule.criterio,
    fechaProgramada: dateColumnToIsoDate(schedule.fechaProgramada),
    id: schedule.id,
    kilometrajeObjetivo: schedule.kilometrajeObjetivo,
    tipo: schedule.tipo,
  }
}

function mapStateHistory(
  history: WorkOrderRecord['estadosHistorial'][number],
): WorkOrderStateHistoryDto {
  return {
    cambiadoPor: mapUser(history.cambiadoPor),
    estadoAnterior: history.estadoAnterior,
    estadoNuevo: history.estadoNuevo,
    fechaCambio: history.fechaCambio.toISOString(),
    id: history.id,
    observacion: history.observacion,
  }
}

function mapReassignment(
  reassignment: WorkOrderRecord['reasignaciones'][number],
): WorkOrderReassignmentDto {
  return {
    fechaReasignacion: reassignment.fechaReasignacion.toISOString(),
    id: reassignment.id,
    motivo: reassignment.motivo,
    reasignadoPor: mapUser(reassignment.reasignadoPor),
    tecnicoAnterior: mapNullableUser(reassignment.tecnicoAnterior),
    tecnicoNuevo: mapUser(reassignment.tecnicoNuevo),
  }
}

function mapActivity(
  activity: WorkOrderRecord['intervenciones'][number]['actividades'][number],
): WorkOrderActivityDto {
  return {
    descripcion: activity.descripcion,
    fechaRegistro: activity.fechaRegistro.toISOString(),
    id: activity.id,
    registradaPor: mapUser(activity.registradaPor),
  }
}

function mapIntervention(
  intervention: WorkOrderRecord['intervenciones'][number],
): WorkOrderInterventionDto {
  return {
    actividades: intervention.actividades.map(mapActivity),
    diagnostico: intervention.diagnostico,
    fechaFin: intervention.fechaFin?.toISOString() ?? null,
    fechaInicio: intervention.fechaInicio.toISOString(),
    id: intervention.id,
    observaciones: intervention.observaciones,
    tecnico: mapUser(intervention.tecnico),
  }
}

function mapJourney(journey: WorkOrderRecord['jornadaOperativa']): WorkOrderJourneyDto | null {
  if (!journey) return null
  return {
    estado: journey.estado,
    finProgramado: journey.finProgramado.toISOString(),
    finReal: journey.finReal?.toISOString() ?? null,
    id: journey.id,
    inicioProgramado: journey.inicioProgramado.toISOString(),
    inicioReal: journey.inicioReal?.toISOString() ?? null,
    ruta: journey.ruta,
  }
}

function isTechnicalReadingType(
  type: WorkOrderRecord['lecturasKilometraje'][number]['tipo'],
): type is WorkOrderTechnicalReadingDto['tipo'] {
  return type === 'INGRESO_TALLER' || type === 'REVISION_TECNICA' || type === 'CIERRE_MANTENIMIENTO'
}

function mapTechnicalReading(
  reading: WorkOrderRecord['lecturasKilometraje'][number],
): WorkOrderTechnicalReadingDto | null {
  if (!isTechnicalReadingType(reading.tipo)) return null
  return {
    fechaLectura: (reading.fechaLectura ?? reading.fechaRegistro).toISOString(),
    id: reading.id,
    intervencionId: reading.intervencionId,
    kilometraje: reading.kilometrajeNuevo,
    kilometrajeAnterior: reading.kilometrajeAnterior,
    motivo: reading.motivo,
    registradoPor: mapUser(reading.registradoPor),
    tipo: reading.tipo,
  }
}

function canViewEconomicFields(actor: AuthenticatedUser) {
  return actor.rol.codigo === 'ADMINISTRADOR'
}

function mapSparePart(
  part: SparePartRecord,
  includeEconomicFields: boolean,
): WorkOrderSparePartDto {
  return {
    categoria: part.categoria,
    codigo: part.codigo,
    ...(includeEconomicFields ? { costoUnitario: decimalToString(part.costoUnitario) } : {}),
    estado: part.estado,
    id: part.id,
    nombre: part.nombre,
    stockActual: decimalToString(part.stockActual),
    stockMinimo: decimalToString(part.stockMinimo),
    unidadMedida: part.unidadMedida,
  }
}

function mapAvailableSparePart(
  part: SparePartRecord & { evaluacion: Awaited<ReturnType<typeof resolveCompatibility>> | null },
  includeEconomicFields: boolean,
): AvailableSparePartDto {
  const base = mapSparePart(part, includeEconomicFields)
  return {
    ...base,
    compatibilidad: {
      condicionUso: part.evaluacion?.regla?.condicionUso ?? null,
      evidencia: (part.evaluacion?.evidencia ?? {}) as Record<string, unknown>,
      resultado: part.evaluacion?.resultado ?? 'SIN_EVIDENCIA',
      reglaId: part.evaluacion?.regla?.id ?? null,
      version: part.evaluacion?.regla?.version ?? null,
    },
  }
}

function mapMovement(
  movement: ConsumptionRecord['movimientoInventario'],
  includeEconomicFields: boolean,
): WorkOrderInventoryMovementDto | null {
  if (!movement) {
    return null
  }

  return {
    cantidad: decimalToString(movement.cantidad),
    ...(includeEconomicFields
      ? {
          costoUnitario: movement.costoUnitario ? decimalToString(movement.costoUnitario) : null,
        }
      : {}),
    fechaMovimiento: movement.fechaMovimiento.toISOString(),
    id: movement.id,
    motivo: movement.motivo,
    tipo: movement.tipo,
  }
}

function mapConsumption(
  consumption: ConsumptionRecord,
  includeEconomicFields: boolean,
): WorkOrderConsumptionDto {
  return {
    autorizadoPorId: consumption.autorizadoPorId,
    autorizacionExcepcionId: consumption.autorizacionExcepcionId,
    cantidad: decimalToString(consumption.cantidad),
    ...(includeEconomicFields
      ? {
          costoUnitario: decimalToString(consumption.costoUnitario),
          subtotal: decimalToString(consumption.subtotal),
        }
      : {}),
    fechaConsumo: consumption.fechaConsumo.toISOString(),
    id: consumption.id,
    movimientoInventario: mapMovement(consumption.movimientoInventario, includeEconomicFields),
    repuesto: mapSparePart(consumption.repuesto, includeEconomicFields),
    resultadoCompatibilidad: consumption.resultadoCompatibilidad,
    reglaCompatibilidadId: consumption.reglaCompatibilidadId,
    reglaVersion: consumption.reglaVersion,
    evidenciaCompatibilidad: consumption.evidenciaCompatibilidad as Record<string, unknown> | null,
    motivoExcepcion: consumption.motivoExcepcion,
  }
}

function mapMechanic(mechanic: MechanicRecord): MechanicOptionDto {
  return mapUser(mechanic)
}

function mapTechnicalHistory(
  records: Awaited<ReturnType<WorkOrderRepository['findClosedOrdersByBus']>>,
): WorkOrderTechnicalHistoryItemDto[] {
  return records.map((order) => ({
    codigo: order.codigo,
    diagnostico: order.intervenciones[0]?.diagnostico ?? null,
    estado: order.estado,
    fechaCierre: order.fechaCierre?.toISOString() ?? null,
    id: order.id,
    tipo: order.tipo,
  }))
}

function latestReturnReason(order: WorkOrderRecord) {
  if (order.estado !== 'DEVUELTA_CORRECCION') {
    return null
  }

  return (
    [...order.estadosHistorial]
      .reverse()
      .find((history) => history.estadoNuevo === 'DEVUELTA_CORRECCION')?.observacion ?? null
  )
}

function buildActions(order: WorkOrderRecord, actor: AuthenticatedUser): WorkOrderActionFlagsDto {
  const isAdmin = actor.rol.codigo === 'ADMINISTRADOR'
  const isAssignedMechanic = actor.rol.codigo === 'MECANICO' && order.tecnicoAsignadoId === actor.id

  return {
    puedeAsignar: isAdmin && order.estado === 'PENDIENTE_ASIGNACION',
    puedeCerrar: isAdmin && order.estado === 'COMPLETADA_TECNICO',
    puedeCompletar: isAssignedMechanic && order.estado === 'EN_EJECUCION',
    puedeDevolver: isAdmin && order.estado === 'COMPLETADA_TECNICO',
    puedeIniciar: isAssignedMechanic && order.estado === 'ASIGNADA',
    puedeReanudar: isAssignedMechanic && order.estado === 'DEVUELTA_CORRECCION',
    puedeReasignar: isAdmin && reassignableWorkOrderStates.includes(order.estado),
    puedeRegistrarTecnica: isAssignedMechanic && order.estado === 'EN_EJECUCION',
  }
}

function mapSummaryOrder(
  order: WorkOrderRecord,
  includeEconomicFields: boolean,
): WorkOrderSummaryItemDto {
  return {
    bus: mapBus(order.bus),
    codigo: order.codigo,
    ...(includeEconomicFields ? { costoTotal: decimalToString(order.costoTotal) } : {}),
    descripcion: order.descripcion,
    estado: order.estado,
    fechaAsignacion: order.fechaAsignacion?.toISOString() ?? null,
    fechaCierre: order.fechaCierre?.toISOString() ?? null,
    fechaCompletadaTecnico: order.fechaCompletadaTecnico?.toISOString() ?? null,
    fechaCreacion: order.fechaCreacion.toISOString(),
    fechaInicioEjecucion: order.fechaInicioEjecucion?.toISOString() ?? null,
    id: order.id,
    origen: order.origen,
    prioridad: order.prioridad,
    tecnicoAsignado: mapNullableUser(order.tecnicoAsignado),
    tipo: order.tipo,
  }
}

function mapDetailOrder(
  order: WorkOrderRecord,
  actor: AuthenticatedUser,
  technicalHistory: WorkOrderTechnicalHistoryItemDto[],
): WorkOrderDetailDto {
  const includeEconomicFields = canViewEconomicFields(actor)

  return {
    ...mapSummaryOrder(order, includeEconomicFields),
    acciones: buildActions(order, actor),
    autorizacionesExcepcion: order.autorizacionesExcepcion.map((authorization) => ({
      autorizadoPor: {
        id: authorization.autorizadoPor.id,
        nombre: authorization.autorizadoPor.nombre,
      },
      cantidadMaxima: decimalToString(authorization.cantidadMaxima),
      estado: authorization.estado,
      fechaAutorizacion: authorization.fechaAutorizacion.toISOString(),
      fechaExpiracion: authorization.fechaExpiracion?.toISOString() ?? null,
      id: authorization.id,
      intervencionId: authorization.intervencionId,
      motivo: authorization.motivo,
      repuesto: mapSparePart(authorization.repuesto, includeEconomicFields),
    })),
    cerradaPor: mapNullableUser(order.cerradaPor),
    consumosRepuesto: order.consumosRepuesto.map((consumption) =>
      mapConsumption(consumption, includeEconomicFields),
    ),
    creadaPor: mapUser(order.creadaPor),
    fechaObjetivoPreventivo: dateColumnToIsoDate(order.fechaObjetivoPreventivo),
    historialEstados: order.estadosHistorial.map(mapStateHistory),
    historialTecnicoBus: technicalHistory,
    intervenciones: order.intervenciones.map(mapIntervention),
    jornadaOperativa: mapJourney(order.jornadaOperativa),
    lecturasTecnicas: order.lecturasKilometraje
      .map(mapTechnicalReading)
      .filter((reading): reading is WorkOrderTechnicalReadingDto => reading !== null),
    kilometrajeObjetivoPreventivo: order.kilometrajeObjetivoPreventivo,
    motivoDevolucionActual: latestReturnReason(order),
    novedad: mapNovelty(order.novedad),
    programacionMantenimiento: mapPreventiveSchedule(order.programacionMantenimiento),
    reasignaciones: order.reasignaciones.map(mapReassignment),
    disponibilidadAlCierre: order.disponibilidadAlCierre,
  }
}

function ensureAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function ensureMechanic(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'MECANICO') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function ensureWorkOrderActor(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR' && actor.rol.codigo !== 'MECANICO') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function translatePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_WORK_ORDER', 'Ya existe un registro con esos datos')
    }

    if (error.code === 'P2025') {
      throw new AppError(404, 'WORK_ORDER_NOT_FOUND', 'Orden de trabajo no encontrada')
    }

    if (error.code === 'P2034') {
      throw new AppError(
        409,
        'CONCURRENT_OPERATION',
        'La orden tuvo una operacion simultanea. Intente nuevamente.',
      )
    }
  }

  throw error
}

export class WorkOrderService {
  constructor(private readonly workOrderRepository = new WorkOrderRepository()) {}

  async assign(orderId: string, input: AssignWorkOrderInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const result = await this.workOrderRepository.assignMechanic(orderId, actor.id, {
        observacion: input.observacion ? normalizeText(input.observacion) : null,
        tecnicoId: input.tecnicoId,
      })

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async close(orderId: string, input: TransitionObservationInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const result = await this.workOrderRepository.closeOrder(
        orderId,
        actor.id,
        input.observacion ? normalizeText(input.observacion) : null,
      )

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async complete(orderId: string, input: TransitionObservationInput, actor: AuthenticatedUser) {
    ensureMechanic(actor)

    try {
      const result = await this.workOrderRepository.completeTechnical(
        orderId,
        actor.id,
        input.observacion ? normalizeText(input.observacion) : null,
      )

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async createActivity(orderId: string, input: CreateActivityInput, actor: AuthenticatedUser) {
    ensureMechanic(actor)

    try {
      const result = await this.workOrderRepository.createActivity(
        orderId,
        actor.id,
        normalizeText(input.descripcion),
      )

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async createConsumption(
    orderId: string,
    input: CreateConsumptionInput,
    actor: AuthenticatedUser,
  ) {
    ensureMechanic(actor)

    try {
      const result = await this.workOrderRepository.createConsumption(orderId, actor.id, {
        autorizacionExcepcionId: input.autorizacionExcepcionId,
        cantidad: new Prisma.Decimal(input.cantidad),
        claveIdempotencia: input.claveIdempotencia,
        repuestoId: input.repuestoId,
      })

      if (result.status === 'INCOMPATIBLE') {
        return {
          consumo: null,
          orden: this.mapOperationResult(result, actor),
          rechazado: true as const,
          yaExistia: false,
        }
      }
      if (result.status === 'INVALID_EXCEPTION') {
        throw new AppError(
          409,
          'INVALID_CONSUMPTION_EXCEPTION',
          'La excepcion no esta vigente o no corresponde',
        )
      }
      if (result.status === 'EXCEPTION_NOT_NEEDED') {
        throw new AppError(400, 'EXCEPTION_NOT_NEEDED', 'El repuesto ya es compatible con el bus')
      }

      const orden = this.mapOperationResult(result, actor)

      if (!result.consumo) {
        throw new AppError(500, 'CONSUMPTION_NOT_CREATED', 'No fue posible registrar el consumo')
      }

      return {
        consumo: mapConsumption(result.consumo, canViewEconomicFields(actor)),
        orden,
        yaExistia: result.status === 'ALREADY_CREATED',
      }
    } catch (error) {
      if (this.isIdempotencyDuplicate(error)) {
        const existing = await this.workOrderRepository.findConsumptionByIdempotencyKey(
          input.claveIdempotencia,
        )
        const order = await this.workOrderRepository.findOrderById(orderId)

        if (
          existing &&
          order &&
          existing.ordenTrabajoId === orderId &&
          existing.consumidoPorId === actor.id
        ) {
          this.ensureCanReadOrder(order, actor)

          return {
            consumo: mapConsumption(existing, canViewEconomicFields(actor)),
            orden: mapDetailOrder(order, actor, []),
            yaExistia: true,
          }
        }
      }

      translatePrismaError(error)
    }
  }

  async authorizeConsumptionException(
    orderId: string,
    input: AuthorizeConsumptionExceptionInput,
    actor: AuthenticatedUser,
  ) {
    ensureAdmin(actor)
    try {
      const result = await this.workOrderRepository.authorizeConsumptionException(
        orderId,
        actor.id,
        {
          cantidadMaxima: new Prisma.Decimal(input.cantidadMaxima),
          fechaExpiracion: input.fechaExpiracion ?? null,
          intervencionId: input.intervencionId,
          motivo: normalizeText(input.motivo),
          repuestoId: input.repuestoId,
        },
      )
      if (result.status === 'ORDER_NOT_FOUND')
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Orden no encontrada')
      if (result.status === 'INVALID_STATE')
        throw new AppError(409, 'ORDER_NOT_IN_EXECUTION', 'La orden no esta en ejecucion')
      if (result.status === 'INTERVENTION_NOT_ACTIVE')
        throw new AppError(409, 'INTERVENTION_NOT_ACTIVE', 'La intervencion no esta activa')
      if (result.status === 'SPARE_PART_NOT_FOUND')
        throw new AppError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
      if (result.status === 'SPARE_PART_INACTIVE')
        throw new AppError(409, 'SPARE_PART_INACTIVE', 'El repuesto esta inactivo')
      return {
        autorizacion: {
          cantidadMaxima: result.autorizacion!.cantidadMaxima.toFixed(2),
          estado: result.autorizacion!.estado,
          fechaAutorizacion: result.autorizacion!.fechaAutorizacion.toISOString(),
          fechaExpiracion: result.autorizacion!.fechaExpiracion?.toISOString() ?? null,
          id: result.autorizacion!.id,
          intervencionId: result.autorizacion!.intervencionId,
          motivo: result.autorizacion!.motivo,
          ordenTrabajoId: result.autorizacion!.ordenTrabajoId,
          repuestoId: result.autorizacion!.repuestoId,
        },
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async revokeConsumptionException(
    orderId: string,
    authorizationId: string,
    actor: AuthenticatedUser,
  ) {
    ensureAdmin(actor)
    try {
      const result = await this.workOrderRepository.revokeConsumptionException(
        orderId,
        authorizationId,
      )
      if (result.status === 'NOT_FOUND') {
        throw new AppError(
          404,
          'CONSUMPTION_EXCEPTION_NOT_FOUND',
          'La excepcion no existe para esta orden',
        )
      }
      if (result.status === 'INVALID_STATE') {
        throw new AppError(409, 'CONSUMPTION_EXCEPTION_NOT_ACTIVE', 'La excepcion no esta vigente')
      }
      return {
        autorizacion: {
          cantidadMaxima: result.autorizacion!.cantidadMaxima.toFixed(2),
          estado: result.autorizacion!.estado,
          fechaAutorizacion: result.autorizacion!.fechaAutorizacion.toISOString(),
          fechaExpiracion: result.autorizacion!.fechaExpiracion?.toISOString() ?? null,
          id: result.autorizacion!.id,
          intervencionId: result.autorizacion!.intervencionId,
          motivo: result.autorizacion!.motivo,
          ordenTrabajoId: result.autorizacion!.ordenTrabajoId,
          repuestoId: result.autorizacion!.repuestoId,
        },
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async createManual(input: CreateManualWorkOrderInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    if (input.tipo === 'PREVENTIVA') {
      throw new AppError(
        400,
        'MANUAL_PREVENTIVE_NOT_SUPPORTED',
        'La orden preventiva manual no esta soportada por el modelo actual; debe originarse desde RF-03',
      )
    }

    try {
      const result = await this.workOrderRepository.createManualOrder(actor.id, {
        busId: input.busId,
        descripcion: normalizeText(input.descripcion),
        prioridad: input.prioridad,
      })

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async createTechnicalReading(
    orderId: string,
    input: CreateTechnicalReadingInput,
    actor: AuthenticatedUser,
  ) {
    if (actor.rol.codigo !== 'ADMINISTRADOR' && actor.rol.codigo !== 'MECANICO') {
      throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para registrar lecturas tecnicas')
    }
    if (input.fechaEvento.getTime() > Date.now()) {
      throw new AppError(400, 'EVENT_DATE_IN_FUTURE', 'La fecha del evento no puede ser futura')
    }
    try {
      const result = await this.workOrderRepository.createTechnicalReading(
        orderId,
        actor.id,
        actor.rol.codigo,
        {
          fechaEvento: input.fechaEvento,
          kilometraje: input.kilometraje,
          motivo: input.motivo ? normalizeText(input.motivo) : null,
          tipo: input.tipo,
        },
      )
      return { orden: this.mapOperationResult(result, actor) }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async listDispatchProjections(actor: AuthenticatedUser): Promise<{
    ordenes: DispatchWorkOrderProjectionDto[]
  }> {
    if (actor.rol.codigo !== 'ADMINISTRADOR' && actor.rol.codigo !== 'DESPACHADOR') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'No tiene permisos para consultar disponibilidad tecnica',
      )
    }
    const orders = await this.workOrderRepository.listDispatchProjections()
    return {
      ordenes: orders.map((item) => ({
        disponibilidad: item.disponibilidad,
        orden: {
          ...item.orden,
          fechaCierre: item.orden.fechaCierre?.toISOString() ?? null,
        },
      })),
    }
  }

  async getAvailableMechanics(query: AvailableMechanicsQuery, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const mecanicos = await this.workOrderRepository.findAvailableMechanics(
      query.busqueda ? normalizeText(query.busqueda) : undefined,
      query.limite,
    )

    return {
      mecanicos: mecanicos.map(mapMechanic),
    }
  }

  async getAvailableSpareParts(
    orderId: string,
    query: AvailablePartsQuery,
    actor: AuthenticatedUser,
  ) {
    const order = await this.getAuthorizedOrder(orderId, actor)

    if (actor.rol.codigo === 'MECANICO' && order.estado !== 'EN_EJECUCION') {
      throw new AppError(
        400,
        'ORDER_NOT_IN_EXECUTION',
        'Solo se consultan repuestos dentro de una orden en ejecucion',
      )
    }

    const repuestos = await this.workOrderRepository.findAvailableSpareParts(
      query.busqueda ? normalizeText(query.busqueda) : undefined,
      query.limite,
      order.busId,
    )

    return {
      repuestos: repuestos.map((part) => mapAvailableSparePart(part, canViewEconomicFields(actor))),
    }
  }

  async getOrder(orderId: string, actor: AuthenticatedUser) {
    const order = await this.getAuthorizedOrder(orderId, actor)
    const history = await this.workOrderRepository.findClosedOrdersByBus(order.busId, order.id)

    return {
      orden: mapDetailOrder(order, actor, mapTechnicalHistory(history)),
    }
  }

  async getReassignments(orderId: string, actor: AuthenticatedUser) {
    const order = await this.getAuthorizedOrder(orderId, actor)

    return {
      reasignaciones: order.reasignaciones.map(mapReassignment),
    }
  }

  async getStateHistory(orderId: string, actor: AuthenticatedUser) {
    const order = await this.getAuthorizedOrder(orderId, actor)

    return {
      historial: order.estadosHistorial.map(mapStateHistory),
    }
  }

  async listAdminOrders(
    query: ListWorkOrdersQuery,
    actor: AuthenticatedUser,
  ): Promise<WorkOrderListDto> {
    ensureAdmin(actor)

    return this.listOrders(query, actor)
  }

  async listMyOrders(
    query: ListWorkOrdersQuery,
    actor: AuthenticatedUser,
  ): Promise<WorkOrderListDto> {
    ensureMechanic(actor)

    if (query.ordenarPor === 'costoTotal') {
      throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para ordenar por costo')
    }

    return this.listOrders(query, actor, actor.id)
  }

  async reassign(orderId: string, input: ReassignWorkOrderInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const result = await this.workOrderRepository.reassignMechanic(orderId, actor.id, {
        motivo: normalizeText(input.motivo),
        tecnicoId: input.tecnicoId,
      })

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async resume(orderId: string, input: TransitionObservationInput, actor: AuthenticatedUser) {
    ensureMechanic(actor)

    try {
      const result = await this.workOrderRepository.resumeOrder(
        orderId,
        actor.id,
        input.observacion ? normalizeText(input.observacion) : null,
      )

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async returnForCorrection(
    orderId: string,
    input: ReturnWorkOrderInput,
    actor: AuthenticatedUser,
  ) {
    ensureAdmin(actor)

    try {
      const result = await this.workOrderRepository.returnForCorrection(
        orderId,
        actor.id,
        normalizeText(input.motivo),
      )

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async start(orderId: string, input: TransitionObservationInput, actor: AuthenticatedUser) {
    ensureMechanic(actor)

    try {
      const result = await this.workOrderRepository.startOrder(
        orderId,
        actor.id,
        input.observacion ? normalizeText(input.observacion) : null,
      )

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async summarize(actor: AuthenticatedUser): Promise<WorkOrderSummaryDto> {
    ensureWorkOrderActor(actor)

    const where = actor.rol.codigo === 'MECANICO' ? { tecnicoAsignadoId: actor.id } : {}
    const [total, byState, byOrigin, byType] = await Promise.all([
      this.workOrderRepository.countOrders(where),
      this.workOrderRepository.countOrdersByState(where),
      this.workOrderRepository.countOrdersByOrigin(where),
      this.workOrderRepository.countOrdersByType(where),
    ])
    const porEstado = { ...stateDefaults }
    const porOrigen = { ...originDefaults }
    const porTipo = { ...typeDefaults }

    for (const group of byState) {
      porEstado[group.estado] = group._count._all
    }

    for (const group of byOrigin) {
      porOrigen[group.origen] = group._count._all
    }

    for (const group of byType) {
      porTipo[group.tipo] = group._count._all
    }

    return {
      activas: activeWorkOrderStates.reduce(
        (totalActive, state) => totalActive + porEstado[state],
        0,
      ),
      pendientesAsignacion: porEstado.PENDIENTE_ASIGNACION,
      pendientesRevision: porEstado.COMPLETADA_TECNICO,
      porEstado,
      porOrigen,
      porTipo,
      total,
    }
  }

  async updateIntervention(
    orderId: string,
    input: InterventionUpdateInput,
    actor: AuthenticatedUser,
  ) {
    ensureMechanic(actor)

    try {
      const result = await this.workOrderRepository.updateActiveIntervention(orderId, actor.id, {
        ...(input.diagnostico !== undefined
          ? { diagnostico: normalizeText(input.diagnostico) }
          : {}),
        ...(input.observaciones !== undefined
          ? { observaciones: normalizeText(input.observaciones) }
          : {}),
      })

      return {
        orden: this.mapOperationResult(result, actor),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  private createOrderBy(query: ListWorkOrdersQuery): Prisma.OrdenTrabajoOrderByWithRelationInput[] {
    const direction = query.direccion

    if (query.ordenarPor === 'bus') {
      return [
        {
          bus: {
            codigoInterno: direction,
          },
        },
        {
          fechaCreacion: 'desc',
        },
      ]
    }

    if (query.ordenarPor === 'codigo') {
      return [{ codigo: direction }]
    }

    if (query.ordenarPor === 'estado') {
      return [{ estado: direction }, { fechaCreacion: 'desc' }]
    }

    if (query.ordenarPor === 'prioridad') {
      return [{ prioridad: direction }, { fechaCreacion: 'desc' }]
    }

    if (query.ordenarPor === 'fechaCierre') {
      return [{ fechaCierre: direction }, { fechaCreacion: 'desc' }]
    }

    if (query.ordenarPor === 'costoTotal') {
      return [{ costoTotal: direction }, { fechaCreacion: 'desc' }]
    }

    return [{ fechaCreacion: direction }]
  }

  private createWhere(query: ListWorkOrdersQuery, tecnicoId?: string): WorkOrderWhere {
    const filters: Prisma.OrdenTrabajoWhereInput[] = []

    if (tecnicoId) {
      filters.push({ tecnicoAsignadoId: tecnicoId })
    } else if (query.tecnicoId) {
      filters.push({ tecnicoAsignadoId: query.tecnicoId })
    }

    if (query.busId) {
      filters.push({ busId: query.busId })
    }

    if (query.estado) {
      filters.push({ estado: query.estado })
    }

    if (query.tipo) {
      filters.push({ tipo: query.tipo })
    }

    if (query.origen) {
      filters.push({ origen: query.origen })
    }

    if (query.busqueda) {
      filters.push({
        OR: [
          {
            codigo: {
              contains: query.busqueda,
              mode: 'insensitive',
            },
          },
          {
            descripcion: {
              contains: query.busqueda,
              mode: 'insensitive',
            },
          },
          {
            bus: {
              codigoInterno: {
                contains: query.busqueda,
                mode: 'insensitive',
              },
            },
          },
          {
            bus: {
              placa: {
                contains: query.busqueda,
                mode: 'insensitive',
              },
            },
          },
          {
            tecnicoAsignado: {
              nombre: {
                contains: query.busqueda,
                mode: 'insensitive',
              },
            },
          },
        ],
      })
    }

    return filters.length > 0 ? { AND: filters } : {}
  }

  private ensureCanReadOrder(order: WorkOrderRecord, actor: AuthenticatedUser) {
    ensureWorkOrderActor(actor)

    if (actor.rol.codigo === 'MECANICO' && order.tecnicoAsignadoId !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'No puede consultar ni modificar una orden ajena')
    }
  }

  private async getAuthorizedOrder(orderId: string, actor: AuthenticatedUser) {
    const order = await this.workOrderRepository.findOrderById(orderId)

    if (!order) {
      throw new AppError(404, 'WORK_ORDER_NOT_FOUND', 'Orden de trabajo no encontrada')
    }

    this.ensureCanReadOrder(order, actor)

    return order
  }

  private isIdempotencyDuplicate(error: unknown) {
    const target = String(
      error instanceof Prisma.PrismaClientKnownRequestError ? (error.meta?.target ?? '') : '',
    ).toLowerCase()

    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      (target.includes('clave_idempotencia') ||
        target.includes('ux_consumos_repuesto_clave_idempotencia'))
    )
  }

  private async listOrders(
    query: ListWorkOrdersQuery,
    actor: AuthenticatedUser,
    tecnicoId?: string,
  ) {
    const where = this.createWhere(query, tecnicoId)
    const skip = (query.pagina - 1) * query.limite
    const [total, orders] = await Promise.all([
      this.workOrderRepository.countOrders(where),
      this.workOrderRepository.listOrders(where, this.createOrderBy(query), skip, query.limite),
    ])

    return {
      ordenes: orders.map((order) => mapSummaryOrder(order, canViewEconomicFields(actor))),
      paginacion: {
        limite: query.limite,
        pagina: query.pagina,
        total,
        totalPaginas: Math.max(1, Math.ceil(total / query.limite)),
      },
    }
  }

  private mapOperationResult(
    result: {
      orden: WorkOrderRecord | null
      status: string
    },
    actor: AuthenticatedUser,
  ) {
    if (result.status === 'BUS_NOT_FOUND') {
      throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    }

    if (result.status === 'BUS_INACTIVE') {
      throw new AppError(400, 'BUS_INACTIVE', 'No se puede crear una orden para un bus inactivo')
    }

    if (!result.orden) {
      throw new AppError(404, 'WORK_ORDER_NOT_FOUND', 'Orden de trabajo no encontrada')
    }

    if (result.status === 'INVALID_MECHANIC') {
      throw new AppError(
        400,
        'INVALID_MECHANIC',
        'Solo se pueden asignar usuarios activos con rol Mecanico',
      )
    }

    if (result.status === 'INVALID_STATE') {
      throw new AppError(
        400,
        'INVALID_ORDER_STATE',
        'La orden no se encuentra en un estado valido para esta accion',
      )
    }

    if (result.status === 'SAME_MECHANIC') {
      throw new AppError(400, 'SAME_MECHANIC', 'La orden ya esta asignada a ese Mecanico')
    }

    if (result.status === 'NOT_ASSIGNED_MECHANIC') {
      throw new AppError(403, 'FORBIDDEN', 'Solo el Mecanico asignado puede ejecutar esta orden')
    }

    if (result.status === 'NO_ACTIVE_INTERVENTION') {
      throw new AppError(
        400,
        'NO_ACTIVE_INTERVENTION',
        'La orden no tiene una intervencion activa para el Mecanico asignado',
      )
    }

    if (result.status === 'FORBIDDEN_TECHNICAL_CLOSURE') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'El cierre de kilometraje tecnico requiere validacion administrativa',
      )
    }

    if (result.status === 'MISSING_ACTIVITY') {
      throw new AppError(
        400,
        'MISSING_ACTIVITY',
        'Debe registrar al menos una actividad antes de completar o cerrar la orden',
      )
    }

    if (result.status === 'MISSING_DIAGNOSIS') {
      throw new AppError(
        400,
        'MISSING_DIAGNOSIS',
        'Debe registrar diagnostico antes de completar una orden correctiva',
      )
    }

    if (result.status === 'MISSING_MECHANIC') {
      throw new AppError(400, 'MISSING_MECHANIC', 'La orden debe tener Mecanico asignado')
    }

    if (result.status === 'SPARE_PART_NOT_FOUND') {
      throw new AppError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
    }

    if (result.status === 'SPARE_PART_INACTIVE') {
      throw new AppError(400, 'SPARE_PART_INACTIVE', 'El repuesto no esta activo')
    }

    if (result.status === 'INSUFFICIENT_STOCK') {
      throw new AppError(400, 'INSUFFICIENT_STOCK', 'No hay existencia suficiente del repuesto')
    }

    if (result.status === 'IDEMPOTENCY_CONFLICT') {
      throw new AppError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'La clave de idempotencia ya fue usada en otra operacion',
      )
    }

    if (result.status === 'INCONSISTENT_CONSUMPTIONS') {
      throw new AppError(
        409,
        'INCONSISTENT_CONSUMPTIONS',
        'Los consumos de la orden no tienen movimientos consistentes',
      )
    }

    if (result.status === 'INCONSISTENT_COST') {
      throw new AppError(
        409,
        'INCONSISTENT_COST',
        'El costo total no coincide con los consumos registrados',
      )
    }

    if (result.status === 'INVALID_PREVENTIVE_SNAPSHOT') {
      throw new AppError(
        409,
        'INVALID_PREVENTIVE_SNAPSHOT',
        'La orden preventiva no conserva un snapshot valido de la obligacion completada',
      )
    }

    if (result.status === 'INVALID_PREVENTIVE_SUCCESSOR') {
      throw new AppError(
        409,
        'INVALID_PREVENTIVE_SUCCESSOR',
        'El plan vigente no permite derivar el siguiente objetivo sin inventar contexto',
      )
    }

    return mapDetailOrder(result.orden, actor, [])
  }
}
