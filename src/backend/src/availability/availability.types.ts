import type { EstadoBus } from '@prisma/client'

export type AvailabilityCode =
  | 'BUS_INACTIVO'
  | 'BUS_FUERA_DE_SERVICIO'
  | 'BUS_EN_MANTENIMIENTO'
  | 'ORDEN_TECNICA_ACTIVA'
  | 'NOVEDAD_BLOQUEANTE'
  | 'PREVENTIVO_VENCIDO_BLOQUEANTE'
  | 'CONFLICTO_JORNADA'

export interface AvailabilityCauseDto {
  bloquea: true
  codigo: AvailabilityCode
  mensaje: string
  origenId: string
  origenTipo: 'BUS' | 'JORNADA' | 'NOVEDAD' | 'ORDEN' | 'PREVENTIVO'
  prioridad: number
}

export interface AvailabilityDto {
  causaPrincipal: AvailabilityCode | null
  causas: AvailabilityCauseDto[]
  disponible: boolean
  evaluadoAt: string
}

export interface AvailabilityRecords {
  bus: { estadoOperativo: EstadoBus; id: string; kilometrajeActual: number } | null
  conflictingJourney: { id: string } | null
  novelty: { id: string } | null
  order: { id: string } | null
  preventive: { id: string } | null
}
