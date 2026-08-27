export type NoveltyStatus =
  'CONVERTIDA_A_ORDEN' | 'DESCARTADA' | 'PENDIENTE_REVISION' | 'RESUELTA_SIN_ORDEN'

export type OrderPriority = 'ALTA' | 'BAJA' | 'MEDIA'

export interface NoveltyUserDto {
  email?: string
  id: string
  nombre: string
}

export interface NoveltyBusDto {
  codigoInterno: string
  estadoOperativo: string
  id: string
  placa: string
}

export interface WorkOrderSummaryDto {
  codigo: string
  descripcion?: string
  estado: string
  fechaCreacion: string
  id: string
  origen: 'NOVEDAD'
  prioridad: OrderPriority
  tipo: 'CORRECTIVA'
}

export interface NoveltyDto {
  bus: NoveltyBusDto
  clasificacion: string | null
  conductor: NoveltyUserDto
  descripcion: string
  estado: NoveltyStatus
  fechaReporte: string
  fechaRevision: string | null
  id: string
  observacionRevision: string | null
  ordenTrabajo: WorkOrderSummaryDto | null
  revisadaPor: NoveltyUserDto | null
  tipo: string
  updatedAt: string
}

export interface NoveltyListResponse {
  novedades: NoveltyDto[]
  paginacion: {
    limite: number
    pagina: number
    total: number
    totalPaginas: number
  }
}

export interface NoveltySummaryDto {
  estados: Record<NoveltyStatus, number>
  ordenesGeneradas: number
  pendientes: number
  total: number
}
