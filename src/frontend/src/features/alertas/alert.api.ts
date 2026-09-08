import { apiRequest } from '../../lib/api'
import type { AlertFilters, AlertInboxDto, AlertItemDto } from './alert.types'

export const ALERTS_UPDATED_EVENT = 'sgmv:alerts-updated'

export function listAlerts(filters: AlertFilters) {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  })

  if (filters.estado) query.set('estado', filters.estado)
  if (filters.fechaDesde) query.set('fechaDesde', filters.fechaDesde)
  if (filters.fechaHasta) query.set('fechaHasta', filters.fechaHasta)
  if (filters.prioridad) query.set('prioridad', filters.prioridad)
  if (filters.tipo) query.set('tipo', filters.tipo)

  return apiRequest<AlertInboxDto>(`/alertas?${query.toString()}`)
}

export function getUnreadAlertCount() {
  return apiRequest<{ count: number }>('/alertas/no-leidas/count')
}

export function markAlertRead(destinatarioId: string) {
  return apiRequest<{ alerta: AlertItemDto }>(`/alertas/${destinatarioId}/leida`, {
    method: 'PATCH',
  })
}

export function markAlertAttended(destinatarioId: string) {
  return apiRequest<{ alerta: AlertItemDto }>(`/alertas/${destinatarioId}/atendida`, {
    method: 'PATCH',
  })
}

export function announceAlertsUpdated() {
  window.dispatchEvent(new Event(ALERTS_UPDATED_EVENT))
}
