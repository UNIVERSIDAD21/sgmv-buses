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
  TechnicalReadingType,
  DispatchWorkOrderProjectionDto,
} from './work-order.types'

export interface ListWorkOrdersParams {
  busId?: number
  busqueda?: string
  direccion?: 'asc' | 'desc'
  estado?: WorkOrderStatus | ''
  limite: number
  ordenarPor?:
    'bus' | 'codigo' | 'costoTotal' | 'estado' | 'fechaCierre' | 'fechaCreacion' | 'prioridad'
  origen?: WorkOrderOrigin | ''
  pagina: number
  tecnicoId?: number
  tipo?: WorkOrderType | ''
}

export interface CreateManualWorkOrderInput {
  busId: number
  descripcion: string
  prioridad: OrderPriority
}

export interface AssignWorkOrderInput {
  observacion?: string
  tecnicoId: number
}

export interface ReassignWorkOrderInput {
  motivo: string
  tecnicoId: number
}

export interface TransitionObservationInput {
  observacion?: string
}

export interface InterventionUpdateInput {
  intervencionId?: number
  diagnostico?: string
  observaciones?: string
}

export interface CreateActivityInput {
  descripcion: string
}

export interface CreateConsumptionInput {
  autorizacionExcepcionId?: number
  cantidad: string
  claveIdempotencia: string
  repuestoId: number
}

export interface AuthorizeConsumptionExceptionInput {
  cantidadMaxima: string
  fechaExpiracion?: string
  intervencionId: number
  motivo: string
  repuestoId: number
}

export interface CreateTechnicalReadingInput {
  fechaEvento: string
  kilometraje: number
  motivo?: string
  tipo: TechnicalReadingType
}

function buildWorkOrderQuery(params: ListWorkOrdersParams) {
  const searchParams = new URLSearchParams({
    limite: String(params.limite),
    pagina: String(params.pagina),
  })

  if (params.busId) {
    searchParams.set('busId', String(params.busId))
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
    searchParams.set('tecnicoId', String(params.tecnicoId))
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

export function getWorkOrder(ordenId: number) {
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

export function assignWorkOrder(ordenId: number, input: AssignWorkOrderInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/asignar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function reassignWorkOrder(ordenId: number, input: ReassignWorkOrderInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/reasignar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function startWorkOrder(ordenId: number, input: TransitionObservationInput = {}) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/iniciar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function resumeWorkOrder(ordenId: number, input: TransitionObservationInput = {}) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/reanudar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function updateWorkOrderIntervention(ordenId: number, input: InterventionUpdateInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/intervencion`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export function createWorkOrderActivity(ordenId: number, input: CreateActivityInput) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/actividades`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function createTechnicalWorkOrderReading(
  ordenId: number,
  input: CreateTechnicalReadingInput,
) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/lecturas`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function listDispatchWorkOrders() {
  return apiRequest<{ ordenes: DispatchWorkOrderProjectionDto[] }>('/ordenes-trabajo/despacho')
}

export function getAvailableSpareParts(ordenId: number, busqueda?: string) {
  const query = busqueda?.trim()
    ? `?${new URLSearchParams({ busqueda: busqueda.trim() }).toString()}`
    : ''

  return apiRequest<{ repuestos: AvailableSparePartDto[] }>(
    `/ordenes-trabajo/${ordenId}/repuestos-disponibles${query}`,
  )
}

export function createWorkOrderConsumption(ordenId: number, input: CreateConsumptionInput) {
  return apiRequest<{ orden: WorkOrderDetailDto; yaExistia: boolean }>(
    `/ordenes-trabajo/${ordenId}/consumos`,
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  )
}

export function authorizeWorkOrderConsumptionException(
  ordenId: number,
  input: AuthorizeConsumptionExceptionInput,
) {
  return apiRequest<{ autorizacion: { id: number } }>(
    `/ordenes-trabajo/${ordenId}/excepciones-consumo`,
    { body: JSON.stringify(input), method: 'POST' },
  )
}

export function revokeWorkOrderConsumptionException(ordenId: number, autorizacionId: number) {
  return apiRequest<{ autorizacion: { id: number } }>(
    `/ordenes-trabajo/${ordenId}/excepciones-consumo/${autorizacionId}/revocar`,
    { body: '{}', method: 'POST' },
  )
}

export function completeWorkOrder(ordenId: number, input: TransitionObservationInput = {}) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/completar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function returnWorkOrder(ordenId: number, motivo: string) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/devolver`, {
    body: JSON.stringify({ motivo }),
    method: 'POST',
  })
}

export function closeWorkOrder(ordenId: number, input: TransitionObservationInput = {}) {
  return apiRequest<{ orden: WorkOrderDetailDto }>(`/ordenes-trabajo/${ordenId}/cerrar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}
