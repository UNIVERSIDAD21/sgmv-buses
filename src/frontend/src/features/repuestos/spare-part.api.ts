import { apiRequest } from '../../lib/api'
import type {
  InventoryMovementType,
  SparePartAvailability,
  SparePartDto,
  SparePartListResponse,
  SparePartMovementListResponse,
  SparePartOperationDto,
  SparePartStatus,
  SparePartSummaryDto,
} from './spare-part.types'

export interface ListSparePartsParams {
  busqueda?: string
  categoria?: string
  direccion?: 'asc' | 'desc'
  disponibilidad?: SparePartAvailability | ''
  estado?: SparePartStatus | ''
  limite: number
  ordenarPor?:
    | 'categoria'
    | 'codigo'
    | 'costoUnitario'
    | 'createdAt'
    | 'nombre'
    | 'stockActual'
    | 'stockMinimo'
    | 'updatedAt'
  pagina: number
}

export interface ListMovementsParams {
  busqueda?: string
  direccion?: 'asc' | 'desc'
  fechaDesde?: string
  fechaHasta?: string
  limite: number
  ordenarPor?: 'cantidad' | 'codigo' | 'fechaMovimiento' | 'tipo'
  pagina: number
  responsableId?: string
  tipo?: InventoryMovementType | ''
}

export interface CreateSparePartInput {
  categoria?: string
  claveIdempotencia?: string
  codigo: string
  costoUnitario: string
  motivoStockInicial?: string
  nombre: string
  stockInicial: string
  stockMinimo: string
  unidadMedida: string
}

export interface UpdateSparePartInput {
  categoria?: string
  codigo?: string
  costoUnitario?: string
  nombre?: string
  stockMinimo?: string
  unidadMedida?: string
}

export interface StockEntryInput {
  cantidad: string
  claveIdempotencia: string
  costoUnitario?: string
  motivo: string
}

export interface StockAdjustmentInput {
  cantidad: string
  claveIdempotencia: string
  direccion: 'DISMINUCION' | 'INCREMENTO'
  motivo: string
}

function buildSparePartQuery(params: ListSparePartsParams) {
  const searchParams = new URLSearchParams({
    limite: String(params.limite),
    pagina: String(params.pagina),
  })

  if (params.busqueda?.trim()) {
    searchParams.set('busqueda', params.busqueda.trim())
  }

  if (params.categoria?.trim()) {
    searchParams.set('categoria', params.categoria.trim())
  }

  if (params.direccion) {
    searchParams.set('direccion', params.direccion)
  }

  if (params.disponibilidad) {
    searchParams.set('disponibilidad', params.disponibilidad)
  }

  if (params.estado) {
    searchParams.set('estado', params.estado)
  }

  if (params.ordenarPor) {
    searchParams.set('ordenarPor', params.ordenarPor)
  }

  return searchParams.toString()
}

function buildMovementQuery(params: ListMovementsParams) {
  const searchParams = new URLSearchParams({
    limite: String(params.limite),
    pagina: String(params.pagina),
  })

  if (params.busqueda?.trim()) {
    searchParams.set('busqueda', params.busqueda.trim())
  }

  if (params.direccion) {
    searchParams.set('direccion', params.direccion)
  }

  if (params.fechaDesde) {
    searchParams.set('fechaDesde', params.fechaDesde)
  }

  if (params.fechaHasta) {
    searchParams.set('fechaHasta', params.fechaHasta)
  }

  if (params.ordenarPor) {
    searchParams.set('ordenarPor', params.ordenarPor)
  }

  if (params.responsableId) {
    searchParams.set('responsableId', params.responsableId)
  }

  if (params.tipo) {
    searchParams.set('tipo', params.tipo)
  }

  return searchParams.toString()
}

export function getSparePartSummary() {
  return apiRequest<SparePartSummaryDto>('/repuestos/resumen')
}

export function listSpareParts(params: ListSparePartsParams) {
  return apiRequest<SparePartListResponse>(`/repuestos?${buildSparePartQuery(params)}`)
}

export function getSparePart(repuestoId: string) {
  return apiRequest<{ repuesto: SparePartDto }>(`/repuestos/${repuestoId}`)
}

export function createSparePart(input: CreateSparePartInput) {
  return apiRequest<{
    movimientoInicial: SparePartOperationDto['movimiento']
    repuesto: SparePartDto
    yaExistia: boolean
  }>('/repuestos', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function updateSparePart(repuestoId: string, input: UpdateSparePartInput) {
  return apiRequest<{ repuesto: SparePartDto }>(`/repuestos/${repuestoId}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export function activateSparePart(repuestoId: string) {
  return apiRequest<{ repuesto: SparePartDto; yaExistia: boolean }>(
    `/repuestos/${repuestoId}/activar`,
    {
      body: JSON.stringify({}),
      method: 'POST',
    },
  )
}

export function deactivateSparePart(repuestoId: string) {
  return apiRequest<{ repuesto: SparePartDto; yaExistia: boolean }>(
    `/repuestos/${repuestoId}/desactivar`,
    {
      body: JSON.stringify({}),
      method: 'POST',
    },
  )
}

export function registerStockEntry(repuestoId: string, input: StockEntryInput) {
  return apiRequest<SparePartOperationDto>(`/repuestos/${repuestoId}/entradas`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function registerStockAdjustment(repuestoId: string, input: StockAdjustmentInput) {
  return apiRequest<SparePartOperationDto>(`/repuestos/${repuestoId}/ajustes`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function listInventoryMovements(params: ListMovementsParams) {
  return apiRequest<SparePartMovementListResponse>(
    `/inventario/movimientos?${buildMovementQuery(params)}`,
  )
}

export function listSparePartMovements(repuestoId: string, params: ListMovementsParams) {
  return apiRequest<SparePartMovementListResponse>(
    `/repuestos/${repuestoId}/movimientos?${buildMovementQuery(params)}`,
  )
}
