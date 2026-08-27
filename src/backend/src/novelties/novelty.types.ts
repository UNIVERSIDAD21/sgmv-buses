import type { EstadoNovedad, EstadoOrdenTrabajo, PrioridadOrden } from '@prisma/client'

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
  estado: EstadoOrdenTrabajo
  fechaCreacion: string
  id: string
  origen: 'NOVEDAD'
  prioridad: PrioridadOrden
  tipo: 'CORRECTIVA'
}

export interface NoveltyDto {
  bus: NoveltyBusDto
  clasificacion: string | null
  conductor: NoveltyUserDto
  descripcion: string
  estado: EstadoNovedad
  fechaReporte: string
  fechaRevision: string | null
  id: string
  observacionRevision: string | null
  ordenTrabajo: WorkOrderSummaryDto | null
  revisadaPor: NoveltyUserDto | null
  tipo: string
  updatedAt: string
}

export interface NoveltyListDto {
  novedades: NoveltyDto[]
  paginacion: {
    limite: number
    pagina: number
    total: number
    totalPaginas: number
  }
}

export interface NoveltySummaryDto {
  estados: Record<EstadoNovedad, number>
  ordenesGeneradas: number
  pendientes: number
  total: number
}
