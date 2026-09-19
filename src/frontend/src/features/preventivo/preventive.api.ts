import { apiRequest } from '../../lib/api'
import type { OrderPriority } from '../novedades/novelty.types'
import type {
  PreventiveCriterion,
  PreventiveListResponse,
  PreventiveScheduleDto,
  PreventivePlanDto,
  PreventivePlanDetailDto,
  PreventiveRestrictionDto,
  PreventiveStatus,
  PreventiveSummaryDto,
} from './preventive.types'

export interface PreventivePlanInput {
  actividad: string
  anticipacionDias?: number
  anticipacionKm?: number
  bloqueaAlVencer: boolean
  busId?: number
  claveTarea?: string
  componente: string
  criterio: PreventiveCriterion
  intervaloDias?: number
  intervaloKm?: number
  modeloBusId?: number
  prioridad: OrderPriority
}

export interface ListPreventiveParams {
  activa?: boolean | ''
  busId?: number
  busqueda?: string
  criterio?: PreventiveCriterion | ''
  direccion?: 'asc' | 'desc'
  estado?: PreventiveStatus | ''
  limite: number
  ordenarPor?:
    'actividad' | 'bus' | 'createdAt' | 'estado' | 'fechaProgramada' | 'kilometrajeObjetivo'
  pagina: number
  requiereAtencion?: boolean
}

export interface PreventiveScheduleInput {
  activa?: boolean
  actividad: string
  busId?: number
  criterio: PreventiveCriterion
  fechaProgramada?: string
  kilometrajeObjetivo?: number
  tipo: string
}

export interface ApplyPreventivePlanInput {
  busId?: number
  planId: number
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
    searchParams.set('busId', String(params.busId))
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

  if (params.requiereAtencion) {
    searchParams.set('requiereAtencion', 'true')
  }

  if (params.ordenarPor) {
    searchParams.set('ordenarPor', params.ordenarPor)
  }

  return searchParams.toString()
}

export function getPreventiveSummary() {
  return apiRequest<PreventiveSummaryDto>('/mantenimiento-preventivo/resumen')
}

export function listPreventivePlans(incluirHistoricos = false) {
  return apiRequest<{ planes: PreventivePlanDto[] }>(
    `/mantenimiento-preventivo/planes${incluirHistoricos ? '?incluirHistoricos=true' : ''}`,
  )
}

export function getPreventivePlan(planId: number) {
  return apiRequest<PreventivePlanDetailDto>(`/mantenimiento-preventivo/planes/${planId}`)
}

export function createPreventivePlan(input: PreventivePlanInput) {
  return apiRequest<{ plan: PreventivePlanDto }>('/mantenimiento-preventivo/planes', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function createPreventivePlanVersion(
  planId: number,
  input: Omit<PreventivePlanInput, 'busId' | 'claveTarea' | 'modeloBusId'>,
) {
  return apiRequest<{ plan: PreventivePlanDto }>(
    `/mantenimiento-preventivo/planes/${planId}/versiones`,
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  )
}

export function deactivatePreventivePlan(planId: number) {
  return apiRequest<{ plan: PreventivePlanDto }>(
    `/mantenimiento-preventivo/planes/${planId}/desactivar`,
    {
      body: JSON.stringify({}),
      method: 'POST',
    },
  )
}

export function listPreventiveRestrictions() {
  return apiRequest<{ evaluadoAt: string; restricciones: PreventiveRestrictionDto[] }>(
    '/mantenimiento-preventivo/restricciones',
  )
}

export function listPreventiveSchedules(params: ListPreventiveParams) {
  return apiRequest<PreventiveListResponse>(
    `/mantenimiento-preventivo/programaciones?${buildPreventiveQuery(params)}`,
  )
}

export function getPreventiveSchedule(programacionId: number) {
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

export function applyPreventivePlan(input: ApplyPreventivePlanInput) {
  return apiRequest<{ programacion: PreventiveScheduleDto; yaExistia: boolean }>(
    '/mantenimiento-preventivo/programaciones',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  )
}

export function updatePreventiveSchedule(
  programacionId: number,
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
  programacionId: number,
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
