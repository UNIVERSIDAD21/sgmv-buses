import { apiRequest } from '../../lib/api'
import type { OrderPriority } from '../novedades/novelty.types'
import type {
  PreventiveCriterion,
  PreventiveListResponse,
  PreventiveScheduleDto,
  PreventiveStatus,
  PreventiveSummaryDto,
} from './preventive.types'

export interface ListPreventiveParams {
  activa?: boolean | ''
  busId?: string
  busqueda?: string
  criterio?: PreventiveCriterion | ''
  direccion?: 'asc' | 'desc'
  estado?: PreventiveStatus | ''
  limite: number
  ordenarPor?:
    'actividad' | 'bus' | 'createdAt' | 'estado' | 'fechaProgramada' | 'kilometrajeObjetivo'
  pagina: number
}

export interface PreventiveScheduleInput {
  activa?: boolean
  actividad: string
  busId?: string
  criterio: PreventiveCriterion
  fechaProgramada?: string
  kilometrajeObjetivo?: number
  tipo: string
}

export interface GeneratePreventiveOrderInput {
  descripcionOrden?: string
  observacion?: string
  prioridad: OrderPriority
}

function buildPreventiveQuery(params: ListPreventiveParams) {
  const searchParams = new URLSearchParams({
    limite: String(params.limite),
    pagina: String(params.pagina),
  })

  if (params.activa !== undefined && params.activa !== '') {
    searchParams.set('activa', String(params.activa))
  }

  if (params.busqueda?.trim()) {
    searchParams.set('busqueda', params.busqueda.trim())
  }

  if (params.busId) {
    searchParams.set('busId', params.busId)
  }

  if (params.criterio) {
    searchParams.set('criterio', params.criterio)
  }

  if (params.direccion) {
    searchParams.set('direccion', params.direccion)
  }

  if (params.estado) {
    searchParams.set('estado', params.estado)
  }

  if (params.ordenarPor) {
    searchParams.set('ordenarPor', params.ordenarPor)
  }

  return searchParams.toString()
}

export function getPreventiveSummary() {
  return apiRequest<PreventiveSummaryDto>('/mantenimiento-preventivo/resumen')
}

export function listPreventiveSchedules(params: ListPreventiveParams) {
  return apiRequest<PreventiveListResponse>(
    `/mantenimiento-preventivo/programaciones?${buildPreventiveQuery(params)}`,
  )
}

export function getPreventiveSchedule(programacionId: string) {
  return apiRequest<{ programacion: PreventiveScheduleDto }>(
    `/mantenimiento-preventivo/programaciones/${programacionId}`,
  )
}

export function createPreventiveSchedule(input: PreventiveScheduleInput) {
  return apiRequest<{ programacion: PreventiveScheduleDto }>(
    '/mantenimiento-preventivo/programaciones',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  )
}

export function updatePreventiveSchedule(
  programacionId: string,
  input: Omit<PreventiveScheduleInput, 'busId'>,
) {
  return apiRequest<{ programacion: PreventiveScheduleDto }>(
    `/mantenimiento-preventivo/programaciones/${programacionId}`,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
  )
}

export function generatePreventiveOrder(
  programacionId: string,
  input: GeneratePreventiveOrderInput,
) {
  return apiRequest<{
    orden: PreventiveScheduleDto['ordenActiva']
    programacion: PreventiveScheduleDto
    yaExistia: boolean
  }>(`/mantenimiento-preventivo/programaciones/${programacionId}/generar-orden`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}
