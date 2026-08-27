import { apiRequest } from '../../lib/api'
import type {
  NoveltyDto,
  NoveltyListResponse,
  NoveltyStatus,
  NoveltySummaryDto,
  OrderPriority,
} from './novelty.types'

export interface ListNoveltyParams {
  busqueda?: string
  clasificacion?: string
  estado?: NoveltyStatus | ''
  limite: number
  pagina: number
  prioridad?: OrderPriority | ''
  tipo?: string
}

export interface CreateNoveltyInput {
  descripcion: string
  tipo: string
}

export interface ReviewNoveltyInput {
  accion: 'CLASIFICAR' | 'DESCARTAR' | 'RESOLVER_SIN_ORDEN'
  clasificacion?: string
  observacion?: string
}

export interface ConvertNoveltyInput {
  descripcionOrden?: string
  observacion?: string
  prioridad: OrderPriority
}

function buildNoveltyQuery(params: ListNoveltyParams) {
  const searchParams = new URLSearchParams({
    limite: String(params.limite),
    pagina: String(params.pagina),
  })

  if (params.busqueda?.trim()) {
    searchParams.set('busqueda', params.busqueda.trim())
  }

  if (params.estado) {
    searchParams.set('estado', params.estado)
  }

  if (params.tipo?.trim()) {
    searchParams.set('tipo', params.tipo.trim())
  }

  if (params.clasificacion?.trim()) {
    searchParams.set('clasificacion', params.clasificacion.trim())
  }

  if (params.prioridad) {
    searchParams.set('prioridad', params.prioridad)
  }

  return searchParams.toString()
}

export function getNoveltySummary() {
  return apiRequest<NoveltySummaryDto>('/novedades/resumen')
}

export function listAdminNovelties(params: ListNoveltyParams) {
  return apiRequest<NoveltyListResponse>(`/novedades?${buildNoveltyQuery(params)}`)
}

export function listOwnNovelties(params: Omit<ListNoveltyParams, 'prioridad'>) {
  return apiRequest<NoveltyListResponse>(`/novedades/mis-novedades?${buildNoveltyQuery(params)}`)
}

export function getAdminNovelty(novedadId: string) {
  return apiRequest<{ novedad: NoveltyDto }>(`/novedades/${novedadId}`)
}

export function getOwnNovelty(novedadId: string) {
  return apiRequest<{ novedad: NoveltyDto }>(`/novedades/mis-novedades/${novedadId}`)
}

export function createNovelty(input: CreateNoveltyInput) {
  return apiRequest<{ novedad: NoveltyDto }>('/novedades', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function reviewNovelty(novedadId: string, input: ReviewNoveltyInput) {
  return apiRequest<{ novedad: NoveltyDto }>(`/novedades/${novedadId}/revision`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function convertNoveltyToOrder(novedadId: string, input: ConvertNoveltyInput) {
  return apiRequest<{ novedad: NoveltyDto; orden: NoveltyDto['ordenTrabajo']; yaExistia: boolean }>(
    `/novedades/${novedadId}/convertir-orden`,
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  )
}
