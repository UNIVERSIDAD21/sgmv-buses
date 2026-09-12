export type BusStatus = 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO' | 'INACTIVO' | 'OPERATIVO'

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
  estadoAnterior: BusStatus | null
  estadoNuevo: BusStatus
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

export interface ModeloBusSummaryDto extends BusModelReferenceDto {
  busesAsociados: number
  updatedAt: string
}

export interface ModeloBusDetailDto extends ModeloBusSummaryDto {
  createdAt: string
  especificaciones?: Record<string, unknown>
}

export interface RutaDto {
  longitudKmOficial?: number | null
  origenDato?: 'OFICIAL' | 'SIMULADO_SGMV'
  operador?: string | null
  semanticaLongitudOficial?: 'NO_DETERMINADA'
  semanticaLongitudDemo?: 'CIRCUITO_COMPLETO'
  origenSemanticaDemo?: 'SIMULADO_SGMV'
  procedencia?: Record<string, unknown>
  activa: boolean
  codigo: string
  createdAt: string
  destino: string
  id: number
  jornadasAsociadas: number
  nombre: string
  origen: string
  updatedAt: string
}

export interface BusSummaryDto {
  anio: number
  codigoInterno: string
  conductorAsignado: ResponsibleDto | null
  estadoOperativo: BusStatus
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
  porEstado: Record<BusStatus, number>
  sinConductor: number
  totalBuses: number
}

export interface ListBusesResponse {
  buses: BusSummaryDto[]
  paginacion: {
    limite: number
    pagina: number
    total: number
    totalPaginas: number
  }
}

export interface AssignedBusResponse {
  asignacion: ActiveAssignmentDto | null
  bus: BusDetailDto | null
}
