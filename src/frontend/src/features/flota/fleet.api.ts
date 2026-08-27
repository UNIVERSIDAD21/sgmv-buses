import { apiRequest } from '../../lib/api'
import type {
  AssignedBusResponse,
  BusDetailDto,
  BusStatus,
  DriverOptionDto,
  FleetSummaryDto,
  ListBusesResponse,
} from './fleet.types'

interface ListBusesParams {
  busqueda?: string
  estado?: BusStatus | ''
  limite: number
  pagina: number
}

export interface BusFormInput {
  anio: number
  codigoInterno: string
  estadoOperativo?: BusStatus
  kilometrajeActual?: number
  marca: string
  modelo: string
  motivoEstado?: string
  placa: string
}

export function getFleetSummary() {
  return apiRequest<FleetSummaryDto>('/flota/resumen')
}

export function getAssignedBus() {
  return apiRequest<AssignedBusResponse>('/flota/mi-bus')
}

export function listBuses(params: ListBusesParams) {
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

  return apiRequest<ListBusesResponse>(`/flota/buses?${searchParams.toString()}`)
}

export function getBus(busId: string) {
  return apiRequest<{ bus: BusDetailDto }>(`/flota/buses/${busId}`)
}

export function createBus(input: BusFormInput) {
  return apiRequest<{ bus: BusDetailDto }>('/flota/buses', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function updateBus(
  busId: string,
  input: Omit<BusFormInput, 'estadoOperativo' | 'kilometrajeActual' | 'motivoEstado'>,
) {
  return apiRequest<{ bus: BusDetailDto }>(`/flota/buses/${busId}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export function registerMileage(busId: string, kilometrajeNuevo: number, motivo?: string) {
  return apiRequest(`/flota/buses/${busId}/kilometraje`, {
    body: JSON.stringify({ kilometrajeNuevo, motivo }),
    method: 'POST',
  })
}

export function changeBusState(busId: string, estadoNuevo: BusStatus, motivo: string) {
  return apiRequest(`/flota/buses/${busId}/estado`, {
    body: JSON.stringify({ estadoNuevo, motivo }),
    method: 'POST',
  })
}

export function assignDriver(busId: string, conductorId: string, motivo?: string) {
  return apiRequest(`/flota/buses/${busId}/asignaciones`, {
    body: JSON.stringify({ conductorId, motivo }),
    method: 'POST',
  })
}

export function getAvailableDrivers(busId?: string) {
  const suffix = busId ? `?${new URLSearchParams({ busId }).toString()}` : ''

  return apiRequest<{ conductores: DriverOptionDto[] }>(`/flota/conductores-disponibles${suffix}`)
}
