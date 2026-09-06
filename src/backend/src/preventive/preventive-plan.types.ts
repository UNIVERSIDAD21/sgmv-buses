import type { CriterioMantenimiento, PrioridadOrden } from '@prisma/client'

import type { PreventiveUserDto } from './preventive.types.js'

export interface PreventivePlanDto {
  activa: boolean
  actividad: string
  anticipacionDias: number | null
  anticipacionKm: number | null
  bloqueaAlVencer: boolean
  claveTarea: string
  componente: string
  creadoPor: PreventiveUserDto
  createdAt: string
  criterio: CriterioMantenimiento
  destino: { busId: string; tipo: 'BUS' } | { modeloBusId: string; tipo: 'MODELO' }
  id: string
  intervaloDias: number | null
  intervaloKm: number | null
  prioridad: PrioridadOrden
  programacionesAsociadas: number
  updatedAt: string
  version: number
}

export interface EffectivePreventivePlanDto {
  origenPlan: 'BUS' | 'MODELO'
  plan: PreventivePlanDto
}
