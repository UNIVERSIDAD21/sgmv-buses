import type {
  CriterioMantenimiento,
  EstadoBus,
  EstadoOrdenTrabajo,
  PrioridadOrden,
} from '@prisma/client'

import type { PreventiveClassificationResult } from './preventive.classification.js'

export interface PreventiveUserDto {
  email: string
  id: string
  nombre: string
}

export interface PreventiveBusDto {
  anio: number
  codigoInterno: string
  estadoOperativo: EstadoBus
  id: string
  kilometrajeActual: number
  marca: string
  modelo: string
  placa: string
}

export interface PreventiveOrderSummaryDto {
  codigo: string
  descripcion: string
  estado: EstadoOrdenTrabajo
  fechaCreacion: string
  fechaObjetivoPreventivo: string | null
  id: string
  kilometrajeObjetivoPreventivo: number | null
  origen: 'PREVENTIVO'
  prioridad: PrioridadOrden
  tipo: 'PREVENTIVA'
}

export interface PreventiveScheduleDto {
  activa: boolean
  actividad: string
  bus: PreventiveBusDto
  clasificacion: PreventiveClassificationResult
  creadaPor: PreventiveUserDto
  createdAt: string
  criterio: CriterioMantenimiento
  fechaProgramada: string | null
  id: string
  kilometrajeObjetivo: number | null
  ordenActiva: PreventiveOrderSummaryDto | null
  tipo: string
  updatedAt: string
}

export interface PreventiveListDto {
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
  estados: Record<PreventiveClassificationResult['estado'], number>
  inactivas: number
  ordenesActivas: number
  total: number
  umbrales: {
    dias: number
    kilometros: number
  }
}

export interface GeneratePreventiveOrderDto {
  orden: PreventiveOrderSummaryDto
  programacion: PreventiveScheduleDto
  yaExistia: boolean
}
