import type { BusStatus } from '../flota/fleet.types'
import type { OrderPriority } from '../novedades/novelty.types'

export type WorkOrderStatus =
  | 'ASIGNADA'
  | 'CERRADA'
  | 'COMPLETADA_TECNICO'
  | 'DEVUELTA_CORRECCION'
  | 'EN_EJECUCION'
  | 'PENDIENTE_ASIGNACION'

export type WorkOrderType = 'CORRECTIVA' | 'PREVENTIVA'
export type WorkOrderOrigin = 'CORRECTIVO_DIRECTO' | 'NOVEDAD' | 'PREVENTIVO'

export interface WorkOrderUserDto {
  email: string
  id: number
  nombre: string
  telefono: string | null
}

export interface WorkOrderActorReferenceDto {
  id: number
  nombre: string
}

export interface WorkOrderBusDto {
  anio: number
  codigoInterno: string
  estadoOperativo: BusStatus
  id: number
  kilometrajeActual: number
  marca: string
  modelo: string
  placa: string
}

export interface WorkOrderNoveltyDto {
  clasificacion: string | null
  conductor: WorkOrderUserDto
  descripcion: string
  estado: string
  fechaReporte: string
  id: number
  tipo: string
}

export interface WorkOrderPreventiveScheduleDto {
  activa: boolean
  actividad: string
  criterio: string
  fechaProgramada: string | null
  id: number
  kilometrajeObjetivo: number | null
  tipo: string
}

export interface WorkOrderStateHistoryDto {
  cambiadoPor: WorkOrderUserDto
  estadoAnterior: WorkOrderStatus | null
  estadoNuevo: WorkOrderStatus
  fechaCambio: string
  id: number
  observacion: string | null
}

export interface WorkOrderReassignmentDto {
  fechaReasignacion: string
  id: number
  motivo: string | null
  reasignadoPor: WorkOrderUserDto
  tecnicoAnterior: WorkOrderUserDto | null
  tecnicoNuevo: WorkOrderUserDto
}

export interface WorkOrderActivityDto {
  descripcion: string
  fechaRegistro: string
  id: number
  registradaPor: WorkOrderUserDto
}

export interface WorkOrderInterventionDto {
  actividades: WorkOrderActivityDto[]
  diagnostico: string | null
  fechaFin: string | null
  fechaInicio: string
  id: number
  observaciones: string | null
  tecnico: WorkOrderUserDto
}

export interface WorkOrderSparePartDto {
  categoria: string | null
  codigo: string
  costoUnitario?: string
  estado: 'ACTIVO' | 'INACTIVO'
  id: number
  nombre: string
  stockActual: string
  stockMinimo: string
  unidadMedida: string
}

export interface WorkOrderInventoryMovementDto {
  cantidad: string
  costoUnitario?: string | null
  fechaMovimiento: string
  id: number
  motivo: string | null
  tipo: string
}

export interface WorkOrderConsumptionDto {
  autorizadoPorId: number | null
  autorizacionExcepcionId: number | null
  cantidad: string
  costoUnitario?: string
  fechaConsumo: string
  id: number
  movimientoInventario: WorkOrderInventoryMovementDto | null
  repuesto: WorkOrderSparePartDto
  subtotal?: string
  resultadoCompatibilidad: 'COMPATIBLE' | 'EXCEPCION_AUTORIZADA' | 'NO_EVALUADA_LEGADO' | null
  reglaCompatibilidadId: number | null
  reglaVersion: number | null
  evidenciaCompatibilidad: Record<string, unknown> | null
  motivoExcepcion: string | null
}

export interface WorkOrderConsumptionAuthorizationDto {
  autorizadoPor: WorkOrderActorReferenceDto
  cantidadMaxima: string
  estado: 'REVOCADA' | 'USADA' | 'VIGENTE'
  fechaAutorizacion: string
  fechaExpiracion: string | null
  id: number
  intervencionId: number
  motivo: string
  repuesto: WorkOrderSparePartDto
}

export interface WorkOrderJourneyDto {
  estado: string
  finProgramado: string
  finReal: string | null
  id: number
  inicioProgramado: string
  inicioReal: string | null
  ruta: { codigo: string; id: number; nombre: string } | null
}

export type TechnicalReadingType = 'INGRESO_TALLER' | 'REVISION_TECNICA' | 'CIERRE_MANTENIMIENTO'

export interface WorkOrderTechnicalReadingDto {
  fechaLectura: string
  id: number
  intervencionId: number | null
  kilometraje: number
  kilometrajeAnterior: number
  motivo: string | null
  registradoPor: WorkOrderUserDto
  tipo: TechnicalReadingType
}

export interface DispatchWorkOrderProjectionDto {
  disponibilidad: {
    causaPrincipal: string | null
    causas: Array<{
      codigo: string
      mensaje: string
      origenId: number
      origenTipo: 'BUS' | 'JORNADA' | 'NOVEDAD' | 'ORDEN' | 'PREVENTIVO'
    }>
    disponible: boolean
    evaluadoAt: string
  }
  orden: {
    bus: { codigoInterno: string; id: number; placa: string }
    codigo: string
    disponibilidadAlCierre: boolean | null
    estado: WorkOrderStatus
    fechaCierre: string | null
    id: number
  }
}

export interface WorkOrderActionFlagsDto {
  puedeAsignar: boolean
  puedeCerrar: boolean
  puedeCompletar: boolean
  puedeDevolver: boolean
  puedeIniciar: boolean
  puedeReanudar: boolean
  puedeReasignar: boolean
  puedeRegistrarTecnica: boolean
}

export interface WorkOrderSummaryItemDto {
  bus: WorkOrderBusDto
  codigo: string
  costoTotal?: string
  descripcion: string
  estado: WorkOrderStatus
  fechaAsignacion: string | null
  fechaCierre: string | null
  fechaCompletadaTecnico: string | null
  fechaCreacion: string
  fechaInicioEjecucion: string | null
  id: number
  origen: WorkOrderOrigin
  prioridad: OrderPriority
  tecnicoAsignado: WorkOrderUserDto | null
  tipo: WorkOrderType
}

export interface WorkOrderTechnicalHistoryItemDto {
  codigo: string
  diagnostico: string | null
  estado: WorkOrderStatus
  fechaCierre: string | null
  id: number
  tipo: WorkOrderType
}

export interface WorkOrderDetailDto extends WorkOrderSummaryItemDto {
  acciones: WorkOrderActionFlagsDto
  autorizacionesExcepcion: WorkOrderConsumptionAuthorizationDto[]
  cerradaPor: WorkOrderUserDto | null
  consumosRepuesto: WorkOrderConsumptionDto[]
  creadaPor: WorkOrderUserDto
  fechaObjetivoPreventivo: string | null
  historialEstados: WorkOrderStateHistoryDto[]
  historialTecnicoBus: WorkOrderTechnicalHistoryItemDto[]
  intervenciones: WorkOrderInterventionDto[]
  jornadaOperativa: WorkOrderJourneyDto | null
  lecturasTecnicas: WorkOrderTechnicalReadingDto[]
  kilometrajeObjetivoPreventivo: number | null
  motivoDevolucionActual: string | null
  novedad: WorkOrderNoveltyDto | null
  programacionMantenimiento: WorkOrderPreventiveScheduleDto | null
  reasignaciones: WorkOrderReassignmentDto[]
  disponibilidadAlCierre: boolean | null
}

export interface WorkOrderListResponse {
  ordenes: WorkOrderSummaryItemDto[]
  paginacion: {
    limite: number
    pagina: number
    total: number
    totalPaginas: number
  }
}

export interface WorkOrderSummaryDto {
  activas: number
  pendientesAsignacion: number
  pendientesRevision: number
  porEstado: Record<WorkOrderStatus, number>
  porOrigen: Record<WorkOrderOrigin, number>
  porTipo: Record<WorkOrderType, number>
  total: number
}

export type MechanicOptionDto = WorkOrderUserDto
export interface AvailableSparePartDto extends WorkOrderSparePartDto {
  compatibilidad: {
    condicionUso: string | null
    evidencia: Record<string, unknown>
    resultado: 'COMPATIBLE' | 'INCOMPATIBLE' | 'SIN_EVIDENCIA'
    reglaId: number | null
    version: number | null
  }
}
