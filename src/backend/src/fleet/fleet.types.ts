import type { EstadoBus } from '@prisma/client'

export interface ResponsibleDto {
  email: string
  id: number
  nombre: string
  telefono: string | null
}

export interface ActiveAssignmentDto {
  activa: boolean
  asignadoPor: ResponsibleDto
  bus?: {
    codigoInterno: string
    id: number
    placa: string
  }
  conductor: ResponsibleDto
  fechaFin: string | null
  fechaInicio: string
  id: number
  motivo: string | null
}

export interface MileageReadingDto {
  fechaRegistro: string
  id: number
  kilometrajeAnterior: number
  kilometrajeNuevo: number
  motivo: string | null
  registradoPor: ResponsibleDto
}

export interface StateHistoryDto {
  cambiadoPor: ResponsibleDto
  estadoAnterior: EstadoBus | null
  estadoNuevo: EstadoBus
  fechaCambio: string
  id: number
  motivo: string | null
}

export interface BusModelReferenceDto {
  activo: boolean
  id: number
  marca: string
  nombreModelo: string
  versionTecnica: string | null
}

export interface BusSummaryDto {
  anio: number
  codigoInterno: string
  conductorAsignado: ResponsibleDto | null
  estadoOperativo: EstadoBus
  id: number
  kilometrajeActual: number
  marca: string
  modelo: string
  modeloBus: BusModelReferenceDto | null
  placa: string
  updatedAt: string
}

export interface BusDetailDto extends BusSummaryDto {
  asignacionesHistorial: ActiveAssignmentDto[]
  estadosHistorial: StateHistoryDto[]
  lecturasKilometraje: MileageReadingDto[]
}

export interface DriverOptionDto extends ResponsibleDto {
  asignacionActiva: {
    bus: {
      codigoInterno: string
      id: number
      placa: string
    }
    id: number
  } | null
}

export interface FleetSummaryDto {
  asignacionesActivas: number
  porEstado: Record<EstadoBus, number>
  sinConductor: number
  totalBuses: number
}
