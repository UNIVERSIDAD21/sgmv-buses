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
  fechaLectura: string | null
  fechaRegistro: string
  id: number
  intervencionId: number | null
  jornadaOperativaId: number | null
  kilometrajeAnterior: number
  kilometrajeNuevo: number
  motivo: string | null
  ordenTrabajoId: number | null
  ordenTrabajoCodigo: string | null
  registradoPor: ResponsibleDto
  tipo: string | null
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
  mantenimiento: {
    ordenesTecnicasActivas: number
    requiereAtencion: {
      actividad: string
      criterio: string
      estado: 'PROXIMO' | 'VENCIDO'
      fechaProgramada: string | null
      kilometrajeObjetivo: number | null
    } | null
    proximoProgramado: {
      actividad: string
      criterio: string
      fechaProgramada: string | null
      kilometrajeObjetivo: number | null
    } | null
    ultimoCerrado: {
      codigo: string
      fechaCierre: string
      kilometrajeCierre: number | null
      tipo: string
    } | null
  }
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
