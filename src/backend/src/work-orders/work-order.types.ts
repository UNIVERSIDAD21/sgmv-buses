import type {
  CriterioMantenimiento,
  EstadoBus,
  EstadoJornada,
  EstadoNovedad,
  EstadoOrdenTrabajo,
  EstadoRepuesto,
  OrigenOrdenTrabajo,
  PrioridadOrden,
  TipoMovimientoInventario,
  TipoOrdenTrabajo,
} from '@prisma/client'

import type { AvailabilityDto } from '../availability/availability.types.js'

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
  estadoOperativo: EstadoBus
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
  estado: EstadoNovedad
  fechaReporte: string
  id: number
  tipo: string
}

export interface WorkOrderPreventiveScheduleDto {
  activa: boolean
  actividad: string
  criterio: CriterioMantenimiento
  fechaProgramada: string | null
  id: number
  kilometrajeObjetivo: number | null
  tipo: string
}

export interface WorkOrderStateHistoryDto {
  cambiadoPor: WorkOrderUserDto
  estadoAnterior: EstadoOrdenTrabajo | null
  estadoNuevo: EstadoOrdenTrabajo
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

export interface WorkOrderInventoryMovementDto {
  cantidad: string
  costoUnitario?: string | null
  fechaMovimiento: string
  id: number
  motivo: string | null
  tipo: TipoMovimientoInventario
}

export interface WorkOrderSparePartDto {
  categoria: string | null
  codigo: string
  costoUnitario?: string
  estado: EstadoRepuesto
  id: number
  nombre: string
  stockActual: string
  stockMinimo: string
  unidadMedida: string
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
  resultadoCompatibilidad: 'COMPATIBLE' | 'EXCEPCION_AUTORIZADA' | 'NO_EVALUADA_LEGADO' | null
  reglaCompatibilidadId: number | null
  reglaVersion: number | null
  evidenciaCompatibilidad: Record<string, unknown> | null
  motivoExcepcion: string | null
  subtotal?: string
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
  estado: EstadoJornada
  finProgramado: string
  finReal: string | null
  id: number
  inicioProgramado: string
  inicioReal: string | null
  ruta: { codigo: string; id: number; nombre: string } | null
}

export interface WorkOrderTechnicalReadingDto {
  fechaLectura: string
  id: number
  intervencionId: number | null
  kilometraje: number
  kilometrajeAnterior: number
  motivo: string | null
  registradoPor: WorkOrderUserDto
  tipo: 'INGRESO_TALLER' | 'REVISION_TECNICA' | 'CIERRE_MANTENIMIENTO'
}

export interface DispatchWorkOrderProjectionDto {
  disponibilidad: Omit<AvailabilityDto, 'causas'> & {
    causas: Array<
      Pick<AvailabilityDto['causas'][number], 'codigo' | 'mensaje' | 'origenId' | 'origenTipo'>
    >
  }
  orden: {
    bus: { codigoInterno: string; id: number; placa: string }
    codigo: string
    disponibilidadAlCierre: boolean | null
    estado: EstadoOrdenTrabajo
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
  estado: EstadoOrdenTrabajo
  fechaAsignacion: string | null
  fechaCierre: string | null
  fechaCompletadaTecnico: string | null
  fechaCreacion: string
  fechaInicioEjecucion: string | null
  id: number
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
  id: number
  tipo: TipoOrdenTrabajo
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

export interface AvailableSparePartDto extends WorkOrderSparePartDto {
  compatibilidad: {
    condicionUso: string | null
    evidencia: Record<string, unknown>
    resultado: 'COMPATIBLE' | 'INCOMPATIBLE' | 'SIN_EVIDENCIA'
    reglaId: number | null
    version: number | null
  }
}
