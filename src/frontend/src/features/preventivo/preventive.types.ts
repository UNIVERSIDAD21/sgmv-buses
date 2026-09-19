import type { BusStatus } from '../flota/fleet.types'
import type { OrderPriority } from '../novedades/novelty.types'

export type PreventiveStatus = 'PROXIMO' | 'VENCIDO' | 'VIGENTE'
export type PreventiveCriterion = 'FECHA' | 'FECHA_KILOMETRAJE' | 'KILOMETRAJE'

export interface PreventiveUserDto {
  email: string
  id: number
  nombre: string
}

export interface PreventiveBusDto {
  anio: number
  codigoInterno: string
  estadoOperativo: BusStatus
  id: number
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
  id: number
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
  id: number
  kilometrajeObjetivo: number | null
  ordenActiva: PreventiveOrderSummaryDto | null
  plan: {
    anticipacionDiasEfectiva: number
    anticipacionKmEfectiva: number
    claveTarea: string
    id: number
    origen: 'BUS' | 'MODELO'
    version: number
  } | null
  prioridad: OrderPriority | null
  fuente: 'INDEPENDIENTE' | 'PLAN'
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

export interface PreventivePlanDto {
  activa: boolean
  actividad: string
  anticipacionDias: number | null
  anticipacionKm: number | null
  bloqueaAlVencer: boolean
  claveTarea: string
  componente: string
  criterio: PreventiveCriterion
  destino: { busId: number; tipo: 'BUS' } | { modeloBusId: number; tipo: 'MODELO' }
  id: number
  intervaloDias: number | null
  intervaloKm: number | null
  prioridad: OrderPriority
  programacionesActivas: number
  version: number
}

export interface PreventivePlanDetailDto {
  plan: PreventivePlanDto
  versiones: PreventivePlanDto[]
}

export interface PreventiveRestrictionDto {
  actividad?: string
  bloqueaDespacho: boolean
  bus: { codigoInterno: string; id: number }
  causa: string
  estado: Exclude<PreventiveStatus, 'VIGENTE'>
  objetivos: { fecha: string | null; kilometraje: number | null }
  programacionId: number
  restantes: { dias: number | null; kilometros: number | null }
  restriccion: 'PREVENTIVO_VENCIDO_BLOQUEANTE' | null
}
