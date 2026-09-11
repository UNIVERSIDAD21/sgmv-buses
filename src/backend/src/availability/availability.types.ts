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
  origenId: number
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
  bus: { estadoOperativo: EstadoBus; id: number; kilometrajeActual: number } | null
  conflictingJourney: { id: number } | null
  novelty: { id: number } | null
  order: { id: number } | null
  preventive: Array<{
    fechaProgramada: Date | null
    id: number
    kilometrajeObjetivo: number | null
    plan: {
      anticipacionDias: number | null
      anticipacionKm: number | null
      bloqueaAlVencer: boolean
      claveTarea: string
    }
  }>
}
