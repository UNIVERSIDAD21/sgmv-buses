import { apiRequest } from '../../lib/api'
import type { OrderPriority } from '../novedades/novelty.types'
import type {
  AvailableSparePartDto,
  MechanicOptionDto,
  WorkOrderDetailDto,
  WorkOrderListResponse,
  WorkOrderOrigin,
  WorkOrderStatus,
  WorkOrderSummaryDto,
  WorkOrderType,
} from './work-order.types'

export interface ListWorkOrdersParams {
  busId?: string
  busqueda?: string
  direccion?: 'asc' | 'desc'
  estado?: WorkOrderStatus | ''
  limite: number
  ordenarPor?:
    'bus' | 'codigo' | 'costoTotal' | 'estado' | 'fechaCierre' | 'fechaCreacion' | 'prioridad'
  origen?: WorkOrderOrigin | ''
  pagina: number
  tecnicoId?: string
  tipo?: WorkOrderType | ''
}

export interface CreateManualWorkOrderInput {
  busId: string
  descripcion: string
  prioridad: OrderPriority
  tipo: WorkOrderType
}

export interface AssignWorkOrderInput {
  observacion?: string
  tecnicoId: string
}

export interface ReassignWorkOrderInput {
  motivo: string
  tecnicoId: string
}

export interface TransitionObservationInput {
  observacion?: string
}

export interface InterventionUpdateInput {
  diagnostico?: string
  observaciones?: string
}

export interface CreateActivityInput {
  descripcion: string
}

export interface CreateConsumptionInput {
  cantidad: string
  claveIdempotencia: string
  repuestoId: string
}

function buildWorkOrderQuery(params: ListWorkOrdersParams) {
  const searchParams = new URLSearchParams({
    limite: String(params.limite),
    pagina: String(params.pagina),
  })

  if (params.busId) {
    searchParams.set('busId', params.busId)
  }

  if (params.busqueda?.trim()) {
    searchParams.set('busqueda', params.busqueda.trim())
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

  if (params.origen) {
    searchParams.set('origen', params.origen)
  }

  if (params.tecnicoId) {
    searchParams.set('tecnicoId', params.tecnicoId)
  }

  if (params.tipo) {
    searchParams.set('tipo', params.tipo)
  }

  return searchParams.toString()
}

export function getWorkOrderSummary() {
  return apiRequest<WorkOrderSummaryDto>('/ordenes-trabajo/resumen')
}

export function listWorkOrders(params: ListWorkOrdersParams) {
  return apiRequest<WorkOrderListResponse>(`/ordenes-trabajo?${buildWorkOrderQuery(params)}`)
}

export function listMyWorkOrders(params: ListWorkOrdersParams) {
  return apiRequest<WorkOrderListResponse>(
    `/ordenes-trabajo/mis-ordenes?${buildWorkOrderQuery(params)}`,
  )
}

export function getWorkOrder(ordenId: string) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}`)
}

export function createManualWorkOrder(input: CreateManualWorkOrderInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>('/ordenes-trabajo', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function getAvailableMechanics(busqueda?: string) {
  const query = busqueda?.trim()
    ? `?${new URLSearchParams({ busqueda: busqueda.trim() }).toString()}`
    : ''

  return apiRequest<{ mecanicos: MechanicOptionDto[] }>(
    `/ordenes-trabajo/mecanicos-disponibles${query}`,
  )
}

export function assignWorkOrder(ordenId: string, input: AssignWorkOrderInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/asignar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function reassignWorkOrder(ordenId: string, input: ReassignWorkOrderInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/reasignar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function startWorkOrder(ordenId: string, input: TransitionObservationInput = {}) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/iniciar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function resumeWorkOrder(ordenId: string, input: TransitionObservationInput = {}) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/reanudar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function updateWorkOrderIntervention(ordenId: string, input: InterventionUpdateInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/intervencion`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export function createWorkOrderActivity(ordenId: string, input: CreateActivityInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/actividades`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function getAvailableSpareParts(ordenId: string, busqueda?: string) {
  const query = busqueda?.trim()
    ? `?${new URLSearchParams({ busqueda: busqueda.trim() }).toString()}`
    : ''

  return apiRequest<{ repuestos: AvailableSparePartDto[] }>(
    `/ordenes-trabajo/${ordenId}/repuestos-disponibles${query}`,
  )
}

export function createWorkOrderConsumption(ordenId: string, input: CreateConsumptionInput) {
  return apiRequest<{ orden: WorkOrderDetailDto; yaExistia: boolean }>(
    `/ordenes-trabajo/${ordenId}/consumos`,
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  )
}

export function completeWorkOrder(ordenId: string, input: TransitionObservationInput = {}) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/completar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function returnWorkOrder(ordenId: string, motivo: string) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/devolver`, {
    body: JSON.stringify({ motivo }),
    method: 'POST',
  })
}

export function closeWorkOrder(ordenId: string, input: TransitionObservationInput = {}) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/cerrar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}
