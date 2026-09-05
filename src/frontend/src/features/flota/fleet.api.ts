import { apiRequest } from '../../lib/api'
import type {
  AssignedBusResponse,
  BusDetailDto,
  BusStatus,
  FleetSummaryDto,
  ListBusesResponse,
  ModeloBusDetailDto,
  ModeloBusSummaryDto,
  RutaDto,
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
  modeloBusId?: string | null
  motivoEstado?: string
  placa: string
}

export interface ModeloBusFormInput {
  especificaciones: Record<string, unknown>
  marca: string
  nombreModelo: string
  versionTecnica?: string | null
}

export interface RutaFormInput {
  codigo: string
  destino: string
  nombre: string
  origen: string
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

function catalogQuery(incluirInactivos: boolean, busqueda?: string) {
  const searchParams = new URLSearchParams()

  if (incluirInactivos) searchParams.set('incluirInactivos', 'true')
  if (busqueda?.trim()) searchParams.set('busqueda', busqueda.trim())

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function listModelosBus(incluirInactivos = false, busqueda?: string) {
  return apiRequest<{ modelosBus: ModeloBusSummaryDto[] }>(
    `/flota/modelos-bus${catalogQuery(incluirInactivos, busqueda)}`,
  )
}

export function getModeloBus(modeloBusId: string) {
  return apiRequest<{ modeloBus: ModeloBusDetailDto }>(`/flota/modelos-bus/${modeloBusId}`)
}

export function createModeloBus(input: ModeloBusFormInput) {
  return apiRequest<{ modeloBus: ModeloBusDetailDto }>('/flota/modelos-bus', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function updateModeloBus(modeloBusId: string, input: Partial<ModeloBusFormInput>) {
  return apiRequest<{ modeloBus: ModeloBusDetailDto }>(`/flota/modelos-bus/${modeloBusId}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export function setModeloBusActive(modeloBusId: string, activo: boolean) {
  return apiRequest<{ modeloBus: ModeloBusDetailDto }>(
    `/flota/modelos-bus/${modeloBusId}/${activo ? 'activar' : 'desactivar'}`,
    { body: JSON.stringify({}), method: 'POST' },
  )
}

export function listRutas(incluirInactivos = false, busqueda?: string) {
  return apiRequest<{ rutas: RutaDto[] }>(`/flota/rutas${catalogQuery(incluirInactivos, busqueda)}`)
}

export function createRuta(input: RutaFormInput) {
  return apiRequest<{ ruta: RutaDto }>('/flota/rutas', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function updateRuta(rutaId: string, input: Partial<RutaFormInput>) {
  return apiRequest<{ ruta: RutaDto }>(`/flota/rutas/${rutaId}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export function setRutaActive(rutaId: string, activa: boolean) {
  return apiRequest<{ ruta: RutaDto }>(
    `/flota/rutas/${rutaId}/${activa ? 'activar' : 'desactivar'}`,
    { body: JSON.stringify({}), method: 'POST' },
  )
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
