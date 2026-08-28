import type {
  CriterioMantenimiento,
  EstadoBus,
  EstadoNovedad,
  EstadoOrdenTrabajo,
  EstadoRepuesto,
  OrigenOrdenTrabajo,
  PrioridadOrden,
  TipoMovimientoInventario,
  TipoOrdenTrabajo,
} from '@prisma/client'

export interface WorkOrderUserDto {
  email: string
  id: string
  nombre: string
  telefono: string | null
}

export interface WorkOrderBusDto {
  anio: number
  codigoInterno: string
  estadoOperativo: EstadoBus
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
  estado: EstadoNovedad
  fechaReporte: string
  id: string
  tipo: string
}

export interface WorkOrderPreventiveScheduleDto {
  activa: boolean
  actividad: string
  criterio: CriterioMantenimiento
  fechaProgramada: string | null
  id: string
  kilometrajeObjetivo: number | null
  tipo: string
}

export interface WorkOrderStateHistoryDto {
  cambiadoPor: WorkOrderUserDto
  estadoAnterior: EstadoOrdenTrabajo | null
  estadoNuevo: EstadoOrdenTrabajo
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

export interface WorkOrderInventoryMovementDto {
  cantidad: string
  costoUnitario: string | null
  fechaMovimiento: string
  id: string
  motivo: string | null
  tipo: TipoMovimientoInventario
}

export interface WorkOrderSparePartDto {
  categoria: string | null
  codigo: string
  costoUnitario: string
  estado: EstadoRepuesto
  id: string
  nombre: string
  stockActual: string
  stockMinimo: string
  unidadMedida: string
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
  estado: EstadoOrdenTrabajo
  fechaAsignacion: string | null
  fechaCierre: string | null
  fechaCompletadaTecnico: string | null
  fechaCreacion: string
  fechaInicioEjecucion: string | null
  id: string
  origen: OrigenOrdenTrabajo
  prioridad: PrioridadOrden
  tecnicoAsignado: WorkOrderUserDto | null
  tipo: TipoOrdenTrabajo
}

export interface WorkOrderTechnicalHistoryItemDto {
  codigo: string
  diagnostico: string | null
  estado: EstadoOrdenTrabajo
  fechaCierre: string | null
  id: string
  tipo: TipoOrdenTrabajo
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

export interface WorkOrderListDto {
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
  porEstado: Record<EstadoOrdenTrabajo, number>
  porOrigen: Record<OrigenOrdenTrabajo, number>
  porTipo: Record<TipoOrdenTrabajo, number>
  total: number
}

export type MechanicOptionDto = WorkOrderUserDto

export type AvailableSparePartDto = WorkOrderSparePartDto
