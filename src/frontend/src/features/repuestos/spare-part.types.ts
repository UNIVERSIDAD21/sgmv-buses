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
  id: string
  nombre: string
  telefono: string | null
}

export interface SparePartOrderDto {
  codigo: string
  estado: WorkOrderStatus
  id: string
  origen: WorkOrderOrigin
  tipo: WorkOrderType
}

export interface SparePartSummaryItemDto {
  categoria: string | null
  codigo: string
  costoUnitario: string
  disponibilidad: SparePartAvailability
  estado: SparePartStatus
  id: string
  nombre: string
  stockActual: string
  stockMinimo: string
  unidadMedida: string
  valorActual: string
}

export interface SparePartDto extends SparePartSummaryItemDto {
  createdAt: string
  updatedAt: string
}

export interface SparePartMovementDto {
  cantidad: string
  consumo: {
    id: string
    orden: SparePartOrderDto
  } | null
  costoUnitario: string | null
  direccion: 'ENTRADA' | 'SALIDA'
  fechaMovimiento: string
  id: string
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
