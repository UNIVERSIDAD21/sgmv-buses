import type {
  WorkOrderOrigin,
  WorkOrderStatus,
  WorkOrderType,
} from '../ordenes-trabajo/work-order.types'

export type SparePartAvailability = 'AGOTADO' | 'BAJO' | 'DISPONIBLE' | 'INACTIVO'
export type SparePartStatus = 'ACTIVO' | 'INACTIVO'
export type InventoryMovementType = 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA' | 'CONSUMO' | 'ENTRADA'

export interface SparePartUserDto {
  email: string
  id: number
  nombre: string
  telefono: string | null
}

export interface SparePartOrderDto {
  codigo: string
  estado: WorkOrderStatus
  id: number
  origen: WorkOrderOrigin
  tipo: WorkOrderType
}

export interface SparePartSummaryItemDto {
  categoria: string | null
  codigo: string
  costoUnitario: string
  disponibilidad: SparePartAvailability
  estado: SparePartStatus
  id: number
  nombre: string
  stockActual: string
  stockMinimo: string
  unidadMedida: string
  valorActual: string
}

export interface SparePartDto extends SparePartSummaryItemDto {
  createdAt: string
  dimensiones: Record<string, unknown> | null
  especificaciones: Record<string, unknown> | null
  fabricante: string | null
  numeroParte: string | null
  updatedAt: string
}

export interface CompatibilityRuleDto {
  bus: { codigoInterno: string; id: number } | null
  busId: number | null
  condicionUso: string | null
  definidaPor: { id: number; nombre: string }
  especificacionesValidadas: Record<string, unknown>
  fechaDefinicion: string
  id: number
  modeloBus: { id: number; marca: string; nombreModelo: string } | null
  modeloBusId: number | null
  permitido: boolean
  version: number
  vigente: boolean
}

export interface SparePartMovementDto {
  cantidad: string
  consumo: {
    id: number
    intervencion: {
      id: number
    } | null
    orden: SparePartOrderDto
  } | null
  costoUnitario: string | null
  direccion: 'ENTRADA' | 'SALIDA'
  fechaMovimiento: string
  id: number
  motivo: string | null
  repuesto: SparePartSummaryItemDto
  responsable: SparePartUserDto
  tipo: InventoryMovementType
}

export interface SparePartListResponse {
  paginacion: {
    limite: number
    pagina: number
    total: number
    totalPaginas: number
  }
  repuestos: SparePartDto[]
}

export interface SparePartMovementListResponse {
  movimientos: SparePartMovementDto[]
  paginacion: {
    limite: number
    pagina: number
    total: number
    totalPaginas: number
  }
}

export interface SparePartSummaryDto {
  agotados: number
  bajoStock: number
  disponibles: number
  inactivos: number
  movimientosRecientes: SparePartMovementDto[]
  totalActivos: number
  totalRepuestos: number
  valorInventario: string
}

export interface SparePartOperationDto {
  cantidadAplicada: string
  movimiento: SparePartMovementDto | null
  repuesto: SparePartDto
  stockAnterior: string | null
  stockResultante: string
  yaExistia: boolean
}
