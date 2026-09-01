import { apiRequest } from '../../lib/api'
import type {
  CostReportDto,
  HistoryBusDto,
  HistoryDetailDto,
  HistoryOrderOrigin,
  HistoryOrderState,
  HistoryOrderType,
  HistorySummaryDto,
  MaintenanceReportDto,
  PaginationDto,
  PartsReportDto,
} from './history.types'

export interface HistoryFilters {
  busId?: string
  busqueda?: string
  estado?: HistoryOrderState | ''
  fechaDesde?: string
  fechaHasta?: string
  limite?: number
  origen?: HistoryOrderOrigin | ''
  pagina?: number
  tipo?: HistoryOrderType | ''
}

function buildQuery(filters: HistoryFilters = {}) {
  const params = new URLSearchParams({
    limite: String(filters.limite ?? 10),
    pagina: String(filters.pagina ?? 1),
  })

  for (const [key, value] of Object.entries(filters)) {
    if (key !== 'limite' && key !== 'pagina' && value !== undefined && value !== '') {
      params.set(key, String(value).trim())
    }
  }

  return params.toString()
}

export function getHistorySummary(filters?: HistoryFilters) {
  return apiRequest<HistorySummaryDto>(`/historial/resumen?${buildQuery(filters)}`)
}

export function listHistoryBuses(filters?: HistoryFilters) {
  return apiRequest<{ buses: HistoryBusDto[]; paginacion: PaginationDto }>(
    `/historial/buses?${buildQuery(filters)}`,
  )
}

export function getBusHistory(busId: string, filters?: HistoryFilters) {
  return apiRequest<HistoryDetailDto>(`/historial/buses/${busId}?${buildQuery(filters)}`)
}

export function getMyBusHistory(filters?: HistoryFilters) {
  return apiRequest<{
    asignacion: { fechaInicio: string; id: string } | null
    historial: HistoryDetailDto | null
  }>(`/historial/mi-bus?${buildQuery(filters)}`)
}

export function getMaintenanceReport(filters?: HistoryFilters) {
  return apiRequest<MaintenanceReportDto>(
    `/historial/informes/mantenimiento?${buildQuery(filters)}`,
  )
}

export function getPartsReport(filters?: HistoryFilters) {
  return apiRequest<PartsReportDto>(`/historial/informes/repuestos?${buildQuery(filters)}`)
}

export function getCostReport(filters?: HistoryFilters) {
  return apiRequest<CostReportDto>(`/historial/informes/costos?${buildQuery(filters)}`)
}
