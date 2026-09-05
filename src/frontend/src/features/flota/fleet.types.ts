export type BusStatus = 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO' | 'INACTIVO' | 'OPERATIVO'

export interface ResponsibleDto {
  email: string
  id: string
  nombre: string
  telefono: string | null
}

export interface ActiveAssignmentDto {
  activa: boolean
  asignadoPor: ResponsibleDto
  bus?: {
    codigoInterno: string
    id: string
    placa: string
  }
  conductor: ResponsibleDto
  fechaFin: string | null
  fechaInicio: string
  id: string
  motivo: string | null
}

export interface MileageReadingDto {
  fechaRegistro: string
  id: string
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
  id: string
  motivo: string | null
}

export interface BusModelReferenceDto {
  activo: boolean
  id: string
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
  activa: boolean
  codigo: string
  createdAt: string
  destino: string
  id: string
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
  id: string
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
      id: string
      placa: string
    }
    id: string
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
