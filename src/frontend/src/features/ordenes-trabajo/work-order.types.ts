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
  id: string
  nombre: string
  telefono: string | null
}

export interface WorkOrderBusDto {
  anio: number
  codigoInterno: string
  estadoOperativo: BusStatus
  id: string
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
  id: string
  tipo: string
}

export interface WorkOrderPreventiveScheduleDto {
  activa: boolean
  actividad: string
  criterio: string
  fechaProgramada: string | null
  id: string
  kilometrajeObjetivo: number | null
  tipo: string
}

export interface WorkOrderStateHistoryDto {
  cambiadoPor: WorkOrderUserDto
  estadoAnterior: WorkOrderStatus | null
  estadoNuevo: WorkOrderStatus
  fechaCambio: string
  id: string
  observacion: string | null
}

export interface WorkOrderReassignmentDto {
  fechaReasignacion: string
  id: string
  motivo: string | null
  reasignadoPor: WorkOrderUserDto
  tecnicoAnterior: WorkOrderUserDto | null
  tecnicoNuevo: WorkOrderUserDto
}

export interface WorkOrderActivityDto {
  descripcion: string
  fechaRegistro: string
  id: string
  registradaPor: WorkOrderUserDto
}

export interface WorkOrderInterventionDto {
  actividades: WorkOrderActivityDto[]
  diagnostico: string | null
  fechaFin: string | null
  fechaInicio: string
  id: string
  observaciones: string | null
  tecnico: WorkOrderUserDto
}

export interface WorkOrderSparePartDto {
  categoria: string | null
  codigo: string
  costoUnitario: string
  estado: 'ACTIVO' | 'INACTIVO'
  id: string
  nombre: string
  stockActual: string
  stockMinimo: string
  unidadMedida: string
}

export interface WorkOrderInventoryMovementDto {
  cantidad: string
  costoUnitario: string | null
  fechaMovimiento: string
  id: string
  motivo: string | null
  tipo: string
}

export interface WorkOrderConsumptionDto {
  cantidad: string
  costoUnitario: string
  fechaConsumo: string
  id: string
  movimientoInventario: WorkOrderInventoryMovementDto | null
  repuesto: WorkOrderSparePartDto
  subtotal: string
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
  costoTotal: string
  descripcion: string
  estado: WorkOrderStatus
  fechaAsignacion: string | null
  fechaCierre: string | null
  fechaCompletadaTecnico: string | null
  fechaCreacion: string
  fechaInicioEjecucion: string | null
  id: string
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
  id: string
  tipo: WorkOrderType
}

export interface WorkOrderDetailDto extends WorkOrderSummaryItemDto {
  acciones: WorkOrderActionFlagsDto
  cerradaPor: WorkOrderUserDto | null
  consumosRepuesto: WorkOrderConsumptionDto[]
  creadaPor: WorkOrderUserDto
  fechaObjetivoPreventivo: string | null
  historialEstados: WorkOrderStateHistoryDto[]
  historialTecnicoBus: WorkOrderTechnicalHistoryItemDto[]
  intervenciones: WorkOrderInterventionDto[]
  kilometrajeObjetivoPreventivo: number | null
  motivoDevolucionActual: string | null
  novedad: WorkOrderNoveltyDto | null
  programacionMantenimiento: WorkOrderPreventiveScheduleDto | null
  reasignaciones: WorkOrderReassignmentDto[]
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
export type AvailableSparePartDto = WorkOrderSparePartDto
