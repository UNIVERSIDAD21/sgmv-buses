export type AlertType =
  | 'MANTENIMIENTO_PROXIMO'
  | 'MANTENIMIENTO_VENCIDO'
  | 'NOVEDAD_CRITICA'
  | 'BUS_BLOQUEADO'
  | 'CONFLICTO_JORNADA'
  | 'JORNADA_SIN_KILOMETRAJE_INICIAL'
  | 'JORNADA_SIN_KILOMETRAJE_FINAL'
  | 'ORDEN_PENDIENTE_ASIGNACION'
  | 'ORDEN_ASIGNADA'
  | 'ORDEN_COMPLETADA_TECNICO'
  | 'ORDEN_DEVUELTA'
  | 'BAJO_INVENTARIO'
  | 'CONSUMO_INCOMPATIBLE'
  | 'CAMBIO_JORNADA'
  | 'CAMBIO_ESTADO_NOVEDAD'

export type AlertPriority = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
export type AlertRecipientStatus = 'NO_LEIDA' | 'LEIDA' | 'ATENDIDA'

export interface AlertItemDto {
  alertaId: string
  contextoEvento: Record<string, unknown>
  destinatarioId: string
  enlaceInterno: string | null
  estado: AlertRecipientStatus
  fechaAtencion: string | null
  fechaGeneracion: string
  fechaLectura: string | null
  mensaje: string
  prioridad: AlertPriority
  tipo: AlertType
  titulo: string
}

export interface AlertInboxDto {
  items: AlertItemDto[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AlertFilters {
  estado?: AlertRecipientStatus | ''
  fechaDesde?: string
  fechaHasta?: string
  page: number
  pageSize: number
  prioridad?: AlertPriority | ''
  tipo?: AlertType | ''
}
