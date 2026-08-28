import type { BusStatus } from '../flota/fleet.types'
import type { OrderPriority } from '../novedades/novelty.types'

export type PreventiveStatus = 'PROXIMO' | 'VENCIDO' | 'VIGENTE'
export type PreventiveCriterion = 'FECHA' | 'FECHA_KILOMETRAJE' | 'KILOMETRAJE'

export interface PreventiveUserDto {
  email: string
  id: string
  nombre: string
}

export interface PreventiveBusDto {
  anio: number
  codigoInterno: string
  estadoOperativo: BusStatus
  id: string
  kilometrajeActual: number
  marca: string
  modelo: string
  placa: string
}

export interface PreventiveCriterionResult {
  estado: PreventiveStatus
  restante: number
}

export interface PreventiveClassificationDto {
  criterios: {
    fecha: PreventiveCriterionResult | null
    kilometraje: PreventiveCriterionResult | null
  }
  diasRestantes: number | null
  estado: PreventiveStatus
  kilometrosRestantes: number | null
}

export interface PreventiveOrderSummaryDto {
  codigo: string
  descripcion: string
  estado: string
  fechaCreacion: string
  fechaObjetivoPreventivo: string | null
  id: string
  kilometrajeObjetivoPreventivo: number | null
  origen: 'PREVENTIVO'
  prioridad: OrderPriority
  tipo: 'PREVENTIVA'
}

export interface PreventiveScheduleDto {
  activa: boolean
  actividad: string
  bus: PreventiveBusDto
  clasificacion: PreventiveClassificationDto
  creadaPor: PreventiveUserDto
  createdAt: string
  criterio: PreventiveCriterion
  fechaProgramada: string | null
  id: string
  kilometrajeObjetivo: number | null
  ordenActiva: PreventiveOrderSummaryDto | null
  tipo: string
  updatedAt: string
}

export interface PreventiveListResponse {
  paginacion: {
    limite: number
    pagina: number
    total: number
    totalPaginas: number
  }
  programaciones: PreventiveScheduleDto[]
}

export interface PreventiveSummaryDto {
  activas: number
  elegiblesParaOrden: number
  estados: Record<PreventiveStatus, number>
  inactivas: number
  ordenesActivas: number
  total: number
  umbrales: {
    dias: number
    kilometros: number
  }
}
